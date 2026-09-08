// server/routes/valueDist.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/value-distribution
 * PRD Section 6: ₹100 Value Distribution Transparency Feature
 * Standardized breakdown of consumer ₹100 value across all six tiers.
 */
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const { crop_category } = req.query;

        let query = 'SELECT * FROM public.value_distributions';
        const params = [];

        if (crop_category) {
            query += ' WHERE crop_category ILIKE $1';
            params.push(`%${crop_category}%`);
        }

        query += ' ORDER BY effective_date DESC';

        const result = await db.query(query, params);

        // Identify current viewer's role for frontend highlighting (Section 6.1)
        const viewerRole = req.user ? req.user.role : null;

        const distributions = result.rows.map(row => {
            const tiers = [
                {
                    tier: 'farmer',
                    role_name: 'Farmer (Producer)',
                    share_inr: parseFloat(row.farmer_share),
                    drivers: 'Cultivation, harvesting, initial sorting',
                    is_current_user_tier: viewerRole === 'farmer'
                },
                {
                    tier: 'local_aggregator',
                    role_name: 'Local Aggregator',
                    share_inr: parseFloat(row.aggregator_share),
                    drivers: 'Local transport, aggregation, cash advance',
                    is_current_user_tier: viewerRole === 'local_aggregator'
                },
                {
                    tier: 'wholesaler',
                    role_name: 'Wholesaler / Trader',
                    share_inr: parseFloat(row.wholesaler_share),
                    drivers: 'Storage, regional transport, price risk',
                    is_current_user_tier: viewerRole === 'wholesaler'
                },
                {
                    tier: 'manufacturer',
                    role_name: 'Processor / Manufacturer',
                    share_inr: parseFloat(row.manufacturer_share),
                    drivers: 'Processing, packaging, QC, branding',
                    is_current_user_tier: viewerRole === 'manufacturer'
                },
                {
                    tier: 'distributor',
                    role_name: 'Distributor / Logistics Partner',
                    share_inr: parseFloat(row.distributor_share),
                    drivers: 'Last-mile logistics, warehousing, regional distribution',
                    is_current_user_tier: viewerRole === 'distributor'
                },
                {
                    tier: 'final_retailer',
                    role_name: 'Final Retailer',
                    share_inr: parseFloat(row.retailer_share),
                    drivers: 'Overhead, merchandising, consumer convenience',
                    is_current_user_tier: viewerRole === 'final_retailer'
                }
            ];

            const total = tiers.reduce((acc, t) => acc + t.share_inr, 0);

            return {
                id: row.id,
                crop_category: row.crop_category,
                data_source: row.data_source,
                notes: row.notes,
                effective_date: row.effective_date,
                total_value_inr: total,
                tiers
            };
        });

        return res.status(200).json({
            success: true,
            viewer_role: viewerRole,
            value_distributions: distributions,
            distributions: distributions
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
