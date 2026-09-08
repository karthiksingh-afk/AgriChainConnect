// server/routes/negotiations.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { requireBuyCapability } = require('../middleware/roleGuard');
const { negotiationRateLimiter } = require('../middleware/rateLimiter');
const PaymentService = require('../services/payment.service');

/**
 * GET /api/negotiations
 * Lists all negotiation threads for the authenticated user (as buyer or seller)
 */
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const query = `
            SELECT t.*,
                   l.crop_type, l.crop_type as commodity_type,
                   l.category, l.category as variety,
                   l.asking_price_per_unit, l.asking_price_per_unit as initial_price,
                   l.quantity as listing_quantity, l.quantity as initial_quantity,
                   b.name as buyer_name, b.role as buyer_role,
                   s.name as seller_name, s.role as seller_role,
                   (
                       SELECT json_build_object(
                           'id', o.id,
                           'sender_id', o.sender_id,
                           'proposed_price', o.proposed_price_per_unit,
                           'unit_price_inr', o.proposed_price_per_unit,
                           'proposed_quantity', o.proposed_quantity,
                           'quantity_quintals', o.proposed_quantity,
                           'payment_method', 'escrow',
                           'note', o.message,
                           'status', o.status,
                           'created_at', o.created_at
                       )
                       FROM public.negotiation_offers o
                       WHERE o.thread_id = t.id
                       ORDER BY o.created_at DESC LIMIT 1
                   ) as latest_offer
            FROM public.negotiation_threads t
            JOIN public.listings l ON l.id = t.listing_id
            JOIN public.users b ON b.id = t.buyer_id
            JOIN public.users s ON s.id = t.seller_id
            WHERE t.buyer_id = $1 OR t.seller_id = $1
            ORDER BY t.updated_at DESC
        `;

        const result = await db.query(query, [req.user.id]);

        return res.status(200).json({
            success: true,
            threads: result.rows,
            negotiations: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/negotiations
 * Initiate a new negotiation thread with initial offer
 * Strictly enforced: Only buy-capable roles can initiate (Farmer is rejected with 403)
 */
router.post('/', authenticateToken, requireBuyCapability, negotiationRateLimiter, async (req, res, next) => {
    try {
        const {
            listing_id,
            proposed_price_per_unit,
            initial_price,
            proposed_quantity,
            initial_quantity,
            message = null,
            note = null,
            pickup_terms = null,
            expires_in_hours = 6
        } = req.body;

        const price = proposed_price_per_unit !== undefined ? proposed_price_per_unit : initial_price;
        const qty = proposed_quantity !== undefined ? proposed_quantity : initial_quantity;
        const msg = message || note || 'Trade negotiation initiated';

        if (!listing_id || price === undefined || qty === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'listing_id, proposed_price_per_unit (or initial_price), and proposed_quantity (or initial_quantity) are required.',
                    code: 'VALIDATION_ERROR'
                }
            });
        }

        // Fetch listing
        const listingRes = await db.query('SELECT * FROM public.listings WHERE id = $1', [listing_id]);
        if (listingRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Listing not found.', code: 'LISTING_NOT_FOUND' }
            });
        }

        const listing = listingRes.rows[0];

        // Cannot negotiate with yourself
        if (listing.seller_id === req.user.id) {
            return res.status(400).json({
                success: false,
                error: { message: 'Cannot initiate negotiation on your own listing.', code: 'SELF_NEGOTIATION' }
            });
        }

        // Calculate expires_at
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (parseFloat(expires_in_hours) || 6));

        // Create Thread
        const threadRes = await db.query(
            `INSERT INTO public.negotiation_threads (listing_id, buyer_id, seller_id, status)
             VALUES ($1, $2, $3, 'active')
             RETURNING *`,
            [listing.id, req.user.id, listing.seller_id]
        );

        const thread = threadRes.rows[0];

        // Create Initial Offer
        const offerRes = await db.query(
            `INSERT INTO public.negotiation_offers (
                thread_id, sender_id, proposed_price_per_unit, proposed_quantity,
                message, pickup_terms, expires_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *`,
            [
                thread.id,
                req.user.id,
                parseFloat(price),
                parseFloat(qty),
                msg,
                pickup_terms,
                expiresAt
            ]
        );

        // Update listing status
        await db.query(
            "UPDATE public.listings SET status = 'offer_received', updated_at = now() WHERE id = $1 AND status = 'available'",
            [listing.id]
        );

        return res.status(201).json({
            success: true,
            message: 'Negotiation thread initiated.',
            thread,
            negotiation: thread,
            offer: offerRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/negotiations/:id
 * Retrieves full threaded negotiation history with counter-offers, counterpart trust score,
 * and live market comparison (PRD Section 5.2.2)
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const threadRes = await db.query(
            `SELECT t.*,
                   l.crop_type, l.category, l.asking_price_per_unit, l.quantity as listing_quantity, l.unit,
                   b.name as buyer_name, b.role as buyer_role,
                   s.name as seller_name, s.role as seller_role,
                   COALESCE(tb.aggregate_score, 80) as buyer_trust_score,
                   COALESCE(tb.star_rating, 4.0) as buyer_star_rating,
                   COALESCE(ts.aggregate_score, 80) as seller_trust_score,
                   COALESCE(ts.star_rating, 4.0) as seller_star_rating
            FROM public.negotiation_threads t
            JOIN public.listings l ON l.id = t.listing_id
            JOIN public.users b ON b.id = t.buyer_id
            JOIN public.users s ON s.id = t.seller_id
            LEFT JOIN public.trust_scores tb ON tb.user_id = b.id
            LEFT JOIN public.trust_scores ts ON ts.user_id = s.id
            WHERE t.id = $1`,
            [id]
        );

        if (threadRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Negotiation thread not found.', code: 'NOT_FOUND' }
            });
        }

        const thread = threadRes.rows[0];

        // Access check: only buyer or seller
        if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized to view this negotiation thread.', code: 'FORBIDDEN' }
            });
        }

        // Fetch all offers in chronological order
        const offersRes = await db.query(
            `SELECT o.*, u.name as sender_name, u.role as sender_role
             FROM public.negotiation_offers o
             JOIN public.users u ON u.id = o.sender_id
             WHERE o.thread_id = $1
             ORDER BY o.created_at ASC`,
            [id]
        );

        // Fetch Live Market Index comparison (PRD Section 5.2.2)
        const marketRes = await db.query(
            `SELECT modal_price, unit, currency
             FROM public.market_index_prices
             WHERE crop_name ILIKE $1 OR crop_category ILIKE $2
             ORDER BY effective_date DESC LIMIT 1`,
            [`%${thread.crop_type}%`, `%${thread.category}%`]
        );

        const marketPrice = marketRes.rows.length > 0 ? parseFloat(marketRes.rows[0].modal_price) : null;

        return res.status(200).json({
            success: true,
            thread,
            negotiation: thread,
            offers: offersRes.rows.map(o => ({
                ...o,
                unit_price_inr: parseFloat(o.proposed_price_per_unit),
                quantity_quintals: parseFloat(o.proposed_quantity),
                payment_method: o.payment_method || 'escrow',
                note: o.message || o.counter_terms
            })),
            live_market_price: marketPrice,
            counterparty: req.user.id === thread.buyer_id
                ? { id: thread.seller_id, name: thread.seller_name, role: thread.seller_role, trust_score: thread.seller_trust_score, star_rating: thread.seller_star_rating }
                : { id: thread.buyer_id, name: thread.buyer_name, role: thread.buyer_role, trust_score: thread.buyer_trust_score, star_rating: thread.buyer_star_rating }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/negotiations/:id/offers
 * Submit a counter-offer
 */
router.post('/:id/offers', authenticateToken, negotiationRateLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            proposed_price_per_unit,
            unit_price_inr,
            proposed_quantity,
            quantity_quintals,
            message,
            note,
            payment_method = 'escrow',
            pickup_terms,
            expires_in_hours = 6
        } = req.body;

        const price = proposed_price_per_unit !== undefined ? proposed_price_per_unit : unit_price_inr;
        const qty = proposed_quantity !== undefined ? proposed_quantity : quantity_quintals;
        const msg = message || note || 'Counter-offer proposed';

        if (price === undefined || qty === undefined) {
            return res.status(400).json({
                success: false,
                error: { message: 'Price and quantity are required for counter-offer.', code: 'VALIDATION_ERROR' }
            });
        }

        const threadRes = await db.query('SELECT * FROM public.negotiation_threads WHERE id = $1', [id]);
        if (threadRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Negotiation thread not found.', code: 'NOT_FOUND' }
            });
        }

        const thread = threadRes.rows[0];

        if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized to participate in this negotiation.', code: 'FORBIDDEN' }
            });
        }

        if (thread.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: { message: `Cannot submit offer: thread is already ${thread.status}.`, code: 'THREAD_NOT_ACTIVE' }
            });
        }

        // Mark previous pending offers in this thread as 'countered'
        await db.query(
            "UPDATE public.negotiation_offers SET status = 'countered' WHERE thread_id = $1 AND status = 'pending'",
            [id]
        );

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (parseFloat(expires_in_hours) || 6));

        // Insert new counter-offer
        const insertRes = await db.query(
            `INSERT INTO public.negotiation_offers (
                thread_id, sender_id, proposed_price_per_unit, proposed_quantity,
                message, pickup_terms, expires_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *`,
            [
                id,
                req.user.id,
                parseFloat(price),
                parseFloat(qty),
                msg,
                pickup_terms || null,
                expiresAt
            ]
        );

        await db.query('UPDATE public.negotiation_threads SET updated_at = now() WHERE id = $1', [id]);

        return res.status(201).json({
            success: true,
            message: 'Counter-offer submitted successfully.',
            offer: insertRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/negotiations/:id/accept
 * PRD Section 5.2.1: Once accepted, the offer converts into a confirmed Order
 */
router.post('/:id/accept', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { offer_id, payment_method = 'escrow_wallet' } = req.body;

        const threadRes = await db.query(
            `SELECT t.*, l.asking_price_per_unit, l.quantity as listing_qty
             FROM public.negotiation_threads t
             JOIN public.listings l ON l.id = t.listing_id
             WHERE t.id = $1`,
            [id]
        );

        if (threadRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Thread not found.', code: 'NOT_FOUND' }
            });
        }

        const thread = threadRes.rows[0];

        if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized.', code: 'FORBIDDEN' }
            });
        }

        // Fetch offer to accept (latest pending or specified offer_id)
        let offerQuery = 'SELECT * FROM public.negotiation_offers WHERE thread_id = $1';
        const params = [id];
        if (offer_id) {
            offerQuery += ' AND id = $2';
            params.push(offer_id);
        } else {
            offerQuery += " AND status = 'pending' ORDER BY created_at DESC LIMIT 1";
        }

        const offerRes = await db.query(offerQuery, params);
        if (offerRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'No valid offer found to accept.', code: 'OFFER_NOT_FOUND' }
            });
        }

        const acceptedOffer = offerRes.rows[0];

        // Check if offer is expired
        if (acceptedOffer.expires_at && new Date(acceptedOffer.expires_at) < new Date()) {
            await db.query("UPDATE public.negotiation_offers SET status = 'expired' WHERE id = $1", [acceptedOffer.id]);
            return res.status(400).json({
                success: false,
                error: { message: 'This offer has expired.', code: 'OFFER_EXPIRED' }
            });
        }

        // 1. Mark accepted offer and thread
        await db.query("UPDATE public.negotiation_offers SET status = 'accepted' WHERE id = $1", [acceptedOffer.id]);
        await db.query("UPDATE public.negotiation_threads SET status = 'accepted', updated_at = now() WHERE id = $1", [id]);

        const totalAmount = parseFloat(acceptedOffer.proposed_price_per_unit) * parseFloat(acceptedOffer.proposed_quantity);

        // 2. Convert to confirmed Order (PRD Section 5.2.1, Section 12)
        const estDelivery = new Date();
        estDelivery.setDate(estDelivery.getDate() + 3); // default 3-day window

        const orderRes = await db.query(
            `INSERT INTO public.orders (
                buyer_id, seller_id, listing_id, negotiation_thread_id, accepted_offer_id,
                quantity, unit_price, total_amount, currency, status, estimated_delivery_date,
                pickup_dropoff_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INR', 'confirmed', $9, $10)
            RETURNING *`,
            [
                thread.buyer_id,
                thread.seller_id,
                thread.listing_id,
                thread.id,
                acceptedOffer.id,
                acceptedOffer.proposed_quantity,
                acceptedOffer.proposed_price_per_unit,
                totalAmount,
                estDelivery,
                acceptedOffer.pickup_terms
            ]
        );

        const order = orderRes.rows[0];

        // 3. Record order status timeline: order_placed and confirmed
        await db.query(
            `INSERT INTO public.order_status_history (order_id, status, notes, updated_by)
             VALUES ($1, 'order_placed', 'Order created from accepted negotiation offer', $2),
                    ($1, 'confirmed', 'Order confirmed by parties', $2)`,
            [order.id, req.user.id]
        );

        // 4. Initialize Payment Record (Escrow / Cash / Digital)
        const payment = await PaymentService.initializePayment({
            orderId: order.id,
            payerId: thread.buyer_id,
            payeeId: thread.seller_id,
            amount: totalAmount,
            paymentMethod: payment_method
        });

        // 5. Update listing quantity and status dynamically
        const listQRes = await db.query('SELECT quantity FROM public.listings WHERE id = $1', [thread.listing_id]);
        if (listQRes.rows.length > 0) {
            const currentListingQty = parseFloat(listQRes.rows[0].quantity);
            const remainingQty = Math.max(0, currentListingQty - parseFloat(acceptedOffer.proposed_quantity));
            const newStatus = remainingQty <= 0 ? 'sold' : 'available';
            await db.query(
                "UPDATE public.listings SET quantity = $1, status = $2, updated_at = now() WHERE id = $3",
                [remainingQty, newStatus, thread.listing_id]
            );
        }

        const orderPayload = {
            ...order,
            payment_method: payment_method === 'cash_logged' || payment_method === 'cash' ? 'cash' : (payment_method === 'upi_bank_transfer' || payment_method === 'upi' ? 'upi' : 'escrow_wallet')
        };

        return res.status(200).json({
            success: true,
            message: 'Offer accepted and confirmed Order created.',
            order: orderPayload,
            payment,
            accepted_offer: acceptedOffer
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/negotiations/:id/reject
 */
router.post('/:id/reject', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const threadRes = await db.query('SELECT * FROM public.negotiation_threads WHERE id = $1', [id]);
        if (threadRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Thread not found.', code: 'NOT_FOUND' }
            });
        }

        const thread = threadRes.rows[0];
        if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized.', code: 'FORBIDDEN' }
            });
        }

        await db.query("UPDATE public.negotiation_threads SET status = 'rejected', updated_at = now() WHERE id = $1", [id]);
        await db.query("UPDATE public.negotiation_offers SET status = 'rejected' WHERE thread_id = $1 AND status = 'pending'", [id]);

        return res.status(200).json({
            success: true,
            message: 'Negotiation rejected.'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
