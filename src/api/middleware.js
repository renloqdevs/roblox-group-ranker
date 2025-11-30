/**
 * API Middleware - Authentication and rate limiting
 * Protects API endpoints from unauthorized access and abuse
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

// ANSI color codes for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

/**
 * API Key authentication middleware
 * Checks for valid API key in header or body
 */
function authenticate(req, res, next) {
    // Get API key from header or body
    const apiKey = req.headers['x-api-key'] || req.body?.apiKey;

    if (!apiKey) {
        console.log(`${colors.yellow}[AUTH]${colors.reset} Request rejected - No API key provided (${req.ip})`);
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'Please provide an API key in the x-api-key header or apiKey body field'
        });
    }

    if (apiKey !== config.api.key) {
        console.log(`${colors.red}[AUTH]${colors.reset} Request rejected - Invalid API key (${req.ip})`);
        return res.status(403).json({
            success: false,
            error: 'Invalid API key',
            message: 'The provided API key is incorrect'
        });
    }

    // API key is valid
    next();
}

/**
 * Rate limiter - prevents abuse by limiting requests per IP
 */
const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again later. Limit: ${config.rateLimit.max} requests per 15 minutes.`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        console.log(`${colors.red}[RATE LIMIT]${colors.reset} Rate limit exceeded for IP: ${req.ip}`);
        res.status(options.statusCode).json(options.message);
    }
});

/**
 * Request logging middleware
 * Logs incoming requests for debugging
 */
function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    console.log(`${colors.blue}[REQUEST]${colors.reset} ${timestamp} | ${req.method} ${req.path} | IP: ${req.ip}`);
    next();
}

/**
 * Error handling middleware
 * Catches and formats errors
 */
function errorHandler(err, req, res, next) {
    console.error(`${colors.red}[ERROR]${colors.reset} ${err.message}`);

    // Don't leak stack traces in production
    const response = {
        success: false,
        error: 'Internal server error',
        message: err.message
    };

    res.status(500).json(response);
}

/**
 * Input validation middleware
 * Validates that userId is a valid number
 */
function validateUserId(req, res, next) {
    const userId = req.body?.userId || req.params?.userId;

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required field',
            message: 'userId is required'
        });
    }

    const parsedId = parseInt(userId);

    if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid userId',
            message: 'userId must be a positive number'
        });
    }

    // Store the parsed ID for later use
    req.robloxUserId = parsedId;
    next();
}

/**
 * Validate rank value middleware
 */
function validateRank(req, res, next) {
    const rank = req.body?.rank;

    // Rank is optional for some endpoints
    if (rank === undefined || rank === null) {
        return next();
    }

    const parsedRank = parseInt(rank);

    if (isNaN(parsedRank) || parsedRank < 0 || parsedRank > 255) {
        return res.status(400).json({
            success: false,
            error: 'Invalid rank',
            message: 'rank must be a number between 0 and 255'
        });
    }

    req.targetRank = parsedRank;
    next();
}

module.exports = {
    authenticate,
    rateLimiter,
    requestLogger,
    errorHandler,
    validateUserId,
    validateRank
};
