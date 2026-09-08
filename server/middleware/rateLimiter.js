// server/middleware/rateLimiter.js

// Sliding window tracker
const ipTrackers = new Map();

/**
 * Creates a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max allowed attempts within window
 * @param {string} options.message - Error message
 * @param {string} options.keyGenerator - Optional custom key function
 */
function createRateLimiter({
    windowMs = 15 * 60 * 1000,
    max = 5,
    message = 'Too many requests. Please try again later.',
    code = 'RATE_LIMIT_EXCEEDED',
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown_ip'
}) {
    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        let record = ipTrackers.get(key);
        if (!record) {
            record = { timestamps: [] };
            ipTrackers.set(key, record);
        }

        // Filter out timestamps outside window
        record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

        if (record.timestamps.length >= max) {
            const oldest = record.timestamps[0];
            const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
            res.set('Retry-After', String(retryAfterSec));
            return res.status(429).json({
                success: false,
                error: {
                    message,
                    code,
                    retry_after_seconds: retryAfterSec
                }
            });
        }

        record.timestamps.push(now);
        next();
    };
}

// 1. Login Rate Limiter: Max 10 attempts per 15 minutes per IP + username
const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    keyGenerator: (req) => `login_${req.body?.username || 'user'}_${req.ip || req.headers['x-forwarded-for'] || 'ip'}`
});

// 2. Negotiation Creation Rate Limiter: Max 30 bids per minute
const negotiationRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Negotiation bid rate limit exceeded. Please wait a moment before sending more offers.',
    code: 'NEGOTIATION_RATE_LIMIT_EXCEEDED',
    keyGenerator: (req) => `neg_${req.user?.id || req.ip || req.headers['x-forwarded-for'] || 'ip'}`
});

// Helper to reset limits (for testing)
function resetLimiterKey(key) {
    ipTrackers.delete(key);
}

module.exports = {
    createRateLimiter,
    loginRateLimiter,
    negotiationRateLimiter,
    resetLimiterKey
};
