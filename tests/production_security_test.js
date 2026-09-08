// tests/production_security_test.js
// Runs full security regression suite against LIVE PRODUCTION VERCEL URL
const https = require('https');

const BASE_URL = 'https://re8dqqne.insforge.site/api';
let passed = 0;
let failed = 0;

function logPass(msg) {
    console.log(`  ✅ [PROD PASS] ${msg}`);
    passed++;
}

function logFail(msg, detail = '') {
    console.error(`  ❌ [PROD FAIL] ${msg}: ${detail}`);
    failed++;
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

        if (options.rawBody) {
            req.write(options.rawBody);
        } else if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function runProductionSecuritySuite() {
    console.log('===============================================================');
    console.log('🛡️  AgriChain Connect: LIVE PRODUCTION Security & IDOR Suite');
    console.log(`📡 Target URL: ${BASE_URL}`);
    console.log('===============================================================');

    const ts = Date.now();

    // -------------------------------------------------------------------------
    // TEST 1: Unauthorized Access Without Token (401 Unauthorized)
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Security Group 1: Authentication & Token Verification');
    const noAuthMe = await request('/auth/me');
    if (noAuthMe.status === 401) {
        logPass('GET /api/auth/me rejects missing token with 401');
    } else {
        logFail('GET /api/auth/me missing token check', `Expected 401, got ${noAuthMe.status}`);
    }

    const noAuthListings = await request('/listings', { method: 'POST', body: { crop_type: 'Wheat' } });
    if (noAuthListings.status === 401) {
        logPass('POST /api/listings rejects unauthenticated user with 401');
    } else {
        logFail('POST /api/listings unauthenticated check', `Expected 401, got ${noAuthListings.status}`);
    }

    const noAuthOrders = await request('/orders');
    if (noAuthOrders.status === 401) {
        logPass('GET /api/orders rejects unauthenticated user with 401');
    } else {
        logFail('GET /api/orders unauthenticated check', `Expected 401, got ${noAuthOrders.status}`);
    }

    const noAuthTrust = await request('/trust-score/me');
    if (noAuthTrust.status === 401) {
        logPass('GET /api/trust-score/me rejects unauthenticated user with 401');
    } else {
        logFail('GET /api/trust-score/me unauthenticated check', `Expected 401, got ${noAuthTrust.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Role Spoofing & Server Authority Enforcement
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Security Group 2: Role Spoofing & Server Authority');
    const farmerUser = `prod_sec_farmer_${ts}`;
    const regFarmer = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Security Farmer',
            username: farmerUser,
            password: 'Password123!',
            mobile_number: '9876500001',
            location_address: 'Karnal, Haryana',
            role: 'farmer'
        }
    });
    const farmerToken = regFarmer.data.token;
    const farmerId = regFarmer.data.user.id;

    // Farmer attempts buy action while claiming role: 'wholesaler' in body
    const spoofedNegotiation = await request('/negotiations', {
        method: 'POST',
        token: farmerToken,
        body: {
            role: 'wholesaler',
            listing_id: '00000000-0000-0000-0000-000000000000',
            proposed_price_per_unit: 2200,
            proposed_quantity: 50
        }
    });
    if (spoofedNegotiation.status === 403) {
        logPass('Backend rejects Farmer buy attempt despite spoofed { role: "wholesaler" } in payload (403)');
    } else {
        logFail('Role spoofing guard failed', `Expected 403, got ${spoofedNegotiation.status}`);
    }

    // Final Retailer attempts sell action while claiming role: 'farmer' in body
    const retailerUser = `prod_sec_retailer_${ts}`;
    const regRetailer = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Security Retailer',
            username: retailerUser,
            password: 'Password123!',
            mobile_number: '9876500002',
            location_address: 'Delhi City',
            role: 'final_retailer'
        }
    });
    const retailerToken = regRetailer.data.token;

    const spoofedListing = await request('/listings', {
        method: 'POST',
        token: retailerToken,
        body: {
            role: 'farmer',
            crop_type: 'Wheat',
            category: 'Cereal',
            quantity: 50,
            asking_price_per_unit: 2400
        }
    });
    if (spoofedListing.status === 403) {
        logPass('Backend rejects Final Retailer sell attempt despite spoofed { role: "farmer" } in payload (403)');
    } else {
        logFail('Retailer sell spoofing guard failed', `Expected 403, got ${spoofedListing.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Tenant IDOR Protection
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Security Group 3: Cross-Tenant IDOR & Ledger Isolation');
    const createListing = await request('/listings', {
        method: 'POST',
        token: farmerToken,
        body: {
            crop_type: 'Wheat',
            category: 'Grain',
            quantity: 100,
            asking_price_per_unit: 2300,
            location: 'Karnal Hub'
        }
    });
    const listingId = createListing.data.listing.id;

    const aggUser = `prod_sec_agg_${ts}`;
    const regAgg = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Security Aggregator',
            username: aggUser,
            password: 'Password123!',
            mobile_number: '9876500003',
            location_address: 'Sonipat Mandi',
            role: 'local_aggregator'
        }
    });
    const aggToken = regAgg.data.token;

    const orderRes = await request('/orders', {
        method: 'POST',
        token: aggToken,
        body: {
            listing_id: listingId,
            quantity: 20,
            payment_method: 'escrow'
        }
    });
    const orderId = orderRes.data.order.id;

    const farmerBUser = `prod_sec_farmerB_${ts}`;
    const regFarmerB = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Attacker Farmer B',
            username: farmerBUser,
            password: 'Password123!',
            mobile_number: '9876500004',
            location_address: 'Ambala',
            role: 'farmer'
        }
    });
    const farmerBToken = regFarmerB.data.token;

    // 1. Farmer B attempts to read Farmer A's order
    const idorOrder = await request(`/orders/${orderId}`, { token: farmerBToken });
    if (idorOrder.status === 403) {
        logPass('IDOR: Third-party Farmer B is blocked from viewing Farmer A order (403)');
    } else {
        logFail('IDOR order leakage', `Expected 403, got ${idorOrder.status}`);
    }

    // 2. Farmer B attempts to advance Farmer A's order status
    const idorStatus = await request(`/orders/${orderId}/status`, {
        method: 'POST',
        token: farmerBToken,
        body: { status: 'shipped' }
    });
    if (idorStatus.status === 403) {
        logPass('IDOR: Third-party Farmer B cannot advance order status (403)');
    } else {
        logFail('IDOR order status advance', `Expected 403, got ${idorStatus.status}`);
    }

    // 3. Farmer B attempts to read Farmer A's escrow payment record
    const idorPayment = await request(`/payments/${orderId}`, { token: farmerBToken });
    if (idorPayment.status === 403) {
        logPass('IDOR: Third-party Farmer B cannot read escrow payment ledger (403)');
    } else {
        logFail('IDOR escrow ledger leakage', `Expected 403, got ${idorPayment.status}`);
    }

    // 4. Farmer B attempts to view Farmer A's public trust score -> aggregates only
    const publicScore = await request(`/trust-score/${farmerId}`, { token: farmerBToken });
    const isGranularPrivate = !publicScore.data.history && !publicScore.data.pillars;
    const hasAggregate = publicScore.data.aggregate_score !== undefined || publicScore.data.trust_score?.aggregate_score !== undefined;
    if (publicScore.status === 200 && isGranularPrivate && hasAggregate) {
        logPass('Privacy: Public Trust Score exposes aggregate rating only, concealing private history and pillar metrics');
    } else {
        logFail('Trust score privacy leakage', JSON.stringify(publicScore.data));
    }

    // -------------------------------------------------------------------------
    // TEST 4: Abuse Protection & Rate Limiting
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Security Group 4: Abuse Protection & Rate Limiting');
    const bruteUser = `prod_victim_${ts}`;
    let rateLimitTriggered = false;

    for (let i = 1; i <= 12; i++) {
        const attempt = await request('/auth/login', {
            method: 'POST',
            body: { username: bruteUser, password: 'WrongPassword!' }
        });
        if (attempt.status === 429) {
            rateLimitTriggered = true;
            break;
        }
    }

    if (rateLimitTriggered) {
        logPass('Rate Limiter: Repeated failed login attempts triggered HTTP 429 Too Many Requests');
    } else {
        logFail('Rate limiter failed to trigger after 12 attempts');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Malformed & Oversized Payload Handling
    // -------------------------------------------------------------------------
    console.log('\n▶ Production Security Group 5: Payload Resilience');
    const malformed = await request('/auth/login', {
        method: 'POST',
        rawBody: '{"username": "test", "password": broken json'
    });
    if (malformed.status === 400 && malformed.data?.error?.code === 'INVALID_JSON') {
        logPass('Malformed JSON payload rejected cleanly with HTTP 400 and INVALID_JSON error code');
    } else {
        logFail('Malformed JSON handling', `Expected 400 with INVALID_JSON, got ${malformed.status}`);
    }

    const largeStr = 'X'.repeat(1024 * 1024 * 2); // 2MB
    const oversized = await request('/auth/login', {
        method: 'POST',
        body: { username: 'test', password: largeStr }
    });
    if (oversized.status === 413) {
        logPass('Oversized payload (>1MB) rejected with HTTP 413 Payload Too Large');
    } else {
        logFail('Oversized payload handling', `Expected 413, got ${oversized.status}`);
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`🛡️  PRODUCTION SECURITY SUMMARY: ${passed} PASSED | ${failed} FAILED | Total: ${passed + failed}`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
}

runProductionSecuritySuite();
