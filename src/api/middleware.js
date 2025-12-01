/**
 * API Middleware - Authentication and rate limiting
 * Protects API endpoints from unauthorized access and abuse
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { colors } = require('../utils/colors');

// ============================================
// BRUTE FORCE PROTECTION
// ============================================

// Track failed authentication attempts per IP
const failedAuthAttempts = new Map();
const AUTH_LOCKOUT_THRESHOLD = 5; // Lock after 5 failed attempts
const AUTH_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes lockout
const AUTH_ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minute window for counting attempts

/**
 * Record a failed authentication attempt
 */
function recordFailedAuth(ip) {
    const now = Date.now();
    let record = failedAuthAttempts.get(ip);
    
    if (!record) {
        record = { attempts: [], lockedUntil: null };
        failedAuthAttempts.set(ip, record);
    }
    
    // Remove old attempts outside the window
    record.attempts = record.attempts.filter(t => now - t < AUTH_ATTEMPT_WINDOW);
    record.attempts.push(now);
    
    // Check if should lock
    if (record.attempts.length >= AUTH_LOCKOUT_THRESHOLD) {
        record.lockedUntil = now + AUTH_LOCKOUT_DURATION;
        console.log(`${colors.red}[SECURITY]${colors.reset} IP ${ip} locked out for ${AUTH_LOCKOUT_DURATION / 60000} minutes due to ${AUTH_LOCKOUT_THRESHOLD} failed auth attempts`);
    }
}

/**
 * Check if IP is locked out
 */
function isLockedOut(ip) {
    const record = failedAuthAttempts.get(ip);
    if (!record || !record.lockedUntil) return false;
    
    if (Date.now() > record.lockedUntil) {
        // Lockout expired, reset
        record.lockedUntil = null;
        record.attempts = [];
        return false;
    }
    
    return true;
}

/**
 * Clear failed attempts on successful auth
 */
function clearFailedAuth(ip) {
    failedAuthAttempts.delete(ip);
}

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of failedAuthAttempts.entries()) {
        // Remove if no recent attempts and not locked
        if (record.attempts.length === 0 && (!record.lockedUntil || now > record.lockedUntil)) {
            failedAuthAttempts.delete(ip);
        }
    }
}, 60000); // Every minute

// ============================================
// IP ALLOWLIST
// ============================================

// Parse IP allowlist from environment
const ipAllowlist = process.env.IP_ALLOWLIST ? 
    process.env.IP_ALLOWLIST.split(',').map(ip => ip.trim()).filter(Boolean) : 
    null;

/**
 * Check if IP is in allowlist (if allowlist is enabled)
 */
function isIpAllowed(ip) {
    // If no allowlist configured, allow all
    if (!ipAllowlist || ipAllowlist.length === 0) return true;
    
    // Check if IP matches any in allowlist
    // Support for CIDR notation could be added here
    return ipAllowlist.includes(ip) || 
           ipAllowlist.includes('*') ||
           // Handle localhost variations
           (ipAllowlist.includes('localhost') && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'));
}

// ============================================
// REQUEST ID
// ============================================

/**
 * Generate unique request ID
 */
function generateRequestId() {
    return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

/**
 * Request ID middleware - adds unique ID to each request
 */
function requestId(req, res, next) {
    req.id = req.headers['x-request-id'] || generateRequestId();
    res.setHeader('X-Request-ID', req.id);
    next();
}

// ============================================
// CORS
// ============================================

/**
 * CORS middleware - secure cross-origin request handling
 * Restrictive by default - requires explicit CORS_ORIGINS configuration
 */
function cors(req, res, next) {
    const corsOrigins = process.env.CORS_ORIGINS;
    const origin = req.headers.origin;
    
    // If CORS_ORIGINS not set, only allow same-origin requests (no CORS header)
    // If set to '*', allow all origins (not recommended for production)
    // Otherwise, validate against the whitelist
    if (corsOrigins) {
        const allowedOrigins = corsOrigins.split(',').map(o => o.trim());
        
        if (allowedOrigins.includes('*')) {
            // Explicit wildcard - allow all (with warning logged on startup)
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
        } else if (origin && allowedOrigins.includes(origin)) {
            // Origin in whitelist
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        // If origin not in list, don't set header (browser will block)
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, X-Request-ID');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    
    next();
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * API Key authentication middleware
 * Checks for valid API key in header only (body option removed for security)
 */
function authenticate(req, res, next) {
    const ip = req.ip;
    
    // Check IP allowlist first
    if (!isIpAllowed(ip)) {
        console.log(`${colors.red}[SECURITY]${colors.reset} Request blocked - IP not in allowlist: ${ip}`);
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Your IP address is not authorized to access this API'
        });
    }
    
    // Check if IP is locked out due to failed attempts
    if (isLockedOut(ip)) {
        const record = failedAuthAttempts.get(ip);
        const remainingSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
        console.log(`${colors.red}[SECURITY]${colors.reset} Request blocked - IP locked out: ${ip}`);
        return res.status(429).json({
            success: false,
            error: 'Too many failed attempts',
            message: `Account locked due to too many failed authentication attempts. Try again in ${remainingSeconds} seconds.`,
            retryAfter: remainingSeconds
        });
    }
    
    // Get API key from header only (more secure than allowing body)
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        recordFailedAuth(ip);
        console.log(`${colors.yellow}[AUTH]${colors.reset} Request rejected - No API key provided (${ip})`);
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'Please provide an API key in the x-api-key header'
        });
    }

    // Use timing-safe comparison to prevent timing attacks
    try {
        const apiKeyBuffer = Buffer.from(apiKey);
        const configKeyBuffer = Buffer.from(config.api.key);
        
        if (apiKeyBuffer.length !== configKeyBuffer.length || 
            !crypto.timingSafeEqual(apiKeyBuffer, configKeyBuffer)) {
            recordFailedAuth(ip);
            console.log(`${colors.red}[AUTH]${colors.reset} Request rejected - Invalid API key (${ip})`);
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is incorrect'
            });
        }
    } catch (err) {
        recordFailedAuth(ip);
        console.log(`${colors.red}[AUTH]${colors.reset} Request rejected - Invalid API key (${ip})`);
        return res.status(403).json({
            success: false,
            error: 'Invalid API key',
            message: 'The provided API key is incorrect'
        });
    }

    // API key is valid - clear any failed attempts
    clearFailedAuth(ip);
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
 * Logs incoming requests for debugging with request ID
 */
function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    const reqId = req.id ? `[${req.id}]` : '';
    console.log(`${colors.blue}[REQUEST]${colors.reset} ${timestamp} ${reqId} | ${req.method} ${req.path} | IP: ${req.ip}`);
    
    // Log response time on finish
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusColor = res.statusCode >= 400 ? colors.red : colors.green;
        console.log(`${statusColor}[RESPONSE]${colors.reset} ${reqId} | ${res.statusCode} | ${duration}ms`);
    });
    
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
 * Additional security headers middleware
 * Adds security headers beyond what Helmet.js provides
 * Note: Most security headers are now handled by Helmet.js in server.js
 */
function additionalSecurityHeaders(req, res, next) {
    // Permissions policy - disable unnecessary browser features
    // Helmet doesn't set this by default
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    
    // Cache control for API responses - prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    next();
}

// Legacy alias for backwards compatibility
const securityHeaders = additionalSecurityHeaders;

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

    // Check for overflow - Roblox user IDs are large but should not exceed safe integer range
    if (parsedId > Number.MAX_SAFE_INTEGER) {
        return res.status(400).json({
            success: false,
            error: 'Invalid userId',
            message: 'userId exceeds maximum allowed value'
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

/**
 * Validate username middleware
 * Roblox usernames: 3-20 characters, alphanumeric and underscores
 */
function validateUsername(req, res, next) {
    const username = req.body?.username || req.params?.username;

    if (!username) {
        return res.status(400).json({
            success: false,
            error: 'Missing required field',
            message: 'username is required'
        });
    }

    // Roblox username constraints
    if (username.length < 3) {
        return res.status(400).json({
            success: false,
            error: 'Invalid username',
            message: 'Username must be at least 3 characters'
        });
    }

    if (username.length > 20) {
        return res.status(400).json({
            success: false,
            error: 'Invalid username',
            message: 'Username cannot exceed 20 characters'
        });
    }

    // Basic sanitization - only allow valid Roblox username characters
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid username',
            message: 'Username can only contain letters, numbers, and underscores'
        });
    }

    req.robloxUsername = username;
    next();
}

// ============================================
// RANK CHANGE COOLDOWNS
// ============================================

// Track recent rank changes per user for cooldown enforcement
const rankChangeCooldowns = new Map();
const COOLDOWN_DURATION = parseInt(process.env.RANK_COOLDOWN_SECONDS) * 1000 || 0; // Default: no cooldown

/**
 * Check and enforce rank change cooldown per user
 */
function checkRankCooldown(req, res, next) {
    // Skip if cooldown disabled
    if (COOLDOWN_DURATION <= 0) return next();
    
    const userId = req.robloxUserId || req.body?.userId;
    if (!userId) return next();
    
    const now = Date.now();
    const lastChange = rankChangeCooldowns.get(userId);
    
    if (lastChange && (now - lastChange) < COOLDOWN_DURATION) {
        const remainingSeconds = Math.ceil((COOLDOWN_DURATION - (now - lastChange)) / 1000);
        return res.status(429).json({
            success: false,
            error: 'Cooldown active',
            message: `This user's rank was recently changed. Please wait ${remainingSeconds} seconds before making another change.`,
            retryAfter: remainingSeconds
        });
    }
    
    next();
}

/**
 * Record a rank change for cooldown tracking
 */
function recordRankChange(userId) {
    if (COOLDOWN_DURATION > 0) {
        rankChangeCooldowns.set(userId, Date.now());
    }
}

// Cleanup old cooldown entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of rankChangeCooldowns.entries()) {
        if (now - timestamp > COOLDOWN_DURATION) {
            rankChangeCooldowns.delete(userId);
        }
    }
}, 60000); // Every minute

// ============================================
// REQUEST DEDUPLICATION
// ============================================

// Track recent requests to prevent duplicate operations
const recentRequests = new Map();
const DEDUP_WINDOW = 5000; // 5 seconds
const DEDUP_CLEANUP_INTERVAL = 30000; // Cleanup every 30 seconds

/**
 * Generate a deduplication key from request
 */
function getDedupeKey(req) {
    const action = req.path;
    const userId = req.robloxUserId || req.body?.userId || req.body?.username;
    const rank = req.body?.rank || req.body?.rankName || 'default';
    return `${action}:${userId}:${rank}`;
}

/**
 * Check for duplicate requests
 */
function deduplicateRequest(req, res, next) {
    const key = getDedupeKey(req);
    const now = Date.now();
    
    const lastRequest = recentRequests.get(key);
    if (lastRequest && (now - lastRequest.timestamp) < DEDUP_WINDOW) {
        console.log(`${colors.yellow}[DEDUP]${colors.reset} Duplicate request detected: ${key}`);
        return res.status(409).json({
            success: false,
            error: 'Duplicate request',
            message: 'This operation was recently submitted. Please wait a few seconds before retrying.',
            originalRequestId: lastRequest.requestId
        });
    }
    
    // Store this request
    recentRequests.set(key, { timestamp: now, requestId: req.id });
    
    next();
}

// Periodic cleanup for recentRequests to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of recentRequests.entries()) {
        if (now - value.timestamp > DEDUP_WINDOW) {
            recentRequests.delete(key);
        }
    }
}, DEDUP_CLEANUP_INTERVAL);

// ============================================
// EXPORTS
// ============================================

module.exports = {
    authenticate,
    rateLimiter,
    requestLogger,
    errorHandler,
    validateUserId,
    validateRank,
    validateUsername,
    securityHeaders,
    additionalSecurityHeaders,
    requestId,
    cors,
    checkRankCooldown,
    recordRankChange,
    deduplicateRequest,
    // Expose for testing/monitoring
    getSecurityStats: () => ({
        lockedIPs: Array.from(failedAuthAttempts.entries())
            .filter(([_, r]) => r.lockedUntil && Date.now() < r.lockedUntil)
            .map(([ip, _]) => ip),
        activeCooldowns: rankChangeCooldowns.size,
        pendingDedupe: recentRequests.size
    })
};
