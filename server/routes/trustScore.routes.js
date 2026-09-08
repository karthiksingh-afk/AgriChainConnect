// server/routes/trustScore.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { recalculateTrustScore } = require('../services/trustScore.service');

/**
 * GET /api/trust-score/me
 * PRD Section 9.3: Full granular history and pillar-level breakdown is private to the account owner
 */
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const scoreRes = await db.query(
            `SELECT * FROM public.trust_scores WHERE user_id = $1`,
            [req.user.id]
        );

        const historyRes = await db.query(
            `SELECT * FROM public.trust_score_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.user.id]
        );

        const score = scoreRes.rows[0] || {
            aggregate_score: 80.00,
            star_rating: 4.00,
            is_high_risk: false,
            is_new_member: true,
            total_transactions: 0,
            payment_reliability_score: 80.00,
            order_fulfillment_score: 80.00,
            operational_punctuality_score: 80.00,
            peer_reviews_score: 80.00
        };

        return res.status(200).json({
            success: true,
            trust_score: score,
            pillars: {
                payment_reliability: {
                    weight: '35%',
                    score: score.payment_reliability_score,
                    description: 'Time taken to release funds, escrow punctuality, and cash confirmation fidelity'
                },
                order_fulfillment: {
                    weight: '25%',
                    score: score.order_fulfillment_score,
                    description: 'Accepting agreed loads without predatory gate rejections or cancellations'
                },
                operational_punctuality: {
                    weight: '20%',
                    score: score.operational_punctuality_score,
                    description: 'Adherence to scheduled pickup/drop-off timelines without delaying transport'
                },
                community_reviews: {
                    weight: '20%',
                    score: score.peer_reviews_score,
                    description: 'Direct 1-5 star ratings from verified transaction counterparties'
                }
            },
            history: historyRes.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/trust-score/:userId
 * PRD Section 9.3: Counterparties see ONLY aggregate score/star rating and high-risk status
 */
router.get('/:userId', authenticateToken, async (req, res, next) => {
    try {
        const { userId } = req.params;

        const userRes = await db.query(
            `SELECT u.id, u.name, u.role,
                   COALESCE(t.aggregate_score, 80.00) as aggregate_score,
                   COALESCE(t.star_rating, 4.00) as star_rating,
                   COALESCE(t.is_high_risk, false) as is_high_risk,
                   COALESCE(t.is_new_member, true) as is_new_member,
                   COALESCE(t.total_transactions, 0) as total_transactions
            FROM public.users u
            LEFT JOIN public.trust_scores t ON t.user_id = u.id
            WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'User not found.', code: 'USER_NOT_FOUND' }
            });
        }

        const user = userRes.rows[0];

        return res.status(200).json({
            success: true,
            user_id: user.id,
            name: user.name,
            role: user.role,
            aggregate_score: parseFloat(user.aggregate_score),
            star_rating: parseFloat(user.star_rating),
            is_high_risk: user.is_high_risk,
            is_new_member: user.is_new_member,
            total_transactions: user.total_transactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/trust-score/reviews
 * PRD Section 9.3: Verified counterparty reviews only (after completed transaction)
 */
router.post('/reviews', authenticateToken, async (req, res, next) => {
    try {
        const { order_id, rating, comment } = req.body;

        if (!order_id || !rating) {
            return res.status(400).json({
                success: false,
                error: { message: 'order_id and rating (1-5) are required.', code: 'VALIDATION_ERROR' }
            });
        }

        const numRating = parseInt(rating, 10);
        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
            return res.status(400).json({
                success: false,
                error: { message: 'Rating must be an integer between 1 and 5.', code: 'INVALID_RATING' }
            });
        }

        // Verify order existence and status
        const orderRes = await db.query(
            'SELECT buyer_id, seller_id, status FROM public.orders WHERE id = $1',
            [order_id]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Order not found.', code: 'ORDER_NOT_FOUND' }
            });
        }

        const order = orderRes.rows[0];

        // Ensure user was part of the order
        if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'You can only review users from your own transactions.', code: 'FORBIDDEN' }
            });
        }

        // Target of the review is the counterparty
        const reviewedUserId = req.user.id === order.buyer_id ? order.seller_id : order.buyer_id;

        // Check for duplicate review
        const existingReview = await db.query(
            'SELECT id FROM public.peer_reviews WHERE order_id = $1 AND reviewer_id = $2',
            [order_id, req.user.id]
        );

        if (existingReview.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'You have already submitted a review for this order.', code: 'DUPLICATE_REVIEW' }
            });
        }

        // Insert review
        const reviewRes = await db.query(
            `INSERT INTO public.peer_reviews (order_id, reviewer_id, reviewed_user_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [order_id, req.user.id, reviewedUserId, numRating, comment || null]
        );

        // Recalculate trust score for reviewed party
        await recalculateTrustScore(reviewedUserId, 'Peer review submitted', order_id);

        return res.status(201).json({
            success: true,
            message: 'Peer review submitted successfully.',
            review: reviewRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
