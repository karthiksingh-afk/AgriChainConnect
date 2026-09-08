// tests/test_suite.js
/**
 * AgriChain Connect Backend Comprehensive Test Suite
 * Tests every endpoint for positive cases, negative cases, edge cases,
 * role-based authorization, database CRUD, RLS integrity, and business logic.
 */

const http = require('http');
const app = require('../server/index');
const db = require('../server/config/db');

const PORT = 5099;
let server;
const BASE_URL = `http://localhost:${PORT}/api`;

let passedCount = 0;
let failedCount = 0;
const testResults = [];

function assert(condition, testName, details = '') {
    if (condition) {
        passedCount++;
        console.log(`  ✅ PASS: ${testName}`);
        testResults.push({ name: testName, status: 'PASS' });
    } else {
        failedCount++;
        console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
        testResults.push({ name: testName, status: 'FAIL', details });
    }
}

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data;
    try {
        data = await res.json();
    } catch (e) {
        data = null;
    }

    return { status: res.status, data };
}

async function runAllTests() {
    console.log('\n🌾 =======================================================');
    console.log('🌾 STARTING COMPREHENSIVE AGRISHAIN CONNECT TEST SUITE');
    console.log('🌾 =======================================================\n');

    // Start test server
    server = app.listen(PORT);
    await new Promise(r => setTimeout(r, 500));

    try {
        // Unique run timestamp to ensure distinct usernames
        const ts = Date.now().toString().slice(-6);

        // -------------------------------------------------------------
        // 1. HEALTH CHECK & DATABASE CONNECTIVITY
        // -------------------------------------------------------------
        console.log('\n--- 1. Health Check & Database Connectivity ---');
        const health = await request('/health');
        assert(health.status === 200, 'Health check returns 200 OK');
        assert(health.data.database === 'healthy', 'Database connection reports healthy');

        // -------------------------------------------------------------
        // 2. USER REGISTRATION (Section 11.3.1)
        // -------------------------------------------------------------
        console.log('\n--- 2. User Registration (Positive & Negative Cases) ---');
        
        // Farmer (sell-only)
        const farmerReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Ramesh Patel',
                username: `farmer_ramesh_${ts}`,
                password: 'FarmerSecurePassword123!',
                mobile_number: '+919876543210',
                role: 'farmer',
                preferred_language: 'hi',
                latitude: 28.7041,
                longitude: 77.1025,
                location_address: 'Sonipat, Haryana'
            }
        });
        assert(farmerReg.status === 201, 'Farmer registration successful (201)');
        assert(farmerReg.data.user.role === 'farmer', 'Farmer role stored correctly');
        assert(farmerReg.data.token, 'JWT token returned on registration');
        const farmerToken = farmerReg.data.token;
        const farmerUser = farmerReg.data.user;

        // Local Aggregator (dual-sided)
        const aggReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Gurpreet Singh',
                username: `aggregator_gurpreet_${ts}`,
                password: 'AggregatorSecurePassword123!',
                mobile_number: '+919876543211',
                role: 'local_aggregator',
                preferred_language: 'pa',
                latitude: 28.7141,
                longitude: 77.1125,
                location_address: 'Sonipat Mandi, Haryana'
            }
        });
        assert(aggReg.status === 201, 'Aggregator registration successful (201)');
        const aggToken = aggReg.data.token;
        const aggUser = aggReg.data.user;

        // Wholesaler (dual-sided)
        const wsReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Vikram Mehta',
                username: `wholesaler_vikram_${ts}`,
                password: 'WholesalerSecurePassword123!',
                mobile_number: '+919876543212',
                role: 'wholesaler',
                preferred_language: 'en',
                latitude: 28.6500,
                longitude: 77.2200,
                location_address: 'Azadpur Mandi, Delhi'
            }
        });
        assert(wsReg.status === 201, 'Wholesaler registration successful (201)');
        const wsToken = wsReg.data.token;
        const wsUser = wsReg.data.user;

        // Manufacturer / Processor (dual-sided)
        const mfgReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Shree Agro Foods',
                username: `mfg_shree_${ts}`,
                password: 'ProcessorSecurePassword123!',
                mobile_number: '+919876543213',
                role: 'manufacturer',
                preferred_language: 'mr',
                latitude: 28.5355,
                longitude: 77.3910,
                location_address: 'Noida Food Park, UP'
            }
        });
        assert(mfgReg.status === 201, 'Manufacturer registration successful (201)');
        const mfgToken = mfgReg.data.token;
        const mfgUser = mfgReg.data.user;

        // Distributor (dual-sided)
        const distReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Express Agri Logistics',
                username: `dist_express_${ts}`,
                password: 'DistributorSecurePassword123!',
                mobile_number: '+919876543214',
                role: 'distributor',
                preferred_language: 'en',
                latitude: 28.6000,
                longitude: 77.3000,
                location_address: 'Ghaziabad Hub, UP'
            }
        });
        assert(distReg.status === 201, 'Distributor registration successful (201)');
        const distToken = distReg.data.token;
        const distUser = distReg.data.user;

        // Final Retailer (buy-only)
        const retReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Modern Grocery Mart',
                username: `retailer_modern_${ts}`,
                password: 'RetailerSecurePassword123!',
                mobile_number: '+919876543215',
                role: 'final_retailer',
                preferred_language: 'hi',
                latitude: 28.5800,
                longitude: 77.3200,
                location_address: 'Indirapuram Retail, Ghaziabad'
            }
        });
        assert(retReg.status === 201, 'Retailer registration successful (201)');
        const retToken = retReg.data.token;
        const retUser = retReg.data.user;

        // Negative Registration 1: Duplicate username check (Exact message check from PRD Section 11.3.1)
        const dupReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Duplicate User',
                username: `farmer_ramesh_${ts}`, // duplicate!
                password: 'Password123!',
                mobile_number: '+919999999999',
                role: 'farmer'
            }
        });
        assert(dupReg.status === 400, 'Duplicate username returns 400 Bad Request');
        assert(
            dupReg.data.error.message === 'Username already exists. Please choose another username',
            'Exact rejection message returned for duplicate username per Section 11.3.1'
        );

        // Negative Registration 2: Invalid role (free text rejection per Section 11.5)
        const invalidRoleReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Invalid Role User',
                username: `invalid_role_${ts}`,
                password: 'Password123!',
                mobile_number: '+919999999998',
                role: 'middleman_broker' // not in controlled enum!
            }
        });
        assert(invalidRoleReg.status === 400, 'Free-text role rejected with 400 Bad Request');

        // Negative Registration 3: Missing required fields
        const missingFieldReg = await request('/auth/register', {
            method: 'POST',
            body: {
                name: 'Incomplete User',
                username: `incomplete_${ts}`
                // missing password, mobile, role
            }
        });
        assert(missingFieldReg.status === 400, 'Missing required fields rejected with 400');

        // -------------------------------------------------------------
        // 3. AUTHENTICATION & LOGIN (Section 11.3.2)
        // -------------------------------------------------------------
        console.log('\n--- 3. Authentication & Login (Positive & Negative Cases) ---');

        // Positive Login
        const loginSuccess = await request('/auth/login', {
            method: 'POST',
            body: {
                username: `farmer_ramesh_${ts}`,
                password: 'FarmerSecurePassword123!'
            }
        });
        assert(loginSuccess.status === 200, 'Valid login returns 200 OK');
        assert(loginSuccess.data.user.role === 'farmer', 'Role correctly retrieved from database on login');

        // Negative Login 1: Wrong password (Generic error check - Section 11.3.2)
        const wrongPassLogin = await request('/auth/login', {
            method: 'POST',
            body: {
                username: `farmer_ramesh_${ts}`,
                password: 'WrongPassword999!'
            }
        });
        assert(wrongPassLogin.status === 401, 'Wrong password returns 401 Unauthorized');
        assert(
            wrongPassLogin.data.error.message === 'Invalid username or password. Please check your credentials and try again',
            'Generic error message for wrong password prevents enumeration'
        );

        // Negative Login 2: Non-existent username (Must return identical generic error!)
        const nonExistentLogin = await request('/auth/login', {
            method: 'POST',
            body: {
                username: `non_existent_ghost_${ts}`,
                password: 'SomePassword123!'
            }
        });
        assert(nonExistentLogin.status === 401, 'Non-existent user returns 401 Unauthorized');
        assert(
            nonExistentLogin.data.error.message === 'Invalid username or password. Please check your credentials and try again',
            'Identical generic error for non-existent user prevents username enumeration'
        );

        // GET /auth/me
        const meRes = await request('/auth/me', {
            headers: { Authorization: `Bearer ${farmerToken}` }
        });
        assert(meRes.status === 200, 'GET /api/auth/me returns authenticated user details');
        assert(meRes.data.user.username === `farmer_ramesh_${ts}`, 'Correct user in /auth/me');

        // -------------------------------------------------------------
        // 4. USER PROFILE & LANGUAGE PERSISTENCE (Section 7)
        // -------------------------------------------------------------
        console.log('\n--- 4. Profile Management & Multilingual Persistence ---');
        
        // Language update
        const langUpdate = await request('/user/language', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { preferred_language: 'pa' }
        });
        assert(langUpdate.status === 200, 'Language update to Punjabi returns 200');
        assert(langUpdate.data.user.preferred_language === 'pa', 'Preferred language updated in DB');

        // Invalid language rejection
        const invalidLang = await request('/user/language', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { preferred_language: 'fr' } // French not supported
        });
        assert(invalidLang.status === 400, 'Unsupported language rejected with 400');

        // Profile update
        const profileUpdate = await request('/user/profile', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: {
                name: 'Ramesh Patel (Verified)',
                location_address: 'Sonipat Village Green Farm, Haryana'
            }
        });
        assert(profileUpdate.status === 200, 'Profile update returns 200');
        assert(profileUpdate.data.profile.name === 'Ramesh Patel (Verified)', 'Name updated');

        // -------------------------------------------------------------
        // 5. ROLE-SPECIFIC LISTING & PROCUREMENT LOGIC (Section 4)
        // -------------------------------------------------------------
        console.log('\n--- 5. Role-Specific Listing & Procurement Logic ---');

        // Farmer creates listing (Allowed: sell-capable)
        const farmerListing = await request('/listings', {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: {
                crop_type: 'Sharbati Wheat',
                category: 'Grains & Cereals',
                quantity: 50,
                unit: 'quintal',
                quality_grade: 'Grade A Premium',
                asking_price_per_unit: 2350,
                harvest_date: '2026-04-15',
                pickup_availability: 'Immediate Farmgate Pickup'
            }
        });
        assert(farmerListing.status === 201, 'Farmer can create sell listing (201 Created)');
        assert(farmerListing.data.listing.crop_type === 'Sharbati Wheat', 'Listing details preserved');
        const listingId = farmerListing.data.listing.id;

        // Final Retailer attempts to create sell listing (Must be strictly rejected with 403!)
        const retailerListingAttempt = await request('/listings', {
            method: 'POST',
            headers: { Authorization: `Bearer ${retToken}` }, // Final Retailer
            body: {
                crop_type: 'Atta Flour',
                category: 'Processed Goods',
                quantity: 10,
                asking_price_per_unit: 3000
            }
        });
        assert(
            retailerListingAttempt.status === 403,
            'Final Retailer blocked from creating sell listing (403 Forbidden enforced server-side per Section 4.6)'
        );

        // Aggregator stock pooling (PRD Section 4.2)
        const stockPool = await request('/listings/stock-pools', {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: {
                crop_type: 'Wheat',
                category: 'Grains & Cereals',
                quality_grade: 'Grade A',
                total_quantity: 200,
                average_procurement_cost: 2150,
                unit: 'quintal'
            }
        });
        assert(stockPool.status === 201, 'Aggregator can create pooled stock inventory (201 Created)');

        // Final Retailer attempts stock pooling (Forbidden)
        const retailerPoolAttempt = await request('/listings/stock-pools', {
            method: 'POST',
            headers: { Authorization: `Bearer ${retToken}` },
            body: { crop_type: 'Wheat', category: 'Grains', quality_grade: 'A', total_quantity: 10, average_procurement_cost: 100 }
        });
        assert(retailerPoolAttempt.status === 403, 'Retailer blocked from stock pooling (403 Forbidden)');

        // -------------------------------------------------------------
        // 6. NEGOTIATION & COUNTER-OFFER ENGINE (Section 5.2)
        // -------------------------------------------------------------
        console.log('\n--- 6. Negotiation & Counter-Offer Engine ---');

        // Aggregator initiates negotiation on Farmer listing (Allowed: buy-capable)
        const initNeg = await request('/negotiations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: {
                listing_id: listingId,
                proposed_price_per_unit: 2200, // Asking was 2350
                proposed_quantity: 40,
                message: 'Can pick up tomorrow morning with cash/escrow.',
                pickup_terms: 'Farmgate loading included',
                expires_in_hours: 12
            }
        });
        assert(initNeg.status === 201, 'Aggregator initiates negotiation thread (201 Created)');
        const threadId = initNeg.data.thread.id;
        const firstOfferId = initNeg.data.offer.id;

        // Farmer attempts to initiate a buy negotiation (Must be rejected with 403 per Section 4.1!)
        const farmerBuyAttempt = await request('/negotiations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` }, // Farmer has no buy capability!
            body: {
                listing_id: listingId,
                proposed_price_per_unit: 2000,
                proposed_quantity: 10
            }
        });
        assert(
            farmerBuyAttempt.status === 403,
            'Farmer blocked from initiating buy negotiation (403 Forbidden enforced server-side per Section 4.1)'
        );

        // Farmer submits a counter-offer in the active thread
        const counterOffer = await request(`/negotiations/${threadId}/offers`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: {
                proposed_price_per_unit: 2280, // Counter-offer price
                proposed_quantity: 40,
                message: '2200 is too low for Grade A. I can do 2280.',
                expires_in_hours: 6
            }
        });
        assert(counterOffer.status === 201, 'Farmer submits counter-offer (201 Created)');
        const counterOfferId = counterOffer.data.offer.id;

        // View Thread Details & History (Section 5.2.2)
        const threadDetails = await request(`/negotiations/${threadId}`, {
            headers: { Authorization: `Bearer ${aggToken}` }
        });
        assert(threadDetails.status === 200, 'Negotiation thread details retrieved (200 OK)');
        assert(threadDetails.data.offers.length >= 2, 'Thread contains full chronological offer history');
        assert(threadDetails.data.live_market_price !== null, 'Live Market Index comparison returned with thread');

        // Aggregator accepts the counter-offer -> Converts into confirmed Order (Section 5.2.1)
        const acceptOffer = await request(`/negotiations/${threadId}/accept`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: {
                offer_id: counterOfferId,
                payment_method: 'escrow_wallet'
            }
        });
        assert(acceptOffer.status === 200, 'Offer accepted and Order generated (200 OK)');
        assert(acceptOffer.data.order.status === 'confirmed', 'Order created in confirmed status');
        assert(parseFloat(acceptOffer.data.order.total_amount) === 40 * 2280, 'Order total matches accepted terms');
        const orderId = acceptOffer.data.order.id;

        // -------------------------------------------------------------
        // 7. ORDER STATUS TRACKING (Section 12)
        // -------------------------------------------------------------
        console.log('\n--- 7. Order Status Tracking (Exact Lifecycle Flow) ---');

        // Fetch initial status history
        const statusHistoryInit = await request(`/orders/${orderId}/status-history`, {
            headers: { Authorization: `Bearer ${aggToken}` }
        });
        assert(statusHistoryInit.status === 200, 'Status history timeline retrieved (200 OK)');
        assert(statusHistoryInit.data.timeline.length >= 2, 'order_placed and confirmed recorded on creation');

        // Farmer updates status: 'packed'
        const packedRes = await request(`/orders/${orderId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { status: 'packed', notes: 'Grain bags packed and weighed.' }
        });
        assert(packedRes.status === 200, "Transition to 'packed' successful");

        // Buyer (Aggregator) attempts to mark 'shipped' (Forbidden: only seller/logistics can mark dispatched!)
        const buyerShippedAttempt = await request(`/orders/${orderId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: { status: 'shipped' }
        });
        assert(buyerShippedAttempt.status === 403, 'Buyer forbidden from marking fulfillment stages (403)');

        // Farmer updates status: 'shipped'
        const shippedRes = await request(`/orders/${orderId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { status: 'shipped', notes: 'Truck dispatched from farmgate.' }
        });
        assert(shippedRes.status === 200, "Transition to 'shipped' successful");

        // Farmer updates status: 'out_for_delivery'
        const outForDelRes = await request(`/orders/${orderId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { status: 'out_for_delivery', notes: 'Arrived at destination mandi gate.' }
        });
        assert(outForDelRes.status === 200, "Transition to 'out_for_delivery' successful");

        // Buyer confirms: 'delivered' (Triggers escrow release & trust score update)
        const deliveredRes = await request(`/orders/${orderId}/status`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: { status: 'delivered', notes: 'Goods received and verified at warehouse.' }
        });
        assert(deliveredRes.status === 200, "Transition to 'delivered' successful");
        assert(deliveredRes.data.escrow_updated.escrow_status === 'released', 'Escrow auto-released on delivery confirmation');

        // -------------------------------------------------------------
        // 8. PAYMENTS & CASH DUAL-CONFIRMATION (Section 5.1)
        // -------------------------------------------------------------
        console.log('\n--- 8. Payments & Cash Logging with Mismatch Detection ---');

        // Create a separate order with 'cash_logged' payment method
        const cashOrderRes = await request('/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${wsToken}` }, // Wholesaler buying
            body: {
                listing_id: listingId,
                quantity: 5,
                payment_method: 'cash_logged'
            }
        });
        assert(cashOrderRes.status === 201, 'Cash-logged order created (201 Created)');
        const cashOrderId = cashOrderRes.data.order.id;

        // Seller logs cash payment received (₹10,000)
        const sellerCashLog = await request(`/payments/${cashOrderId}/cash/log`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${farmerToken}` },
            body: { amount: 10000, date: new Date().toISOString() }
        });
        assert(sellerCashLog.status === 200, 'Seller logged cash payment (200 OK)');
        assert(sellerCashLog.data.status === 'pending_confirmation', 'Cash status is pending buyer confirmation');

        // Buyer logs MISMATCHED amount (₹8,000 instead of ₹10,000)
        const buyerCashMismatch = await request(`/payments/${cashOrderId}/cash/confirm`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${wsToken}` },
            body: { amount: 8000, date: new Date().toISOString() }
        });
        assert(buyerCashMismatch.status === 200, 'Buyer cash confirmation endpoint responded');
        assert(
            buyerCashMismatch.data.status === 'mismatch',
            'Cash mismatch detected and flagged as mismatch per Section 5.1.2'
        );

        // Buyer corrects the amount to match (₹10,000)
        const buyerCashMatch = await request(`/payments/${cashOrderId}/cash/confirm`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${wsToken}` },
            body: { amount: 10000, date: new Date().toISOString() }
        });
        assert(buyerCashMatch.data.status === 'confirmed_match', 'Matching cash amount updates status to confirmed_match');

        // -------------------------------------------------------------
        // 9. TRUST SCORE ENGINE & PEER REVIEWS (Section 9)
        // -------------------------------------------------------------
        console.log('\n--- 9. Trust Score Engine & Verified Peer Reviews ---');

        // Account owner checks own trust score (Private detailed view with 4 pillars - Section 9.3)
        const ownTrust = await request('/trust-score/me', {
            headers: { Authorization: `Bearer ${farmerToken}` }
        });
        assert(ownTrust.status === 200, 'Owner can retrieve private trust score details');
        assert(ownTrust.data.pillars.payment_reliability.weight === '35%', 'Pillar 1 has 35% weight');
        assert(ownTrust.data.pillars.order_fulfillment.weight === '25%', 'Pillar 2 has 25% weight');
        assert(ownTrust.data.pillars.operational_punctuality.weight === '20%', 'Pillar 3 has 20% weight');
        assert(ownTrust.data.pillars.community_reviews.weight === '20%', 'Pillar 4 has 20% weight');

        // Counterparty checks farmer trust score (Public aggregate view only - Section 9.3)
        const counterpartyTrust = await request(`/trust-score/${farmerUser.id}`, {
            headers: { Authorization: `Bearer ${aggToken}` }
        });
        assert(counterpartyTrust.status === 200, 'Counterparty can view aggregate trust score');
        assert(counterpartyTrust.data.aggregate_score !== undefined, 'Aggregate score visible');
        assert(counterpartyTrust.data.pillars === undefined, 'Pillar details hidden from counterparty per Section 9.3');

        // Submit verified peer review post-transaction (Section 9.3)
        const peerReview = await request('/trust-score/reviews', {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: {
                order_id: orderId,
                rating: 5,
                comment: 'High quality grain, prompt loading at farmgate.'
            }
        });
        assert(peerReview.status === 201, 'Verified transaction counterparty can submit peer review (201)');

        // Negative: Duplicate review on same order
        const dupReview = await request('/trust-score/reviews', {
            method: 'POST',
            headers: { Authorization: `Bearer ${aggToken}` },
            body: { order_id: orderId, rating: 4, comment: 'Duplicate attempt' }
        });
        assert(dupReview.status === 400, 'Duplicate review rejected with 400');

        // -------------------------------------------------------------
        // 10. AI ROUTE OPTIMIZATION ENGINE (Section 8)
        // -------------------------------------------------------------
        console.log('\n--- 10. AI Route Optimization Engine ---');

        const routeRec = await request('/routes/recommendations?crop_name=Wheat&crop_category=Grains%20%26%20Cereals&quantity=100', {
            headers: { Authorization: `Bearer ${farmerToken}` }
        });
        assert(routeRec.status === 200, 'AI Route Recommendations endpoint returns 200 OK');
        assert(routeRec.data.recommendation.optimized_route, 'Optimized route returned');
        assert(routeRec.data.recommendation.net_profitability_analysis, 'Net profitability analysis returned');
        assert(
            routeRec.data.recommendation.net_profitability_analysis.standard_route &&
            routeRec.data.recommendation.net_profitability_analysis.optimized_route,
            'Side-by-side standard vs optimized route profitability comparison included'
        );

        // Final Retailer attempts route recommendations (Must be rejected: buy-only role does not sell downstream)
        const retailerRouteAttempt = await request('/routes/recommendations', {
            headers: { Authorization: `Bearer ${retToken}` }
        });
        assert(retailerRouteAttempt.status === 403, 'Final Retailer blocked from sell-side route optimization (403)');

        // -------------------------------------------------------------
        // 11. ADAPTIVE NEARBY MEMBER DISCOVERY (Section 10)
        // -------------------------------------------------------------
        console.log('\n--- 11. Adaptive Nearby Member Discovery ---');

        const nearby = await request('/discovery/nearby?target_role=local_aggregator&latitude=28.7041&longitude=77.1025', {
            headers: { Authorization: `Bearer ${farmerToken}` }
        });
        assert(nearby.status === 200, 'Nearby discovery returns 200 OK');
        assert(Array.isArray(nearby.data.members), 'Members list returned');
        assert(nearby.data.search_radius_km !== undefined, 'Search radius returned with adaptive expansion');

        // -------------------------------------------------------------
        // 12. ₹100 VALUE DISTRIBUTION DATASET (Section 6)
        // -------------------------------------------------------------
        console.log('\n--- 12. ₹100 Value Distribution Transparency Dataset ---');

        const valueDist = await request('/value-distribution', {
            headers: { Authorization: `Bearer ${farmerToken}` }
        });
        assert(valueDist.status === 200, 'Value distribution returns 200 OK');
        assert(valueDist.data.value_distributions.length > 0, 'Value distribution dataset populated');
        const benchmark = valueDist.data.value_distributions[0];
        assert(benchmark.total_value_inr === 100.00, 'All six tier shares sum to exactly ₹100.00');
        const farmerTier = benchmark.tiers.find(t => t.tier === 'farmer');
        assert(farmerTier.is_current_user_tier === true, 'Viewer tier highlighted correctly');

        // -------------------------------------------------------------
        // 13. LIVE MARKET INDEX PRICES (Section 8.6)
        // -------------------------------------------------------------
        console.log('\n--- 13. Live Market Index Prices ---');

        const marketPrices = await request('/market-prices');
        assert(marketPrices.status === 200, 'Market prices returns 200 OK');
        assert(marketPrices.data.prices.length > 0, 'Market index mandi prices populated');

    } catch (err) {
        console.error('Fatal error during test execution:', err);
        failedCount++;
    } finally {
        if (server) {
            server.close();
        }
        await db.pool.end();
    }

    console.log('\n🌾 =======================================================');
    console.log(`🌾 TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log('🌾 =======================================================\n');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runAllTests();
