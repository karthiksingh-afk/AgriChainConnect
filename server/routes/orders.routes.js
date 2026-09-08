// server/routes/orders.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireBuyCapability } = require('../middleware/roleGuard');
const PaymentService = require('../services/payment.service');

/**
 * GET /api/orders
 * Returns list of orders for authenticated user
 * Supports ?type=procurement (buy-side) and ?type=sales (sell-side)
 */
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { type } = req.query;

        let filter = '(o.buyer_id = $1 OR o.seller_id = $1)';
        if (type === 'procurement') {
            filter = 'o.buyer_id = $1';
        } else if (type === 'sales') {
            filter = 'o.seller_id = $1';
        }

        const query = `
            SELECT o.*,
                   l.crop_type, l.crop_type as commodity_type, l.category, l.unit,
                   o.quantity as quantity_quintals,
                   o.total_amount as total_amount_inr,
                   o.unit_price as unit_price_inr,
                   b.name as buyer_name, b.role as buyer_role,
                   s.name as seller_name, s.role as seller_role,
                   p.payment_method, p.escrow_status, p.cash_status, p.amount as payment_amount,
                   COALESCE(p.escrow_status::text, p.cash_status::text, 'funded') as payment_status
            FROM public.orders o
            LEFT JOIN public.listings l ON l.id = o.listing_id
            JOIN public.users b ON b.id = o.buyer_id
            JOIN public.users s ON s.id = o.seller_id
            LEFT JOIN public.payments p ON p.order_id = o.id
            WHERE ${filter}
            ORDER BY o.created_at DESC
        `;

        const result = await db.query(query, [req.user.id]);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            orders: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/orders/:id
 * Full order details including timeline and payment record
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const orderRes = await db.query(
            `SELECT o.*,
                   l.crop_type, l.crop_type as commodity_type, l.category, l.unit, l.location as pickup_location,
                   o.quantity as quantity_quintals,
                   o.total_amount as total_amount_inr,
                   o.unit_price as unit_price_inr,
                   b.name as buyer_name, b.username as buyer_username, b.role as buyer_role, b.mobile_number as buyer_mobile,
                   s.name as seller_name, s.username as seller_username, s.role as seller_role, s.mobile_number as seller_mobile
            FROM public.orders o
            LEFT JOIN public.listings l ON l.id = o.listing_id
            JOIN public.users b ON b.id = o.buyer_id
            JOIN public.users s ON s.id = o.seller_id
            WHERE o.id = $1`,
            [id]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
            });
        }

        const order = orderRes.rows[0];

        // Access check
        if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized to view this order.', code: 'FORBIDDEN' }
            });
        }

        // Fetch payment details
        const payRes = await db.query(
            'SELECT * FROM public.payments WHERE order_id = $1',
            [id]
        );

        // Fetch status history timeline (PRD Section 12)
        const historyRes = await db.query(
            `SELECT h.*, u.name as updated_by_name, u.role as updated_by_role
             FROM public.order_status_history h
             JOIN public.users u ON u.id = h.updated_by
             WHERE h.order_id = $1
             ORDER BY h.timestamp ASC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            order,
            payment: payRes.rows[0] || null,
            status_history: historyRes.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/orders
 * Direct order creation against a listing
 * Strictly enforced: Only buy-capable roles (Aggregator, Wholesaler, Processor, Distributor, Final Retailer)
 * Farmer cannot place buy orders (PRD Section 4.1).
 */
router.post('/', authenticateToken, requireBuyCapability, async (req, res, next) => {
    try {
        const {
            listing_id,
            quantity,
            quantity_quintals,
            payment_method = 'escrow_wallet',
            estimated_delivery_days = 3,
            delivery_address = null,
            pickup_dropoff_notes = null
        } = req.body;

        const qty = quantity !== undefined ? quantity : quantity_quintals;
        const notes = delivery_address || pickup_dropoff_notes;

        if (!listing_id || qty === undefined) {
            return res.status(400).json({
                success: false,
                error: { message: 'listing_id and quantity are required.', code: 'VALIDATION_ERROR' }
            });
        }

        const listRes = await db.query('SELECT * FROM public.listings WHERE id = $1', [listing_id]);
        if (listRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Listing not found.', code: 'LISTING_NOT_FOUND' }
            });
        }

        const listing = listRes.rows[0];

        if (listing.seller_id === req.user.id) {
            return res.status(400).json({
                success: false,
                error: { message: 'Cannot buy from your own listing.', code: 'SELF_PURCHASE' }
            });
        }

        const numQty = parseFloat(qty);
        if (numQty <= 0 || numQty > parseFloat(listing.quantity)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: `Requested quantity (${numQty}) must be positive and cannot exceed available quantity (${listing.quantity}).`,
                    code: 'QUANTITY_EXCEEDED'
                }
            });
        }

        const unitPrice = parseFloat(listing.asking_price_per_unit);
        const totalAmount = numQty * unitPrice;

        const estDelivery = new Date();
        estDelivery.setDate(estDelivery.getDate() + (parseInt(estimated_delivery_days, 10) || 3));

        // Create Order
        const orderRes = await db.query(
            `INSERT INTO public.orders (
                buyer_id, seller_id, listing_id, quantity, unit_price,
                total_amount, currency, status, estimated_delivery_date, pickup_dropoff_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', 'confirmed', $7, $8)
            RETURNING *`,
            [
                req.user.id,
                listing.seller_id,
                listing.id,
                numQty,
                unitPrice,
                totalAmount,
                estDelivery,
                notes
            ]
        );

        const order = orderRes.rows[0];

        // Record status history
        await db.query(
            `INSERT INTO public.order_status_history (order_id, status, notes, updated_by)
             VALUES ($1, 'order_placed', 'Direct order placed by buyer', $2),
                    ($1, 'confirmed', 'Order automatically confirmed', $2)`,
            [order.id, req.user.id]
        );

        // Initialize payment
        const payment = await PaymentService.initializePayment({
            orderId: order.id,
            payerId: req.user.id,
            payeeId: listing.seller_id,
            amount: totalAmount,
            paymentMethod: payment_method
        });

        // Update listing available quantity
        const remainingQty = parseFloat(listing.quantity) - numQty;
        const newStatus = remainingQty <= 0 ? 'sold' : 'available';
        await db.query(
            'UPDATE public.listings SET quantity = $1, status = $2, updated_at = now() WHERE id = $3',
            [Math.max(0, remainingQty), newStatus, listing.id]
        );

        const orderPayload = {
            ...order,
            payment_method: payment_method === 'cash_logged' || payment_method === 'cash' ? 'cash' : (payment_method === 'upi_bank_transfer' || payment_method === 'upi' ? 'upi' : 'escrow_wallet')
        };

        return res.status(201).json({
            success: true,
            message: 'Order created successfully.',
            order: orderPayload,
            payment
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
