// server/routes/user.routes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { SUPPORTED_LANGUAGES } = require('../constants/roles');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/user/profile
 */
router.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        const userRes = await db.query(
            `SELECT u.id, u.name, u.username, u.mobile_number, u.role, u.preferred_language,
                    u.latitude, u.longitude, u.location_address, u.is_available, u.created_at, u.updated_at,
                    t.aggregate_score, t.star_rating, t.is_high_risk, t.is_new_member
             FROM public.users u
             LEFT JOIN public.trust_scores t ON t.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        return res.status(200).json({
            success: true,
            profile: userRes.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/user/profile
 * Updates mutable profile fields. Note: role and username are immutable after registration!
 */
router.put('/profile', authenticateToken, async (req, res, next) => {
    try {
        const { name, mobile_number, latitude, longitude, location_address, is_available } = req.body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            values.push(name.trim());
            updates.push(`name = $${values.length}`);
        }
        if (mobile_number !== undefined) {
            values.push(mobile_number.trim());
            updates.push(`mobile_number = $${values.length}`);
        }
        if (latitude !== undefined) {
            values.push(latitude !== null ? parseFloat(latitude) : null);
            updates.push(`latitude = $${values.length}`);
        }
        if (longitude !== undefined) {
            values.push(longitude !== null ? parseFloat(longitude) : null);
            updates.push(`longitude = $${values.length}`);
        }
        if (location_address !== undefined) {
            values.push(location_address ? location_address.trim() : null);
            updates.push(`location_address = $${values.length}`);
        }
        if (is_available !== undefined) {
            values.push(Boolean(is_available));
            updates.push(`is_available = $${values.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'No valid profile fields provided for update.', code: 'NO_FIELDS_TO_UPDATE' }
            });
        }

        values.push(req.user.id);
        const query = `
            UPDATE public.users
            SET ${updates.join(', ')}, updated_at = now()
            WHERE id = $${values.length}
            RETURNING id, name, username, mobile_number, role, preferred_language, latitude, longitude, location_address, is_available, updated_at
        `;

        const result = await db.query(query, values);

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            profile: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/user/language
 * PRD Section 7.1: Persists preferred language to user's account ('en', 'hi', 'pa', 'mr')
 */
router.put('/language', authenticateToken, async (req, res, next) => {
    try {
        const { preferred_language } = req.body;

        if (!preferred_language || !SUPPORTED_LANGUAGES.includes(preferred_language)) {
            return res.status(400).json({
                success: false,
                error: {
                    message: `Invalid language code. Supported languages are: [${SUPPORTED_LANGUAGES.join(', ')}].`,
                    code: 'INVALID_LANGUAGE'
                }
            });
        }

        const result = await db.query(
            `UPDATE public.users
             SET preferred_language = $1, updated_at = now()
             WHERE id = $2
             RETURNING id, username, preferred_language`,
            [preferred_language, req.user.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Preferred language updated and persisted.',
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
