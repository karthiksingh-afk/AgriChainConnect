// server/services/routeOptimization.service.js
const db = require('../config/db');
const { SUPPLY_CHAIN_TIERS, USER_ROLES } = require('../constants/roles');
const { getLocalizedText } = require('../constants/localization');
const { discoverNearbyMembers } = require('./discovery.service');

/**
 * AI Route Optimization Engine (PRD Section 8)
 * Baseline chain: Farmer -> Aggregator -> Wholesaler -> Processor -> Distributor
 * Evaluates candidate nodes against 3 ordered constraints:
 * 1. Availability Check
 * 2. Trust Score Threshold (>= 80 / 100 or 4.0 / 5.0)
 * 3. Market Price Fairness (Within -5% of Live Market Index Price)
 */
async function generateRouteRecommendation({
    sellerId,
    cropCategory = 'Grains & Cereals',
    cropName = 'Wheat',
    quantity = 100, // in quintals
    askingPrice = null,
    originLat = null,
    originLon = null,
    preferredLanguage = 'en'
}) {
    // Fetch seller info
    const sellerRes = await db.query(
        'SELECT id, role, latitude, longitude, location_address FROM public.users WHERE id = $1',
        [sellerId]
    );

    if (sellerRes.rows.length === 0) {
        throw new Error('Seller not found.');
    }

    const seller = sellerRes.rows[0];
    const sellerRole = seller.role;
    const sellerLat = originLat || (seller.latitude ? parseFloat(seller.latitude) : null);
    const sellerLon = originLon || (seller.longitude ? parseFloat(seller.longitude) : null);

    // Find current tier index in supply chain
    const currentIndex = SUPPLY_CHAIN_TIERS.indexOf(sellerRole);
    if (currentIndex === -1 || currentIndex >= SUPPLY_CHAIN_TIERS.length - 2) {
        // Distributor / Final Retailer cannot optimize downstream route in the standard chain
        return {
            seller_id: sellerId,
            source_tier: sellerRole,
            destination_tier: sellerRole,
            optimized_route: [{ tier: sellerRole, status: 'current' }],
            standard_route: [{ tier: sellerRole, status: 'current' }],
            skipped_nodes: [],
            net_profitability_analysis: {
                standard_return: 0,
                optimized_return: 0,
                transport_cost_delta: 0,
                net_gain_percentage: 0
            },
            message: 'No further downstream intermediary to optimize for this role.'
        };
    }

    // Fetch Live Market Index Price for the crop
    const marketPriceRes = await db.query(
        `SELECT modal_price, min_price, max_price, unit, currency
         FROM public.market_index_prices
         WHERE crop_name ILIKE $1 OR crop_category ILIKE $2
         ORDER BY effective_date DESC LIMIT 1`,
        [`%${cropName}%`, `%${cropCategory}%`]
    );

    const liveMarketPrice = marketPriceRes.rows.length > 0
        ? parseFloat(marketPriceRes.rows[0].modal_price)
        : 2200.00; // fallback base price

    const standardNextTier = SUPPLY_CHAIN_TIERS[currentIndex + 1];
    const skippedNodes = [];
    let chosenNextTier = null;
    let chosenBuyer = null;

    // Ordered evaluation loop from Node N+1 onward
    for (let i = currentIndex + 1; i < SUPPLY_CHAIN_TIERS.length - 1; i++) {
        const tier = SUPPLY_CHAIN_TIERS[i];

        // Constraint 1: Availability Check (via Adaptive Discovery)
        const discovery = await discoverNearbyMembers({
            originLat: sellerLat,
            originLon: sellerLon,
            targetRole: tier,
            minTrustScore: 0 // allow discovery to evaluate trust separately
        });

        if (!discovery.members || discovery.members.length === 0) {
            skippedNodes.push({
                tier,
                failed_constraint: 'availability',
                reason: getLocalizedText(preferredLanguage, 'route_justifications', 'unavailable'),
            });
            continue;
        }

        const candidate = discovery.members[0]; // Nearest candidate
        const candidateScore = parseFloat(candidate.trust_score || 80);

        // Constraint 2: Trust Score Threshold (>= 80 / 100)
        if (candidateScore < 80.00) {
            skippedNodes.push({
                tier,
                candidate_id: candidate.id,
                candidate_name: candidate.name,
                failed_constraint: 'trust_threshold',
                score: candidateScore,
                reason: getLocalizedText(preferredLanguage, 'route_justifications', 'low_trust', { score: candidateScore }),
            });
            continue;
        }

        // Constraint 3: Market Price Fairness (No lower than -5% of market index)
        // Simulated or actual offered price for the tier
        // Standard intermediary tiers typically discount: Aggregator (-8%), Wholesaler (-4%), Processor (+2% direct)
        let estimatedTierDiscount = 0;
        if (tier === USER_ROLES.LOCAL_AGGREGATOR) estimatedTierDiscount = -0.07; // -7%
        else if (tier === USER_ROLES.WHOLESALER) estimatedTierDiscount = -0.04; // -4%
        else if (tier === USER_ROLES.MANUFACTURER) estimatedTierDiscount = 0.03; // +3% premium

        const candidateOfferedPrice = liveMarketPrice * (1 + estimatedTierDiscount);
        const varianceFromMarket = ((candidateOfferedPrice - liveMarketPrice) / liveMarketPrice) * 100;

        if (varianceFromMarket < -5.0) {
            skippedNodes.push({
                tier,
                candidate_id: candidate.id,
                candidate_name: candidate.name,
                failed_constraint: 'price_fairness',
                variance: Math.abs(varianceFromMarket).toFixed(1),
                reason: getLocalizedText(preferredLanguage, 'route_justifications', 'low_price', { variance: Math.abs(varianceFromMarket).toFixed(1) }),
            });
            continue;
        }

        // Tier passed all three constraints!
        chosenNextTier = tier;
        chosenBuyer = candidate;
        break;
    }

    // If all skipped tiers exhausted, fallback to standard next tier with warning
    let isBypassActive = true;
    if (!chosenNextTier) {
        chosenNextTier = standardNextTier;
        isBypassActive = false;
    } else if (chosenNextTier === standardNextTier) {
        isBypassActive = false;
    }

    // Net Profitability Analysis
    // Standard Route: Sells to standardNextTier
    const standardUnitPrice = liveMarketPrice * 0.94; // -6% average intermediary margin
    const standardTransportCost = 25 * quantity; // ~25 Rs/quintal local transport
    const standardGrossReturn = standardUnitPrice * quantity;
    const standardNetReturn = standardGrossReturn - standardTransportCost;

    // Optimized Direct Route: Sells to chosenNextTier
    const directTierPremium = isBypassActive ? 1.05 : 0.97;
    const directUnitPrice = liveMarketPrice * directTierPremium;
    const additionalDistanceKm = isBypassActive ? 45 : 10;
    const transportRatePerKm = 1.8; // Rs per quintal-km
    const optimizedTransportCost = (25 + (additionalDistanceKm * transportRatePerKm)) * quantity;
    const optimizedGrossReturn = directUnitPrice * quantity;
    const optimizedNetReturn = optimizedGrossReturn - optimizedTransportCost;

    const netGainPercentage = Number((((optimizedNetReturn - standardNetReturn) / standardNetReturn) * 100).toFixed(2));

    const netProfitabilityAnalysis = {
        quantity_quintals: quantity,
        live_market_index_price: liveMarketPrice,
        standard_route: {
            destination_tier: standardNextTier,
            unit_price: Math.round(standardUnitPrice),
            gross_return: Math.round(standardGrossReturn),
            transport_cost: Math.round(standardTransportCost),
            net_return: Math.round(standardNetReturn),
        },
        optimized_route: {
            destination_tier: chosenNextTier,
            unit_price: Math.round(directUnitPrice),
            gross_return: Math.round(optimizedGrossReturn),
            transport_cost: Math.round(optimizedTransportCost),
            net_return: Math.round(optimizedNetReturn),
            transport_cost_delta: Math.round(optimizedTransportCost - standardTransportCost),
        },
        net_gain_amount: Math.round(optimizedNetReturn - standardNetReturn),
        net_gain_percentage: netGainPercentage,
        is_bypass_recommended: isBypassActive,
    };

    // Construct Routes
    const standardRoute = [
        { tier: sellerRole, status: 'source' },
        { tier: standardNextTier, status: 'destination' }
    ];

    const optimizedRoute = [
        { tier: sellerRole, status: 'source' }
    ];

    skippedNodes.forEach(sn => {
        optimizedRoute.push({ tier: sn.tier, status: 'skipped', reason: sn.reason, failed_constraint: sn.failed_constraint });
    });

    optimizedRoute.push({
        tier: chosenNextTier,
        status: 'recommended_destination',
        buyer_id: chosenBuyer ? chosenBuyer.id : null,
        buyer_name: chosenBuyer ? chosenBuyer.name : null,
        buyer_trust_score: chosenBuyer ? chosenBuyer.trust_score : 80
    });

    // Save recommendation to database
    await db.query(
        `INSERT INTO public.route_recommendations (
            seller_id, crop_category, source_tier, destination_tier,
            recommended_route, standard_route, skipped_nodes, net_profitability_analysis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            sellerId,
            cropCategory,
            sellerRole,
            chosenNextTier,
            JSON.stringify(optimizedRoute),
            JSON.stringify(standardRoute),
            JSON.stringify(skippedNodes),
            JSON.stringify(netProfitabilityAnalysis)
        ]
    );

    return {
        seller_id: sellerId,
        source_tier: sellerRole,
        destination_tier: chosenNextTier,
        is_bypass_recommended: isBypassActive,
        optimized_route: optimizedRoute,
        standard_route: standardRoute,
        skipped_nodes: skippedNodes,
        net_profitability_analysis: netProfitabilityAnalysis,
        live_market_price: liveMarketPrice,
    };
}

module.exports = {
    generateRouteRecommendation,
};
