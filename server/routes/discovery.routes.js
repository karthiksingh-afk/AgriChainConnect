// server/routes/discovery.routes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { discoverNearbyMembers } = require('../services/discovery.service');

/**
 * GET /api/discovery/nearby
 * PRD Section 10: Adaptive Nearby Member Discovery
 * Automatically expands search radius (10km -> 25km -> 50km -> 100km -> 200km)
 * so users are never shown "no members found".
 */
router.get('/nearby', authenticateToken, async (req, res, next) => {
    try {
        const {
            target_role,
            target_roles,
            latitude,
            longitude,
            min_trust_score = 0,
            max_distance_km
        } = req.query;

        const originLat = latitude !== undefined
            ? parseFloat(latitude)
            : (req.user.latitude ? parseFloat(req.user.latitude) : 28.6139); // default fallback lat (e.g. New Delhi)

        const originLon = longitude !== undefined
            ? parseFloat(longitude)
            : (req.user.longitude ? parseFloat(req.user.longitude) : 77.2090); // default fallback lon

        const rolesArray = target_roles
            ? target_roles.split(',').map(r => r.trim())
            : null;

        const discoveryResult = await discoverNearbyMembers({
            originLat,
            originLon,
            targetRole: target_role || null,
            targetRoles: rolesArray,
            minTrustScore: parseFloat(min_trust_score) || 0,
            maxDistanceKm: max_distance_km ? parseFloat(max_distance_km) : null
        });

        return res.status(200).json({
            success: true,
            search_origin: { latitude: originLat, longitude: originLon },
            search_radius_km: discoveryResult.search_radius_km,
            expanded: discoveryResult.expanded,
            total_found: discoveryResult.total_found,
            message: discoveryResult.message,
            members: discoveryResult.members
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
