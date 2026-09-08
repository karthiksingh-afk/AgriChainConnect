// server/constants/roles.js
// PRD Sections 3, 4, and 11.5 Exact Controlled Role Enum & Trading Capabilities

const USER_ROLES = {
    FARMER: 'farmer',
    LOCAL_AGGREGATOR: 'local_aggregator',
    WHOLESALER: 'wholesaler',
    MANUFACTURER: 'manufacturer',
    DISTRIBUTOR: 'distributor',
    FINAL_RETAILER: 'final_retailer',
};

const ALL_ROLES = Object.values(USER_ROLES);

// Roles that are permitted to create sale listings (Sell capability)
const SELL_CAPABLE_ROLES = [
    USER_ROLES.FARMER,
    USER_ROLES.LOCAL_AGGREGATOR,
    USER_ROLES.WHOLESALER,
    USER_ROLES.MANUFACTURER,
    USER_ROLES.DISTRIBUTOR,
];

// Roles that are permitted to buy crops / products (Buy capability)
const BUY_CAPABLE_ROLES = [
    USER_ROLES.LOCAL_AGGREGATOR,
    USER_ROLES.WHOLESALER,
    USER_ROLES.MANUFACTURER,
    USER_ROLES.DISTRIBUTOR,
    USER_ROLES.FINAL_RETAILER,
];

// Dual-sided roles that both buy upstream and sell downstream
const DUAL_SIDED_ROLES = [
    USER_ROLES.LOCAL_AGGREGATOR,
    USER_ROLES.WHOLESALER,
    USER_ROLES.MANUFACTURER,
    USER_ROLES.DISTRIBUTOR,
];

// Single-sided roles
const SELL_ONLY_ROLES = [USER_ROLES.FARMER];
const BUY_ONLY_ROLES = [USER_ROLES.FINAL_RETAILER];

// Baseline supply chain sequential order (PRD Section 8.1)
const SUPPLY_CHAIN_TIERS = [
    USER_ROLES.FARMER,
    USER_ROLES.LOCAL_AGGREGATOR,
    USER_ROLES.WHOLESALER,
    USER_ROLES.MANUFACTURER,
    USER_ROLES.DISTRIBUTOR,
    USER_ROLES.FINAL_RETAILER,
];

// Supported languages (PRD Section 7.1)
const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'mr'];

module.exports = {
    USER_ROLES,
    ALL_ROLES,
    SELL_CAPABLE_ROLES,
    BUY_CAPABLE_ROLES,
    DUAL_SIDED_ROLES,
    SELL_ONLY_ROLES,
    BUY_ONLY_ROLES,
    SUPPLY_CHAIN_TIERS,
    SUPPORTED_LANGUAGES,
};
