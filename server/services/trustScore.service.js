// server/services/trustScore.service.js
const db = require('../config/db');

/**
 * Trust Score Engine (PRD Section 9)
 * Four Weighted Pillars:
 * 1. Payment Reliability & Speed: 35%
 * 2. Order Fulfillment & Rejection Rate: 25%
 * 3. Operational Punctuality: 20%
 * 4. Community Peer Reviews: 20%
 * Threshold: 80 points (4.0 stars); below 80 is flagged "High Risk".
 */
async function recalculateTrustScore(userId, reason = 'Periodic recalculation', orderId = null) {
    try {
        // 1. Fetch user's completed/cancelled orders
        const ordersRes = await db.query(
            `SELECT id, buyer_id, seller_id, status, estimated_delivery_date, created_at, updated_at
             FROM public.orders
             WHERE buyer_id = $1 OR seller_id = $1`,
            [userId]
        );
        const orders = ordersRes.rows;
        const totalOrders = orders.length;

        // If no transactions yet, maintain neutral starting score (80.0 / 4.0 stars) with new member flag
        if (totalOrders === 0) {
            const defaultScore = 80.00;
            const defaultStar = 4.00;
            await db.query(
                `INSERT INTO public.trust_scores (
                    user_id, aggregate_score, star_rating, is_high_risk, is_new_member, total_transactions,
                    payment_reliability_score, order_fulfillment_score, operational_punctuality_score, peer_reviews_score, last_calculated_at
                ) VALUES ($1, $2, $3, false, true, 0, 80, 80, 80, 80, now())
                ON CONFLICT (user_id) DO UPDATE SET
                    aggregate_score = EXCLUDED.aggregate_score,
                    star_rating = EXCLUDED.star_rating,
                    last_calculated_at = now()`,
                [userId, defaultScore, defaultStar]
            );
            return {
                aggregate_score: defaultScore,
                star_rating: defaultStar,
                is_high_risk: false,
                is_new_member: true,
                total_transactions: 0
            };
        }

        // 2. Pillar 1: Payment Reliability & Speed (35%)
        // Deductions for disputes, cash mismatches, or delays; high score for on-time escrow release & confirmed cash
        const paymentsRes = await db.query(
            `SELECT p.id, p.payment_method, p.escrow_status, p.cash_status, p.amount
             FROM public.payments p
             WHERE p.payer_id = $1 OR p.payee_id = $1`,
            [userId]
        );
        let paymentScore = 85.0;
        let disputeCount = 0;
        let mismatchCount = 0;
        paymentsRes.rows.forEach(p => {
            if (p.escrow_status === 'disputed') disputeCount++;
            if (p.cash_status === 'mismatch') mismatchCount++;
        });
        paymentScore = Math.max(20, Math.min(100, 95 - (disputeCount * 25) - (mismatchCount * 20)));

        // 3. Pillar 2: Order Fulfillment & Rejection Rate (25%)
        // Completed orders vs. cancelled / rejected orders
        let completedCount = 0;
        let cancelledCount = 0;
        orders.forEach(o => {
            if (o.status === 'delivered') completedCount++;
            if (o.status === 'cancelled') cancelledCount++;
        });
        const fulfillmentRate = totalOrders > 0 ? (completedCount / totalOrders) : 1;
        const fulfillmentScore = Math.max(10, Math.min(100, Math.round(fulfillmentRate * 100)));

        // 4. Pillar 3: Operational Punctuality (20%)
        // Comparing delivered timestamp against estimated_delivery_date
        const punctualityRes = await db.query(
            `SELECT o.id, o.estimated_delivery_date, h.timestamp as delivered_at
             FROM public.orders o
             JOIN public.order_status_history h ON h.order_id = o.id AND h.status = 'delivered'
             WHERE (o.buyer_id = $1 OR o.seller_id = $1)`,
            [userId]
        );
        let onTimeCount = 0;
        punctualityRes.rows.forEach(r => {
            if (!r.estimated_delivery_date || new Date(r.delivered_at) <= new Date(r.estimated_delivery_date)) {
                onTimeCount++;
            }
        });
        const punctualityScore = punctualityRes.rows.length > 0
            ? Math.max(20, Math.min(100, Math.round((onTimeCount / punctualityRes.rows.length) * 100)))
            : 85.0;

        // 5. Pillar 4: Community Peer Reviews (20%)
        // Direct 1-5 star ratings converted to 0-100 scale
        const reviewsRes = await db.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM public.peer_reviews
             WHERE reviewed_user_id = $1`,
            [userId]
        );
        let reviewsScore = 80.0;
        if (reviewsRes.rows.length > 0 && reviewsRes.rows[0].review_count > 0) {
            const avgStars = parseFloat(reviewsRes.rows[0].avg_rating);
            reviewsScore = Math.round((avgStars / 5.0) * 100);
        }

        // Weighted calculation: 35% + 25% + 20% + 20%
        const aggregateScore = Number((
            (paymentScore * 0.35) +
            (fulfillmentScore * 0.25) +
            (punctualityScore * 0.20) +
            (reviewsScore * 0.20)
        ).toFixed(2));

        const starRating = Number((aggregateScore / 20).toFixed(2));
        const isHighRisk = aggregateScore < 80.00;
        const isNewMember = totalOrders < 3;

        // Update trust_scores table
        await db.query(
            `INSERT INTO public.trust_scores (
                user_id, aggregate_score, star_rating, is_high_risk, is_new_member, total_transactions,
                payment_reliability_score, order_fulfillment_score, operational_punctuality_score, peer_reviews_score, last_calculated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
            ON CONFLICT (user_id) DO UPDATE SET
                aggregate_score = EXCLUDED.aggregate_score,
                star_rating = EXCLUDED.star_rating,
                is_high_risk = EXCLUDED.is_high_risk,
                is_new_member = EXCLUDED.is_new_member,
                total_transactions = EXCLUDED.total_transactions,
                payment_reliability_score = EXCLUDED.payment_reliability_score,
                order_fulfillment_score = EXCLUDED.order_fulfillment_score,
                operational_punctuality_score = EXCLUDED.operational_punctuality_score,
                peer_reviews_score = EXCLUDED.peer_reviews_score,
                last_calculated_at = now()`,
            [
                userId, aggregateScore, starRating, isHighRisk, isNewMember, totalOrders,
                paymentScore, fulfillmentScore, punctualityScore, reviewsScore
            ]
        );

        // Record entry in trust_score_history
        await db.query(
            `INSERT INTO public.trust_score_history (
                user_id, aggregate_score, star_rating, payment_reliability_score, order_fulfillment_score,
                operational_punctuality_score, peer_reviews_score, reason, order_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                userId, aggregateScore, starRating, paymentScore, fulfillmentScore,
                punctualityScore, reviewsScore, reason, orderId
            ]
        );

        return {
            user_id: userId,
            aggregate_score: aggregateScore,
            star_rating: starRating,
            is_high_risk: isHighRisk,
            is_new_member: isNewMember,
            total_transactions: totalOrders,
            pillars: {
                payment_reliability: paymentScore,
                order_fulfillment: fulfillmentScore,
                operational_punctuality: punctualityScore,
                peer_reviews: reviewsScore,
            }
        };
    } catch (error) {
        console.error('Error recalculating trust score:', error);
        throw error;
    }
}

module.exports = {
    recalculateTrustScore,
};
