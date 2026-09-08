// server/services/payment.service.js
const db = require('../config/db');
const { recalculateTrustScore } = require('./trustScore.service');

const INSPECTION_WINDOW_HOURS = parseInt(process.env.ESCROW_INSPECTION_WINDOW_HOURS || '48', 10);

/**
 * Escrow & Multi-Method Payment Service (PRD Section 5.1)
 */
class PaymentService {
    /**
     * Initializes payment record for an order
     */
    static async initializePayment({ orderId, payerId, payeeId, amount, paymentMethod }) {
        let normalizedMethod = 'escrow_wallet';
        if (paymentMethod === 'cash' || paymentMethod === 'cash_logged') {
            normalizedMethod = 'cash_logged';
        } else if (paymentMethod === 'upi' || paymentMethod === 'upi_bank_transfer') {
            normalizedMethod = 'upi_bank_transfer';
        } else {
            normalizedMethod = 'escrow_wallet';
        }

        const initialEscrowStatus = normalizedMethod === 'escrow_wallet' ? 'funded' : 'not_applicable';
        const initialCashStatus = normalizedMethod === 'cash_logged' ? 'pending_confirmation' : 'not_applicable';

        const inspectionEndsAt = new Date();
        inspectionEndsAt.setHours(inspectionEndsAt.getHours() + INSPECTION_WINDOW_HOURS);

        const res = await db.query(
            `INSERT INTO public.payments (
                order_id, payer_id, payee_id, amount, payment_method,
                escrow_status, cash_status, inspection_window_ends_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [orderId, payerId, payeeId, amount, normalizedMethod, initialEscrowStatus, initialCashStatus, inspectionEndsAt]
        );

        const payment = res.rows[0];

        if (normalizedMethod === 'escrow_wallet') {
            await db.query(
                `INSERT INTO public.escrow_events (payment_id, event_type, actor_id, details)
                 VALUES ($1, 'funded', $2, $3)`,
                [payment.id, payerId, JSON.stringify({ amount, note: 'Buyer funded escrow on order confirmation' })]
            );
        }

        return payment;
    }

    /**
     * Release escrow funds to seller (Delivery confirmed or inspection window elapsed)
     */
    static async releaseEscrow({ orderId, actorId, reason = 'Delivery confirmed' }) {
        const payRes = await db.query(
            'SELECT * FROM public.payments WHERE order_id = $1',
            [orderId]
        );

        if (payRes.rows.length === 0) {
            throw new Error('Payment record not found for this order.');
        }

        const payment = payRes.rows[0];

        if (payment.payment_method !== 'escrow_wallet') {
            throw new Error('Payment method is not escrow wallet.');
        }

        if (payment.escrow_status === 'released') {
            return payment; // already released
        }

        if (payment.escrow_status === 'disputed') {
            throw new Error('Cannot release escrow: payment is currently in dispute.');
        }

        const updatedRes = await db.query(
            `UPDATE public.payments
             SET escrow_status = 'released', updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [payment.id]
        );

        await db.query(
            `INSERT INTO public.escrow_events (payment_id, event_type, actor_id, details)
             VALUES ($1, 'released', $2, $3)`,
            [payment.id, actorId, JSON.stringify({ reason })]
        );

        // Recalculate payer's trust score (speed & reliability)
        await recalculateTrustScore(payment.payer_id, 'Escrow released on time', orderId);

        return updatedRes.rows[0];
    }

    /**
     * Raise a dispute on escrow funds
     */
    static async disputeEscrow({ orderId, actorId, reason }) {
        const payRes = await db.query(
            'SELECT * FROM public.payments WHERE order_id = $1',
            [orderId]
        );

        if (payRes.rows.length === 0) {
            throw new Error('Payment record not found for this order.');
        }

        const payment = payRes.rows[0];

        if (payment.payment_method !== 'escrow_wallet') {
            throw new Error('Payment method is not escrow wallet.');
        }

        const updatedRes = await db.query(
            `UPDATE public.payments
             SET escrow_status = 'disputed', dispute_reason = $2, updated_at = now()
             WHERE id = $1
             RETURNING *`,
            [payment.id, reason]
        );

        await db.query(
            `INSERT INTO public.escrow_events (payment_id, event_type, actor_id, details)
             VALUES ($1, 'disputed', $2, $3)`,
            [payment.id, actorId, JSON.stringify({ reason })]
        );

        // Deduct from trust score for disputes
        await recalculateTrustScore(actorId, 'Payment dispute raised', orderId);

        return updatedRes.rows[0];
    }

    /**
     * Log cash payment by seller (PRD Section 5.1.2)
     */
    static async logCashBySeller({ orderId, sellerId, amount, date }) {
        const payRes = await db.query(
            'SELECT * FROM public.payments WHERE order_id = $1',
            [orderId]
        );

        if (payRes.rows.length === 0) {
            throw new Error('Payment record not found.');
        }

        const payment = payRes.rows[0];
        if (payment.payee_id !== sellerId) {
            throw new Error('Only the seller/payee can log cash received.');
        }

        const paymentDate = date ? new Date(date) : new Date();
        const numAmount = parseFloat(amount);

        // Check if buyer has already reported
        let newStatus = 'pending_confirmation';
        if (payment.cash_buyer_reported_amount !== null) {
            const buyerAmt = parseFloat(payment.cash_buyer_reported_amount);
            if (Math.abs(buyerAmt - numAmount) < 0.01) {
                newStatus = 'confirmed_match';
            } else {
                newStatus = 'mismatch';
            }
        }

        const updated = await db.query(
            `UPDATE public.payments
             SET cash_seller_reported_amount = $1,
                 cash_seller_reported_date = $2,
                 cash_status = $3,
                 updated_at = now()
             WHERE id = $4
             RETURNING *`,
            [numAmount, paymentDate, newStatus, payment.id]
        );

        if (newStatus === 'mismatch') {
            // Apply trust score penalty for mismatches
            await recalculateTrustScore(sellerId, 'Cash payment mismatch reported', orderId);
        } else if (newStatus === 'confirmed_match') {
            await recalculateTrustScore(sellerId, 'Cash payment verified', orderId);
            await recalculateTrustScore(payment.payer_id, 'Cash payment verified', orderId);
        }

        return updated.rows[0];
    }

    /**
     * Confirm cash payment by buyer (PRD Section 5.1.2)
     */
    static async confirmCashByBuyer({ orderId, buyerId, amount, date }) {
        const payRes = await db.query(
            'SELECT * FROM public.payments WHERE order_id = $1',
            [orderId]
        );

        if (payRes.rows.length === 0) {
            throw new Error('Payment record not found.');
        }

        const payment = payRes.rows[0];
        if (payment.payer_id !== buyerId) {
            throw new Error('Only the buyer/payer can confirm cash payment.');
        }

        const paymentDate = date ? new Date(date) : new Date();
        const numAmount = parseFloat(amount);

        // Check against seller reported amount
        let newStatus = 'pending_confirmation';
        if (payment.cash_seller_reported_amount !== null) {
            const sellerAmt = parseFloat(payment.cash_seller_reported_amount);
            if (Math.abs(sellerAmt - numAmount) < 0.01) {
                newStatus = 'confirmed_match';
            } else {
                newStatus = 'mismatch';
            }
        }

        const updated = await db.query(
            `UPDATE public.payments
             SET cash_buyer_reported_amount = $1,
                 cash_buyer_reported_date = $2,
                 cash_status = $3,
                 updated_at = now()
             WHERE id = $4
             RETURNING *`,
            [numAmount, paymentDate, newStatus, payment.id]
        );

        if (newStatus === 'mismatch') {
            await recalculateTrustScore(buyerId, 'Cash payment mismatch reported', orderId);
        } else if (newStatus === 'confirmed_match') {
            await recalculateTrustScore(buyerId, 'Cash payment verified', orderId);
            await recalculateTrustScore(payment.payee_id, 'Cash payment verified', orderId);
        }

        return updated.rows[0];
    }

    /**
     * Record UPI / Bank Transfer Reference
     */
    static async recordDigitalTransfer({ orderId, actorId, transactionReference }) {
        const res = await db.query(
            `UPDATE public.payments
             SET transaction_reference = $1,
                 updated_at = now()
             WHERE order_id = $2
             RETURNING *`,
            [transactionReference, orderId]
        );

        if (res.rows.length === 0) {
            throw new Error('Payment record not found.');
        }

        return res.rows[0];
    }
}

module.exports = PaymentService;
