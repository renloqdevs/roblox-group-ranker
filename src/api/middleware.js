/**
 * API Middleware - Authentication and rate limiting
 * Protects API endpoints from unauthorized access and abuse
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { colors } = require('../utils/colors');

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

    // Use timing-safe comparison to prevent timing attacks
    try {
        const apiKeyBuffer = Buffer.from(apiKey);
        const configKeyBuffer = Buffer.from(config.api.key);
        
        if (apiKeyBuffer.length !== configKeyBuffer.length || 
            !crypto.timingSafeEqual(apiKeyBuffer, configKeyBuffer)) {
            console.log(`${colors.red}[AUTH]${colors.reset} Request rejected - Invalid API key (${req.ip})`);
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is incorrect'
            });
        }
    } catch (err) {
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
 * Catches and formats errors with categorization
 */
function errorHandler(err, req, res, next) {
    console.error(`${colors.red}[ERROR]${colors.reset} ${err.message}`);

    // Categorize errors for appropriate status codes
    let statusCode = 500;
    let errorType = 'Internal server error';
    
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorType = 'Validation error';
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        statusCode = 503;
        errorType = 'Service unavailable';
    } else if (err.message?.includes('rate limit')) {
        statusCode = 429;
        errorType = 'Rate limited';
    } else if (err.message?.includes('not found')) {
        statusCode = 404;
        errorType = 'Not found';
    }

    const response = {
        success: false,
        error: errorType,
        message: err.message
    };

    res.status(statusCode).json(response);
}

/**
 * Security headers middleware
 * Adds security-related HTTP headers
 */
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.removeHeader('X-Powered-By');
    next();
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
    validateRank,
    securityHeaders
};
