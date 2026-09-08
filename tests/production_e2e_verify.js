// tests/production_e2e_verify.js
// Runs full 34-step E2E integration test against the LIVE PRODUCTION VERCEL URL
const https = require('https');

const BASE_URL = 'https://re8dqqne.insforge.site/api';
let passed = 0;
let failed = 0;

function record(testName, success, details = '') {
  if (success) {
    console.log(`  ✅ [PROD PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [PROD FAIL] ${testName}: ${details}`);
    failed++;
  }
}

function request(path, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}${path}`);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    };

    const req = https.request(
      url,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );

    req.on('error', (err) => resolve({ status: 500, error: err.message }));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runAllE2ETests() {
  console.log('===============================================================');
  console.log('🌐 AgriChain Connect: LIVE PRODUCTION E2E Verification Suite');
  console.log(`📡 Target URL: ${BASE_URL}`);
  console.log('===============================================================');

  const ts = Date.now();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health & Database Connectivity
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 1: Platform & API Health');
    const health = await request('/health');
    record('Backend API Health & DB Connection', health.status === 200 && health.data.database === 'healthy');

    // -------------------------------------------------------------------------
    // TEST 2: Farmer Registration, UI Guard & Listing Flow
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 2: Farmer Registration, UI Guard & Listing Flow');
    const farmerUser = `farmer_prod_${ts}`;
    const regFarmer = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Ramesh Kumar',
        username: farmerUser,
        password: 'Password123!',
        mobile_number: '9876543210',
        location_address: 'Sonipat Mandi Yard, Haryana',
        latitude: 28.9931,
        longitude: 77.0151,
        role: 'farmer',
        preferred_language: 'hi'
      }
    });
    record('Farmer Registration with PRD Fields', regFarmer.status === 201 && regFarmer.data.user.role === 'farmer');
    const farmerToken = regFarmer.data.token;
    const farmerId = regFarmer.data.user.id;

    // Verify session restore returns stored server role
    const sessionCheck = await request('/auth/me', { token: farmerToken });
    record('Session Check Returns Authoritative Server Role', sessionCheck.status === 200 && sessionCheck.data.user.role === 'farmer');

    // Verify Farmer is strictly SELL-ONLY: buy actions are rejected
    const buyAttempt = await request('/negotiations', {
      method: 'POST',
      token: farmerToken,
      body: { listing_id: '00000000-0000-0000-0000-000000000000', proposed_price_per_unit: 2000, proposed_quantity: 10 }
    });
    record('Farmer Buy-Side Forbidden Guard (403 Forbidden)', buyAttempt.status === 403);

    // Create a crop listing as farmer
    const createListing = await request('/listings', {
      method: 'POST',
      token: farmerToken,
      body: {
        commodity_type: 'Wheat',
        variety: 'Sharbati HD-2967',
        category: 'Cereals & Grains',
        quantity_quintals: 100,
        target_price_inr: 2400,
        min_order_quantity: 10,
        quality_grade: 'Grade A',
        moisture_content_pct: 11.5,
        harvest_date: '2026-03-15',
        pickup_location: 'Sonipat Farm Gate',
        description: 'Golden organic wheat harvest, zero pesticide residue.'
      }
    });
    record('Farmer Creates Crop Listing', createListing.status === 201 && createListing.data.listing.crop_type === 'Wheat');
    const listingId = createListing.data.listing.id;

    // Verify listing appears in farmer's listings
    const myListings = await request('/listings/my', { token: farmerToken });
    record('Farmer My Listings Query', myListings.status === 200 && myListings.data.listings.length >= 1);

    // AI Route Recommendation for Farmer
    const farmerRoutes = await request('/routes/recommendations?commodity_type=Wheat', { token: farmerToken });
    record('AI Route Recommendation & Profitability Analysis', farmerRoutes.status === 200 && farmerRoutes.data.recommendation.optimized_route.length > 0);

    // ₹100 Value Distribution Transparency for Farmer
    const farmerValueDist = await request('/value-distribution', { token: farmerToken });
    const isFarmerHighlighted = farmerValueDist.data.value_distributions?.[0]?.tiers.find(t => t.tier === 'farmer')?.is_current_user_tier;
    record('₹100 Transparency Highlights Farmer Tier', farmerValueDist.status === 200 && isFarmerHighlighted === true);

    // -------------------------------------------------------------------------
    // TEST 3: Aggregator Journey (Dual-Sided)
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 3: Aggregator Procurement & Stock Pooling');
    const aggUser = `agg_prod_${ts}`;
    const regAgg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Vikram Singh',
        username: aggUser,
        password: 'Password123!',
        mobile_number: '9876543211',
        location_address: 'Sonipat Agro Hub',
        role: 'local_aggregator',
        preferred_language: 'en'
      }
    });
    record('Aggregator Registration', regAgg.status === 201 && regAgg.data.user.role === 'local_aggregator');
    const aggToken = regAgg.data.token;
    const aggId = regAgg.data.user.id;

    // Aggregator browses farmer listings
    const browseListings = await request('/listings', { token: aggToken });
    const foundFarmerListing = browseListings.data.listings.find(l => l.id === listingId);
    record('Aggregator Discovers Farmer Crop Listing', browseListings.status === 200 && !!foundFarmerListing);

    // Aggregator initiates negotiation bid: ₹2,250/Qtl for 60 Qtl
    const startNeg = await request('/negotiations', {
      method: 'POST',
      token: aggToken,
      body: {
        listing_id: listingId,
        proposed_price_per_unit: 2250,
        proposed_quantity: 60,
        message: 'Offering ₹2,250/Qtl for 60 Qtl with immediate dispatch.',
        pickup_terms: 'Buyer arranges truck transport.'
      }
    });
    record('Aggregator Initiates Negotiation Bid', startNeg.status === 201 && startNeg.data.thread.status === 'active');
    const threadId = startNeg.data.thread.id;

    // Aggregator creates Stock Pool
    const createPool = await request('/listings/stock-pools', {
      method: 'POST',
      token: aggToken,
      body: {
        commodity_type: 'Wheat',
        variety: 'Sharbati',
        quality_grade: 'Grade A',
        total_quantity_quintals: 500,
        asking_price_per_unit: 2600,
        warehouse_location: 'Aggregator Warehouse 2, Sonipat'
      }
    });
    record('Aggregator Creates Stock Pool', createPool.status === 201 && createPool.data.stock_pool.crop_type === 'Wheat');

    // -------------------------------------------------------------------------
    // TEST 4: Cross-Role Negotiation Thread & Acceptance
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 4: Cross-Role Negotiation & Conversion to Order');
    const getThread = await request(`/negotiations/${threadId}`, { token: farmerToken });
    record('Farmer Receives Aggregator Negotiation Offer', getThread.status === 200 && getThread.data.offers.length >= 1);

    // Farmer counter-offers: ₹2,300/Qtl for 60 Qtl
    const counterOffer = await request(`/negotiations/${threadId}/offers`, {
      method: 'POST',
      token: farmerToken,
      body: {
        proposed_price_per_unit: 2300,
        proposed_quantity: 60,
        message: 'Best price is ₹2,300/Qtl for Grade A organic wheat.',
        payment_method: 'escrow'
      }
    });
    record('Farmer Submits Counter-Offer', counterOffer.status === 201 && counterOffer.data.offer.proposed_price_per_unit == 2300);
    const counterOfferId = counterOffer.data.offer.id;

    // Aggregator accepts counter-offer -> creates confirmed order
    const acceptOffer = await request(`/negotiations/${threadId}/accept`, {
      method: 'POST',
      token: aggToken,
      body: {
        payment_method: 'escrow',
        offer_id: counterOfferId
      }
    });
    record('Aggregator Accepts Offer -> Confirmed Order Created', acceptOffer.status === 200 && !!acceptOffer.data.order);
    const orderId = acceptOffer.data.order.id;

    // -------------------------------------------------------------------------
    // TEST 5: 6-Stage Order Tracking Lifecycle & Escrow Release
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 5: 6-Stage Order Lifecycle & Escrow Release');
    // Stage 1: confirmed (already set on accept)
    const orderCheck = await request(`/orders/${orderId}`, { token: farmerToken });
    record('Order Initialized at Confirmed Stage', orderCheck.status === 200 && orderCheck.data.order.status === 'confirmed');

    // Stage 2: Seller marks packed
    const markPacked = await request(`/orders/${orderId}/status`, {
      method: 'POST',
      token: farmerToken,
      body: { status: 'packed', location: 'Sonipat Farm Packhouse', notes: 'Bags sealed and labeled' }
    });
    record('Seller Advances Status: Packed', markPacked.status === 200 && markPacked.data.order.status === 'packed');

    // Stage 3: Seller marks shipped
    const markShipped = await request(`/orders/${orderId}/status`, {
      method: 'POST',
      token: farmerToken,
      body: { status: 'shipped', location: 'Dispatch Yard', notes: 'Loaded onto logistics truck HR-10-A-4421' }
    });
    record('Seller Advances Status: Shipped', markShipped.status === 200 && markShipped.data.order.status === 'shipped');

    // Stage 4: Seller marks out_for_delivery
    const markOut = await request(`/orders/${orderId}/status`, {
      method: 'POST',
      token: farmerToken,
      body: { status: 'out_for_delivery', location: 'Sonipat Transit Mile', notes: 'Out for local dropoff' }
    });
    record('Seller Advances Status: Out for Delivery', markOut.status === 200 && markOut.data.order.status === 'out_for_delivery');

    // Stage 5: Buyer confirms delivered (Releases Escrow)
    const markDelivered = await request(`/orders/${orderId}/status`, {
      method: 'POST',
      token: aggToken,
      body: { status: 'delivered', location: 'Aggregator Warehouse 2', notes: 'Weighbridge verified 60 Qtl received' }
    });
    record('Buyer Confirms Delivery Milestone', markDelivered.status === 200 && markDelivered.data.order.status === 'delivered');

    // Verify Escrow Released in Payments
    const paymentCheck = await request(`/payments/${orderId}`, { token: aggToken });
    record('Escrow Automatically Released on Verified Delivery', paymentCheck.status === 200 && paymentCheck.data.escrow_status === 'released');

    // -------------------------------------------------------------------------
    // TEST 6: Trust Score Peer Review & 4 Pillars Recalculation
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 6: Peer Review & Trust Score Recalculation');
    const reviewFarmer = await request('/trust-score/reviews', {
      method: 'POST',
      token: aggToken,
      body: {
        order_id: orderId,
        reviewee_id: farmerId,
        rating: 5,
        comments: 'Excellent quality wheat, punctual dispatch.'
      }
    });
    record('Aggregator Submits 5-Star Peer Review for Farmer', reviewFarmer.status === 201);

    // Verify Farmer Trust Score Details & 4 Pillars
    const farmerScore = await request('/trust-score/me', { token: farmerToken });
    record('Farmer Trust Score Recalculated with 4 Pillars', farmerScore.status === 200 && farmerScore.data.pillars?.community_reviews?.score > 0);

    // -------------------------------------------------------------------------
    // TEST 7: Cash-on-Delivery Dual Confirmation & Mismatch Detection
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 7: Cash Dual-Confirmation & Mismatch Detection');
    // Create direct order with cash
    const cashOrderRes = await request('/orders', {
      method: 'POST',
      token: aggToken,
      body: {
        listing_id: listingId,
        quantity_quintals: 10,
        payment_method: 'cash',
        delivery_address: 'Sonipat Agro Hub'
      }
    });
    record('Direct Order Placed with Cash Payment Method', cashOrderRes.status === 201 && cashOrderRes.data.order.payment_method === 'cash');
    const cashOrderId = cashOrderRes.data.order.id;

    // Seller logs physical cash collected: ₹23,000
    const logCashSeller = await request(`/payments/${cashOrderId}/cash/log`, {
      method: 'POST',
      token: farmerToken,
      body: { amount: 23000, notes: 'Cash received by driver' }
    });
    record('Seller Logs Cash Collected (₹23,000)', logCashSeller.status === 200 && logCashSeller.data.payment.cash_collected_amount == 23000);

    // Buyer confirms cash paid: ₹21,500 (Mismatch intentional test!)
    const confirmCashBuyer = await request(`/payments/${cashOrderId}/cash/confirm`, {
      method: 'POST',
      token: aggToken,
      body: { amount: 21500, notes: 'Deducted transport allowance' }
    });
    record('Buyer Confirms Differing Cash Amount (₹21,500)', confirmCashBuyer.status === 200);

    // Verify mismatch detection flagged
    const cashPaymentAudit = await request(`/payments/${cashOrderId}`, { token: farmerToken });
    record('Cash Mismatch Flagged (Dual Confirmation Discrepancy)', cashPaymentAudit.status === 200 && cashPaymentAudit.data.is_cash_mismatch === true);

    // -------------------------------------------------------------------------
    // TEST 8: Final Retailer Journey (Buy-Only)
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 8: Final Retailer Buy-Only Enforcement');
    const retailerUser = `retailer_prod_${ts}`;
    const regRetailer = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Anita Sharma',
        username: retailerUser,
        password: 'Password123!',
        mobile_number: '9876543212',
        location_address: 'Rohini Sector 7, Delhi',
        role: 'final_retailer',
        preferred_language: 'en'
      }
    });
    record('Final Retailer Registration', regRetailer.status === 201 && regRetailer.data.user.role === 'final_retailer');
    const retailerToken = regRetailer.data.token;

    // Attempt to create sale listing as Final Retailer (Must be rejected with 403)
    const forbiddenSell = await request('/listings', {
      method: 'POST',
      token: retailerToken,
      body: {
        crop_type: 'Wheat Flour',
        quantity: 50,
        asking_price_per_unit: 3200
      }
    });
    record('Final Retailer Sell Forbidden Guard (403 Forbidden)', forbiddenSell.status === 403);

    // ₹100 Value Distribution Breakdown for Retailer
    const retailerValueDist = await request('/value-distribution', { token: retailerToken });
    const isRetailerHighlighted = retailerValueDist.data.value_distributions?.[0]?.tiers.find(t => t.tier === 'final_retailer')?.is_current_user_tier;
    record('₹100 Transparency Highlights Final Retailer Tier', retailerValueDist.status === 200 && isRetailerHighlighted === true);

    // -------------------------------------------------------------------------
    // TEST 9: Adaptive Nearby Member Discovery & Radius Expansion
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 9: Adaptive Discovery Radius Expansion (Section 10.3)');
    const discoverySmall = await request('/discovery/nearby?radius_km=5', { token: farmerToken });
    record('Adaptive Discovery with Local Radius', discoverySmall.status === 200 && discoverySmall.data.search_radius_km >= 5);

    // -------------------------------------------------------------------------
    // TEST 10: Language Preference Persistence (Section 7)
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 10: Language Preference Persistence');
    const updateLang = await request('/user/language', {
      method: 'PUT',
      token: farmerToken,
      body: { preferred_language: 'pa' }
    });
    record('Language Updated to Punjabi (pa)', updateLang.status === 200);

    const checkLang = await request('/auth/me', { token: farmerToken });
    record('Persisted Language Verified as pa', checkLang.status === 200 && checkLang.data.user.preferred_language === 'pa');

    // -------------------------------------------------------------------------
    // TEST 11: Invalid Auth Error Obfuscation (Section 11.3.2)
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Phase 11: Security & Generic Error Verification');
    const badLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: 'nonexistent_user_9999', password: 'badpassword' }
    });
    record('Generic Invalid Credentials Error Message', badLogin.status === 401 && badLogin.data.error.message.includes('Invalid username or password'));

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`🌐 PRODUCTION SUMMARY: ${passed} PASSED | ${failed} FAILED | Total: ${passed + failed}`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal Production Test Error:', err);
    process.exit(1);
  }
}

runAllE2ETests();
