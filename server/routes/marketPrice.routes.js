// server/routes/marketPrice.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/market-prices
 * PRD Section 8.6: Live Market Index Price feed per crop and region
 */
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const { crop_name, region, crop_category } = req.query;

        const filters = [];
        const params = [];

        if (crop_name) {
            params.push(`%${crop_name}%`);
            filters.push(`crop_name ILIKE $${params.length}`);
        }
        if (region) {
            params.push(`%${region}%`);
            filters.push(`region ILIKE $${params.length}`);
        }
        if (crop_category) {
            params.push(`%${crop_category}%`);
            filters.push(`crop_category ILIKE $${params.length}`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
        const query = `
            SELECT * FROM public.market_index_prices
            ${whereClause}
            ORDER BY effective_date DESC, crop_name ASC
        `;

        const result = await db.query(query, params);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            prices: result.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
