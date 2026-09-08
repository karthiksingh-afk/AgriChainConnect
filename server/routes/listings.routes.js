// server/routes/listings.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireSellCapability } = require('../middleware/roleGuard');

/**
 * GET /api/listings
 * Browse active listings with optional category, crop_type, and price filters
 */
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const { category, crop_type, status = 'available', limit = 50, offset = 0 } = req.query;

        const filters = [];
        const params = [];

        if (status) {
            params.push(status);
            filters.push(`l.status = $${params.length}`);
        }
        if (category) {
            params.push(category);
            filters.push(`l.category ILIKE $${params.length}`);
        }
        if (crop_type) {
            params.push(`%${crop_type}%`);
            filters.push(`l.crop_type ILIKE $${params.length}`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

        params.push(parseInt(limit, 10));
        const limitParam = `$${params.length}`;
        params.push(parseInt(offset, 10));
        const offsetParam = `$${params.length}`;

        const query = `
            SELECT l.*,
                   l.crop_type as commodity_type,
                   l.category as variety,
                   l.quantity as quantity_quintals,
                   l.asking_price_per_unit as target_price_inr,
                   l.location as location_address,
                   u.name as seller_name, u.username as seller_username, u.role as seller_role,
                   u.mobile_number as seller_mobile, u.latitude as seller_lat, u.longitude as seller_lon,
                   COALESCE(t.aggregate_score, 80.00) as seller_trust_score,
                   COALESCE(t.star_rating, 4.00) as seller_star_rating,
                   COALESCE(t.is_high_risk, false) as seller_is_high_risk
            FROM public.listings l
            JOIN public.users u ON u.id = l.seller_id
            LEFT JOIN public.trust_scores t ON t.user_id = u.id
            ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT ${limitParam} OFFSET ${offsetParam}
        `;

        const result = await db.query(query, params);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            listings: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/listings/my
 * Returns seller's own listings
 */
router.get('/my', authenticateToken, async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT l.*,
                    l.crop_type as commodity_type,
                    l.category as variety,
                    l.quantity as quantity_quintals,
                    l.asking_price_per_unit as target_price_inr,
                    l.location as location_address
             FROM public.listings l
             WHERE l.seller_id = $1
             ORDER BY l.created_at DESC`,
            [req.user.id]
        );

        return res.status(200).json({
            success: true,
            listings: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/listings
 * Create new crop / product listing (PRD Section 4)
 * Strictly enforced: Only sell-capable roles (Farmer, Aggregator, Wholesaler, Processor, Distributor)
 * Final Retailer is strictly rejected with 403.
 */
router.post('/', authenticateToken, requireSellCapability, async (req, res, next) => {
    try {
        const {
            crop_type,
            commodity_type,
            category,
            variety,
            quantity,
            quantity_quintals,
            unit = 'quintals',
            quality_grade,
            asking_price_per_unit,
            target_price_inr,
            harvest_date = null,
            location = null,
            location_address = null,
            pickup_availability = null,
            images = [],
            stock_pool_id = null,
            processing_stage = null
        } = req.body;

        const cType = (crop_type || commodity_type || '').trim();
        const cat = (category || variety || 'Standard').trim();
        const qty = quantity !== undefined ? quantity : quantity_quintals;
        const price = asking_price_per_unit !== undefined ? asking_price_per_unit : target_price_inr;
        const loc = (location || location_address || req.user.location_address || 'Sonipat Mandi').trim();

        if (!cType || !qty || !price) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Missing required listing fields: commodity/crop type, quantity, and asking price are required.',
                    code: 'VALIDATION_ERROR'
                }
            });
        }

        const numQty = parseFloat(qty);
        const numPrice = parseFloat(price);

        if (isNaN(numQty) || numQty <= 0 || isNaN(numPrice) || numPrice <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Quantity and asking price must be positive numbers.',
                    code: 'VALIDATION_NUMERIC_ERROR'
                }
            });
        }

        const insertRes = await db.query(
            `INSERT INTO public.listings (
                seller_id, crop_type, category, quantity, unit, quality_grade,
                asking_price_per_unit, harvest_date, location, pickup_availability,
                images, stock_pool_id, processing_stage
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                req.user.id,
                cType,
                cat,
                numQty,
                unit.trim(),
                quality_grade ? quality_grade.trim() : null,
                numPrice,
                harvest_date || null,
                loc,
                pickup_availability ? pickup_availability.trim() : null,
                JSON.stringify(images),
                stock_pool_id || null,
                processing_stage || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Listing created successfully.',
            listing: insertRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/listings/:id
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT l.*,
                   u.name as seller_name, u.username as seller_username, u.role as seller_role,
                   u.mobile_number as seller_mobile, u.latitude as seller_lat, u.longitude as seller_lon,
                   COALESCE(t.aggregate_score, 80.00) as seller_trust_score,
                   COALESCE(t.star_rating, 4.00) as seller_star_rating,
                   COALESCE(t.is_high_risk, false) as seller_is_high_risk
            FROM public.listings l
            JOIN public.users u ON u.id = l.seller_id
            LEFT JOIN public.trust_scores t ON t.user_id = u.id
            WHERE l.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Listing not found.', code: 'LISTING_NOT_FOUND' }
            });
        }

        return res.status(200).json({
            success: true,
            listing: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/listings/:id
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, asking_price_per_unit, status, quality_grade, pickup_availability } = req.body;

        const checkRes = await db.query('SELECT seller_id FROM public.listings WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Listing not found.', code: 'LISTING_NOT_FOUND' }
            });
        }

        if (checkRes.rows[0].seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized: You can only edit your own listings.', code: 'FORBIDDEN_OWNERSHIP' }
            });
        }

        const updates = [];
        const params = [];

        if (quantity !== undefined) {
            params.push(parseFloat(quantity));
            updates.push(`quantity = $${params.length}`);
        }
        if (asking_price_per_unit !== undefined) {
            params.push(parseFloat(asking_price_per_unit));
            updates.push(`asking_price_per_unit = $${params.length}`);
        }
        if (status !== undefined) {
            params.push(status);
            updates.push(`status = $${params.length}`);
        }
        if (quality_grade !== undefined) {
            params.push(quality_grade);
            updates.push(`quality_grade = $${params.length}`);
        }
        if (pickup_availability !== undefined) {
            params.push(pickup_availability);
            updates.push(`pickup_availability = $${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'No fields provided for update.', code: 'NO_FIELDS_TO_UPDATE' }
            });
        }

        params.push(id);
        const query = `
            UPDATE public.listings
            SET ${updates.join(', ')}, updated_at = now()
            WHERE id = $${params.length}
            RETURNING *
        `;

        const updateRes = await db.query(query, params);

        return res.status(200).json({
            success: true,
            message: 'Listing updated.',
            listing: updateRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/listings/:id
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const checkRes = await db.query('SELECT seller_id FROM public.listings WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Listing not found.', code: 'LISTING_NOT_FOUND' }
            });
        }

        if (checkRes.rows[0].seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: { message: 'Unauthorized: You can only delete your own listings.', code: 'FORBIDDEN_OWNERSHIP' }
            });
        }

        await db.query('DELETE FROM public.listings WHERE id = $1', [id]);

        return res.status(200).json({
            success: true,
            message: 'Listing deleted successfully.'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/listings/stock-pools
 * PRD Section 4.2: Aggregator Stock Pooling
 */
router.post('/stock-pools', authenticateToken, async (req, res, next) => {
    try {
        const {
            crop_type,
            commodity_type,
            category,
            pool_name,
            quality_grade = 'Grade A',
            total_quantity,
            total_quantity_quintals,
            average_procurement_cost,
            target_price_inr,
            unit = 'quintals'
        } = req.body;

        if (req.user.role !== 'local_aggregator') {
            return res.status(403).json({
                success: false,
                error: { message: 'Stock pooling is specific to Local Aggregators.', code: 'FORBIDDEN_ROLE' }
            });
        }

        const cType = (crop_type || commodity_type || 'Wheat').trim();
        const cat = (category || pool_name || 'Standard Pool').trim();
        const qty = total_quantity !== undefined ? total_quantity : (total_quantity_quintals || 100);
        const cost = average_procurement_cost !== undefined ? average_procurement_cost : (target_price_inr || 2200);

        const resPool = await db.query(
            `INSERT INTO public.stock_pools (
                aggregator_id, crop_type, category, quality_grade,
                total_quantity, available_quantity, unit, average_procurement_cost
            ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
            RETURNING *`,
            [req.user.id, cType, cat, quality_grade, parseFloat(qty), unit, parseFloat(cost)]
        );

        const poolRow = resPool.rows[0];

        return res.status(201).json({
            success: true,
            stock_pool: poolRow,
            pool: {
                ...poolRow,
                pool_name: poolRow.category,
                commodity_type: poolRow.crop_type,
                total_quantity_quintals: poolRow.total_quantity,
                target_price_inr: poolRow.average_procurement_cost
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/listings/stock-pools
 */
router.get('/stock-pools', authenticateToken, async (req, res, next) => {
    try {
        const resPool = await db.query(
            'SELECT * FROM public.stock_pools WHERE aggregator_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );

        const mappedPools = resPool.rows.map(p => ({
            ...p,
            pool_name: p.category,
            commodity_type: p.crop_type,
            total_quantity_quintals: p.total_quantity,
            target_price_inr: p.average_procurement_cost
        }));

        return res.status(200).json({
            success: true,
            stock_pools: resPool.rows,
            pools: mappedPools
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
