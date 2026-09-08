// server/middleware/roleGuard.js
const { SELL_CAPABLE_ROLES, BUY_CAPABLE_ROLES } = require('../constants/roles');

/**
 * Ensures user has sell capability (PRD Section 4: Farmer, Aggregator, Wholesaler, Processor, Distributor)
 * Final Retailer is strictly buy-only and cannot sell.
 */
function requireSellCapability(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
        });
    }

    if (!SELL_CAPABLE_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: {
                message: `Forbidden: Role '${req.user.role}' does not have sell capability (buy-only role).`,
                code: 'FORBIDDEN_SELL_NOT_PERMITTED',
                userRole: req.user.role
            }
        });
    }

    next();
}

/**
 * Ensures user has buy capability (PRD Section 4: Aggregator, Wholesaler, Processor, Distributor, Final Retailer)
 * Farmer is strictly sell-only and cannot buy.
 */
function requireBuyCapability(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
        });
    }

    if (!BUY_CAPABLE_ROLES.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            error: {
                message: `Forbidden: Role '${req.user.role}' does not have buy capability (sell-only role).`,
                code: 'FORBIDDEN_BUY_NOT_PERMITTED',
                userRole: req.user.role
            }
        });
    }

    next();
}

/**
 * Restricts endpoint to a specific set of allowed roles
 */
function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    message: `Forbidden: Action restricted to roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
                    code: 'FORBIDDEN_ROLE_MISMATCH',
                    userRole: req.user.role
                }
            });
        }

        next();
    };
}

module.exports = {
    requireSellCapability,
    requireBuyCapability,
    requireRole
};
