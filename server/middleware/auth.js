// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'agrichain_jwt_secure_secret_token_2026_super_key_9918';

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Authentication token required.',
                    code: 'AUTH_TOKEN_MISSING'
                }
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid or expired authentication token.',
                    code: 'AUTH_TOKEN_INVALID'
                }
            });
        }

        // Always fetch the true role and status from the server database (PRD Section 11.4)
        const result = await db.query(
            'SELECT id, name, username, role, preferred_language, mobile_number, is_available, latitude, longitude, location_address FROM public.users WHERE id = $1',
            [decoded.userId || decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'User account not found.',
                    code: 'USER_NOT_FOUND'
                }
            });
        }

        req.user = {
            ...result.rows[0],
            full_name: result.rows[0].name
        };
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                message: 'Internal server error during authentication.',
                code: 'INTERNAL_AUTH_ERROR'
            }
        });
    }
}

// Optional auth: attaches req.user if token valid, but does not block if missing
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const result = await db.query(
                    'SELECT id, name, username, role, preferred_language, mobile_number, is_available FROM public.users WHERE id = $1',
                    [decoded.userId || decoded.id]
                );
                if (result.rows.length > 0) {
                    req.user = result.rows[0];
                }
            } catch (e) {
                // Ignore token errors in optional auth
            }
        }
        next();
    } catch (err) {
        next();
    }
}

module.exports = {
    authenticateToken,
    optionalAuth,
    JWT_SECRET
};
