// server/services/discovery.service.js
const db = require('../config/db');

/**
 * Haversine formula to calculate distance between two coordinates in kilometers.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

/**
 * Adaptive Nearby Member Discovery (PRD Section 10)
 * Automatically expands radius: 10 km -> 25 km -> 50 km -> 100 km -> 200 km
 * until matching available members are found.
 */
async function discoverNearbyMembers({
    originLat,
    originLon,
    targetRole = null,
    targetRoles = null,
    cropCategory = null,
    minTrustScore = 0,
    maxDistanceKm = null
}) {
    const expansionSteps = (process.env.EXPANSION_STEPS_KM || '10,25,50,100,200')
        .split(',')
        .map(s => parseFloat(s.trim()));

    const defaultRadius = expansionSteps[0] || 10;

    // Fetch all active, available users matching role and trust criteria
    let roleFilterClause = '';
    const queryParams = [];

    if (targetRole) {
        queryParams.push(targetRole);
        roleFilterClause = `AND u.role = $${queryParams.length}`;
    } else if (targetRoles && targetRoles.length > 0) {
        queryParams.push(targetRoles);
        roleFilterClause = `AND u.role = ANY($${queryParams.length})`;
    }

    const query = `
        SELECT 
            u.id, u.name, u.username, u.role, u.preferred_language,
            u.mobile_number, u.latitude, u.longitude, u.location_address, u.is_available,
            COALESCE(t.aggregate_score, 80.00) as trust_score,
            COALESCE(t.star_rating, 4.00) as star_rating,
            COALESCE(t.is_high_risk, false) as is_high_risk,
            COALESCE(t.is_new_member, true) as is_new_member
        FROM public.users u
        LEFT JOIN public.trust_scores t ON t.user_id = u.id
        WHERE u.is_available = true ${roleFilterClause}
    `;

    const result = await db.query(query, queryParams);
    const candidates = result.rows;

    // Filter by min trust score and calculate distances
    const membersWithDistance = candidates
        .filter(c => parseFloat(c.trust_score) >= minTrustScore)
        .map(c => {
            const distance = (originLat !== null && originLon !== null && c.latitude !== null && c.longitude !== null)
                ? calculateHaversineDistance(originLat, originLon, parseFloat(c.latitude), parseFloat(c.longitude))
                : 0; // If no coords provided, default to 0 for mock/fallback
            return {
                ...c,
                distance_km: distance
            };
        })
        .sort((a, b) => a.distance_km - b.distance_km);

    // If a maxDistanceKm is explicitly given, filter by that
    if (maxDistanceKm) {
        const filtered = membersWithDistance.filter(m => m.distance_km <= maxDistanceKm);
        return {
            members: filtered,
            search_radius_km: maxDistanceKm,
            expanded: maxDistanceKm > defaultRadius,
            total_found: filtered.length
        };
    }

    // Adaptive radius expansion
    for (const radius of expansionSteps) {
        const matches = membersWithDistance.filter(m => m.distance_km <= radius);
        if (matches.length > 0) {
            return {
                members: matches,
                search_radius_km: radius,
                expanded: radius > defaultRadius,
                total_found: matches.length,
                message: radius > defaultRadius
                    ? `Showing results up to ${radius} km — no closer matches available.`
                    : `Showing results within local ${radius} km radius.`
            };
        }
    }

    // If beyond max expansion step, return all nearest available members
    return {
        members: membersWithDistance,
        search_radius_km: expansionSteps[expansionSteps.length - 1],
        expanded: true,
        total_found: membersWithDistance.length,
        message: membersWithDistance.length > 0
            ? `Expanded beyond ${expansionSteps[expansionSteps.length - 1]} km — surfacing nearest available members.`
            : 'No available members found.'
    };
}

module.exports = {
    discoverNearbyMembers,
    calculateHaversineDistance
};
