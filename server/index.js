// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const listingsRoutes = require('./routes/listings.routes');
const negotiationsRoutes = require('./routes/negotiations.routes');
const ordersRoutes = require('./routes/orders.routes');
const orderStatusRoutes = require('./routes/orderStatus.routes');
const paymentsRoutes = require('./routes/payments.routes');
const trustScoreRoutes = require('./routes/trustScore.routes');
const routeOptimizationRoutes = require('./routes/routes.routes');
const discoveryRoutes = require('./routes/discovery.routes');
const valueDistRoutes = require('./routes/valueDist.routes');
const marketPriceRoutes = require('./routes/marketPrice.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Malformed JSON error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Malformed JSON payload.',
                code: 'INVALID_JSON'
            }
        });
    }
    next(err);
});

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
}

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
    try {
        const dbCheck = await db.query('SELECT 1 as connected');
        res.status(200).json({
            status: 'ok',
            platform: 'AgriChain Connect Backend API',
            version: '1.0.0',
            database: dbCheck.rows[0].connected === 1 ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            platform: 'AgriChain Connect Backend API',
            database: 'unreachable',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

const path = require('path');

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/negotiations', negotiationsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/orders', orderStatusRoutes); // mounts /api/orders/:orderId/status and /status-history
app.use('/api/payments', paymentsRoutes);
app.use('/api/trust-score', trustScoreRoutes);
app.use('/api/routes', routeOptimizationRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/value-distribution', valueDistRoutes);
app.use('/api/market-prices', marketPriceRoutes);

// SPA fallback: Serve index.html for frontend client routes
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return res.sendFile(path.join(__dirname, '../public/index.html'));
    }
    next();
});

// 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
            code: 'ENDPOINT_NOT_FOUND'
        }
    });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server if run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🌾 AgriChain Connect Backend running on port ${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Database: Connected to PostgreSQL (InsForge/Supabase)`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
