// server/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ALL_ROLES, SUPPORTED_LANGUAGES } = require('../constants/roles');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { recalculateTrustScore } = require('../services/trustScore.service');

const { loginRateLimiter, resetLimiterKey } = require('../middleware/rateLimiter');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * PRD Section 11.3.1: Required fields: Full Name, Username, Password, Mobile Number, Supply Chain Role.
 * Unique username enforcement: Rejection message must be:
 * "Username already exists. Please choose another username"
 */
router.post('/register', async (req, res, next) => {
    try {
        const {
            name,
            full_name,
            username,
            password,
            mobile_number,
            role,
            preferred_language = 'en',
            latitude = null,
            longitude = null,
            location_address = null
        } = req.body;

        const userName = (name || full_name || '').trim();

        // 1. Validate required fields
        if (!userName || !username || !password || !mobile_number || !role) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Missing required registration fields: name, username, password, mobile_number, and role are required.',
                    code: 'VALIDATION_MISSING_FIELDS'
                }
            });
        }

        // 2. Validate controlled role enum (PRD Section 11.5)
        if (!ALL_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: `Invalid role '${role}'. Must be one of: [${ALL_ROLES.join(', ')}].`,
                    code: 'VALIDATION_INVALID_ROLE'
                }
            });
        }

        // 3. Validate preferred language
        const lang = SUPPORTED_LANGUAGES.includes(preferred_language) ? preferred_language : 'en';

        // 4. Check if username already exists (PRD Section 11.3.1)
        const checkUser = await db.query(
            'SELECT id FROM public.users WHERE LOWER(username) = LOWER($1)',
            [username.trim()]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Username already exists. Please choose another username',
                    code: 'USERNAME_ALREADY_EXISTS'
                }
            });
        }

        // 5. Secure password hashing (PRD Section 11.3.1, never plain text)
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 6. Insert user record
        const insertResult = await db.query(
            `INSERT INTO public.users (
                name, username, password_hash, mobile_number, role,
                preferred_language, latitude, longitude, location_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, username, role, preferred_language, mobile_number, latitude, longitude, location_address, created_at`,
            [
                userName,
                username.trim(),
                passwordHash,
                mobile_number.trim(),
                role,
                lang,
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                location_address ? location_address.trim() : null
            ]
        );

        const newUser = insertResult.rows[0];

        // 7. Initialize baseline Trust Score (PRD Section 9.3: starting provisional score 80 / 4.0 stars)
        await recalculateTrustScore(newUser.id, 'New account registration');

        // 8. Generate JWT token
        const token = jwt.sign(
            { userId: newUser.id, username: newUser.username, role: newUser.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                full_name: newUser.name,
                username: newUser.username,
                role: newUser.role,
                preferred_language: newUser.preferred_language,
                mobile_number: newUser.mobile_number,
                latitude: newUser.latitude,
                longitude: newUser.longitude,
                location_address: newUser.location_address,
                created_at: newUser.created_at
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/login
 * PRD Section 11.3.2: User authenticates with Username + Password.
 * On invalid credentials: Show generic error that does not reveal whether the username exists:
 * "Invalid username or password. Please check your credentials and try again"
 */
router.post('/login', loginRateLimiter, async (req, res, next) => {
    try {
        const { username, password } = req.body;

        const genericErrorMessage = 'Invalid username or password. Please check your credentials and try again';

        if (!username || !password) {
            return res.status(401).json({
                success: false,
                error: {
                    message: genericErrorMessage,
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }

        // Fetch user by username
        const result = await db.query(
            `SELECT u.id, u.name, u.username, u.password_hash, u.role, u.preferred_language,
                    u.mobile_number, u.latitude, u.longitude, u.location_address, u.is_available,
                    COALESCE(t.aggregate_score, 80.00) as trust_score,
                    COALESCE(t.star_rating, 4.00) as star_rating,
                    COALESCE(t.is_high_risk, false) as is_high_risk
             FROM public.users u
             LEFT JOIN public.trust_scores t ON t.user_id = u.id
             WHERE LOWER(u.username) = LOWER($1)`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    message: genericErrorMessage,
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }

        const user = result.rows[0];

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    message: genericErrorMessage,
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }

        // Issue JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                full_name: user.name,
                username: user.username,
                role: user.role, // Server-stored role permanently retrieved from database
                preferred_language: user.preferred_language,
                mobile_number: user.mobile_number,
                latitude: user.latitude,
                longitude: user.longitude,
                location_address: user.location_address,
                is_available: user.is_available,
                trust_score: parseFloat(user.trust_score),
                star_rating: parseFloat(user.star_rating),
                is_high_risk: user.is_high_risk
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile
 */
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const trustRes = await db.query(
            `SELECT aggregate_score, star_rating, is_high_risk, is_new_member, total_transactions,
                    payment_reliability_score, order_fulfillment_score, operational_punctuality_score, peer_reviews_score
             FROM public.trust_scores WHERE user_id = $1`,
            [req.user.id]
        );

        const trust = trustRes.rows[0] || {
            aggregate_score: 80.00,
            star_rating: 4.00,
            is_high_risk: false,
            is_new_member: true
        };

        return res.status(200).json({
            success: true,
            user: {
                ...req.user,
                trust_score: trust
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
