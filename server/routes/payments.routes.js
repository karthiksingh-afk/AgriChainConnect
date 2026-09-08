// server/routes/payments.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const PaymentService = require('../services/payment.service');

/**
 * GET /api/payments/:orderId
 * Fetches payment details and full escrow event audit log
 */
router.get('/:orderId', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const payRes = await db.query(
            `SELECT p.*,
                   b.name as payer_name, b.role as payer_role,
                   s.name as payee_name, s.role as payee_role
            FROM public.payments p
            JOIN public.users b ON b.id = p.payer_id
            JOIN public.users s ON s.id = p.payee_id
            WHERE p.order_id = $1`,
            [orderId]
        );

        if (payRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Payment record not found.', code: 'PAYMENT_NOT_FOUND' }
            });
        }

        const payment = payRes.rows[0];

        // Access check
        if (payment.payer_id !== req.user.id && payment.payee_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized.', code: 'FORBIDDEN' }
            });
        }

        // Fetch escrow events
        const eventsRes = await db.query(
            `SELECT e.*, u.name as actor_name, u.role as actor_role
             FROM public.escrow_events e
             JOIN public.users u ON u.id = e.actor_id
             WHERE e.payment_id = $1
             ORDER BY e.timestamp ASC`,
            [payment.id]
        );

        const isMismatch = payment.cash_status === 'mismatch';
        const paymentPayload = {
            ...payment,
            cash_collected_amount: payment.cash_seller_reported_amount,
            is_cash_mismatch: isMismatch
        };

        return res.status(200).json({
            success: true,
            payment: paymentPayload,
            ...paymentPayload,
            escrow_events: eventsRes.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/payments/:orderId/escrow/release
 * Buyer manually releases escrow to seller
 */
router.post('/:orderId/escrow/release', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { reason = 'Manual release by buyer' } = req.body;

        const payRes = await db.query('SELECT payer_id FROM public.payments WHERE order_id = $1', [orderId]);
        if (payRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Payment record not found.', code: 'NOT_FOUND' }
            });
        }

        if (payRes.rows[0].payer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Only the buyer can release escrow funds.', code: 'FORBIDDEN' }
            });
        }

        const payment = await PaymentService.releaseEscrow({
            orderId,
            actorId: req.user.id,
            reason
        });

        return res.status(200).json({
            success: true,
            message: 'Escrow funds successfully released to seller.',
            payment
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/payments/:orderId/escrow/dispute
 * Raise dispute on escrow funds
 */
router.post('/:orderId/escrow/dispute', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: { message: 'Dispute reason is required.', code: 'REASON_REQUIRED' }
            });
        }

        const payRes = await db.query('SELECT payer_id, payee_id FROM public.payments WHERE order_id = $1', [orderId]);
        if (payRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Payment not found.', code: 'NOT_FOUND' }
            });
        }

        const { payer_id, payee_id } = payRes.rows[0];
        if (payer_id !== req.user.id && payee_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized.', code: 'FORBIDDEN' }
            });
        }

        const payment = await PaymentService.disputeEscrow({
            orderId,
            actorId: req.user.id,
            reason
        });

        return res.status(200).json({
            success: true,
            message: 'Dispute recorded. Funds remain held in escrow.',
            payment
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/payments/:orderId/cash/log
 * PRD Section 5.1.2: Seller logs cash payment received
 */
router.post('/:orderId/cash/log', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { amount, date } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: { message: 'Cash amount received is required.', code: 'AMOUNT_REQUIRED' }
            });
        }

        const payment = await PaymentService.logCashBySeller({
            orderId,
            sellerId: req.user.id,
            amount,
            date
        });

        const paymentPayload = {
            ...payment,
            cash_collected_amount: payment.cash_seller_reported_amount,
            is_cash_mismatch: payment.cash_status === 'mismatch'
        };

        return res.status(200).json({
            success: true,
            message: 'Cash payment logged by seller.',
            payment: paymentPayload,
            ...paymentPayload,
            status: payment.cash_status
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/payments/:orderId/cash/confirm
 * PRD Section 5.1.2: Buyer independently confirms cash payment
 * If amounts match -> confirmed_match
 * If amounts mismatch -> flagged as 'mismatch'!
 */
router.post('/:orderId/cash/confirm', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { amount, date } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: { message: 'Cash amount confirmed is required.', code: 'AMOUNT_REQUIRED' }
            });
        }

        const payment = await PaymentService.confirmCashByBuyer({
            orderId,
            buyerId: req.user.id,
            amount,
            date
        });

        const isMismatch = payment.cash_status === 'mismatch';
        const paymentPayload = {
            ...payment,
            cash_collected_amount: payment.cash_seller_reported_amount,
            is_cash_mismatch: isMismatch
        };

        return res.status(200).json({
            success: true,
            message: isMismatch
                ? 'Warning: Cash payment mismatch detected! Order flagged for review.'
                : 'Cash payment confirmed and matched successfully.',
            payment: paymentPayload,
            ...paymentPayload,
            status: payment.cash_status
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/payments/:orderId/upi/record
 * Record digital transfer reference (UPI/NEFT/IMPS)
 */
router.post('/:orderId/upi/record', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { transaction_reference } = req.body;

        if (!transaction_reference) {
            return res.status(400).json({
                success: false,
                error: { message: 'transaction_reference is required.', code: 'REF_REQUIRED' }
            });
        }

        const payment = await PaymentService.recordDigitalTransfer({
            orderId,
            actorId: req.user.id,
            transactionReference: transaction_reference
        });

        return res.status(200).json({
            success: true,
            message: 'Digital transaction reference recorded.',
            payment
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
