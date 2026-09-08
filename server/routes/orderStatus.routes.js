// server/routes/orderStatus.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const PaymentService = require('../services/payment.service');
const { recalculateTrustScore } = require('../services/trustScore.service');

const VALID_STATUSES = [
    'order_placed',
    'confirmed',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled'
];

/**
 * GET /api/orders/:orderId/status-history
 * PRD Section 12: Visual status tracking timeline
 */
router.get('/:orderId/status-history', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const orderRes = await db.query(
            'SELECT buyer_id, seller_id, status, estimated_delivery_date FROM public.orders WHERE id = $1',
            [orderId]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
            });
        }

        const order = orderRes.rows[0];

        if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized.', code: 'FORBIDDEN' }
            });
        }

        const historyRes = await db.query(
            `SELECT h.*, u.name as updated_by_name, u.role as updated_by_role
             FROM public.order_status_history h
             JOIN public.users u ON u.id = h.updated_by
             WHERE h.order_id = $1
             ORDER BY h.timestamp ASC`,
            [orderId]
        );

        return res.status(200).json({
            success: true,
            current_status: order.status,
            estimated_delivery_date: order.estimated_delivery_date,
            timeline: historyRes.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/orders/:orderId/status
 * PRD Section 12: Update order status along the sequential timeline
 * Sequence: order_placed -> confirmed -> packed -> shipped -> out_for_delivery -> delivered
 */
router.post('/:orderId/status', authenticateToken, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status, notes, estimated_delivery_date } = req.body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: `Invalid status. Must be one of: [${VALID_STATUSES.join(', ')}].`,
                    code: 'INVALID_STATUS'
                }
            });
        }

        const orderRes = await db.query(
            'SELECT * FROM public.orders WHERE id = $1',
            [orderId]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
            });
        }

        const order = orderRes.rows[0];

        // Authorization check: Only buyer, seller, or platform logistics can advance status
        if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized to update status for this order.', code: 'FORBIDDEN' }
            });
        }

        // Check party roles for status updates
        // 'packed', 'shipped', 'out_for_delivery' must be updated by the seller / logistics partner
        if (['packed', 'shipped', 'out_for_delivery'].includes(status) && order.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Fulfillment stages (packed, shipped, out_for_delivery) can only be marked by the seller / distributor.',
                    code: 'FORBIDDEN_STATUS_TRANSITION'
                }
            });
        }

        // Update order status and optional estimated_delivery_date
        let estDeliveryUpdate = '';
        const params = [status, orderId];
        if (estimated_delivery_date) {
            params.push(new Date(estimated_delivery_date));
            estDeliveryUpdate = `, estimated_delivery_date = $${params.length}`;
        }

        const updateOrderRes = await db.query(
            `UPDATE public.orders
             SET status = $1, updated_at = now() ${estDeliveryUpdate}
             WHERE id = $2
             RETURNING *`,
            params
        );

        // Record entry in order_status_history
        const historyRes = await db.query(
            `INSERT INTO public.order_status_history (order_id, status, notes, updated_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [orderId, status, notes || `Status updated to ${status}`, req.user.id]
        );

        // Lifecycle hook: If status is 'delivered', release escrow automatically (Section 5.1.1)
        let escrowResult = null;
        if (status === 'delivered') {
            try {
                escrowResult = await PaymentService.releaseEscrow({
                    orderId,
                    actorId: req.user.id,
                    reason: 'Automatic release upon delivery confirmation'
                });
            } catch (e) {
                console.warn('Escrow release note:', e.message);
            }

            // Recalculate trust scores for both parties
            await recalculateTrustScore(order.seller_id, 'Order delivered successfully', orderId);
            await recalculateTrustScore(order.buyer_id, 'Order completed', orderId);
        } else if (status === 'cancelled') {
            // Apply trust score penalty for cancellations
            await recalculateTrustScore(req.user.id, 'Order cancelled by user', orderId);
        }

        return res.status(200).json({
            success: true,
            message: `Order status transitioned to '${status}'.`,
            order: updateOrderRes.rows[0],
            status_history: historyRes.rows[0],
            escrow_updated: escrowResult
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
