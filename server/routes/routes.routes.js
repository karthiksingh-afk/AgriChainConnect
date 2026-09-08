// server/routes/routes.routes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSellCapability } = require('../middleware/roleGuard');
const { generateRouteRecommendation } = require('../services/routeOptimization.service');

/**
 * GET /api/routes/recommendations
 * PRD Section 8: AI Route Optimization Engine output
 * Returns optimized route, skipped-node justifications, and net profitability analysis.
 */
router.get('/recommendations', authenticateToken, requireSellCapability, async (req, res, next) => {
    try {
        const {
            crop_name = 'Wheat',
            crop_category = 'Grains & Cereals',
            quantity = 100,
            asking_price = null,
            latitude = null,
            longitude = null
        } = req.query;

        const recommendation = await generateRouteRecommendation({
            sellerId: req.user.id,
            cropCategory: crop_category,
            cropName: crop_name,
            quantity: parseFloat(quantity) || 100,
            askingPrice: asking_price ? parseFloat(asking_price) : null,
            originLat: latitude ? parseFloat(latitude) : (req.user.latitude ? parseFloat(req.user.latitude) : null),
            originLon: longitude ? parseFloat(longitude) : (req.user.longitude ? parseFloat(req.user.longitude) : null),
            preferredLanguage: req.user.preferred_language || 'en'
        });

        return res.status(200).json({
            success: true,
            recommendation
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
