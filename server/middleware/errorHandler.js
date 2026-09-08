// server/middleware/errorHandler.js

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.url}:`, err);

    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error occurred.';
    const code = err.code || 'SERVER_ERROR';

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
}

module.exports = errorHandler;
