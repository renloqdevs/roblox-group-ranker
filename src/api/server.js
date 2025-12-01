/**
 * Express Server Setup
 * Configures and starts the HTTP server
 */

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const config = require('../config');
const routes = require('./routes');
const middleware = require('./middleware');
const { colors } = require('../utils/colors');

/**
 * Create and configure the Express application
 * @returns {Object} Express app instance
 */
function createApp() {
    const app = express();

    // Trust proxy (required for Railway and other platforms)
    app.set('trust proxy', 1);

    // Helmet.js - comprehensive security headers (industry standard)
    // This replaces our custom securityHeaders middleware with battle-tested defaults
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false, // Not needed for API server
        crossOriginOpenerPolicy: false,   // Not needed for API server
        crossOriginResourcePolicy: { policy: 'same-origin' },
        hsts: process.env.NODE_ENV === 'production' || process.env.ENABLE_HSTS === 'true'
            ? { maxAge: 31536000, includeSubDomains: true, preload: true }
            : false
    }));

    // Response compression (gzip/brotli)
    // Significantly reduces bandwidth for JSON responses
    app.use(compression({
        level: 6, // Balance between speed and compression ratio
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
            // Don't compress if client doesn't accept it
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        }
    }));

    // Request ID tracking
    app.use(middleware.requestId);

    // CORS support
    app.use(middleware.cors);

    // Additional security headers (beyond Helmet defaults)
    app.use(middleware.additionalSecurityHeaders);

    // Parse JSON bodies with size limit and proper error handling
    app.use(express.json({ 
        limit: '1mb',
        strict: true, // Only accept arrays and objects
        verify: (req, res, buf, encoding) => {
            // Store raw body for signature verification if needed
            req.rawBody = buf;
        }
    }));

    // Parse URL-encoded bodies with size limit
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Body parser error handler (413, 400 for malformed JSON)
    app.use((err, req, res, next) => {
        if (err.type === 'entity.too.large') {
            return res.status(413).json({
                success: false,
                error: 'Payload too large',
                errorCode: 'E_PAYLOAD_TOO_LARGE',
                message: 'Request body exceeds the 1MB limit',
                maxSize: '1MB'
            });
        }
        if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
            return res.status(400).json({
                success: false,
                error: 'Invalid JSON',
                errorCode: 'E_INVALID_JSON',
                message: 'Request body contains invalid JSON syntax'
            });
        }
        next(err);
    });

    // Apply rate limiting to all requests
    app.use(middleware.rateLimiter);

    // Log all requests
    app.use(middleware.requestLogger);

    // Apply routes
    app.use(routes);

    // Error handler (must be last)
    app.use(middleware.errorHandler);

    return app;
}

// Track active connections for graceful shutdown
let activeConnections = new Set();
let isShuttingDown = false;

/**
 * Start the HTTP server
 * @param {Object} app - Express app instance
 * @returns {Promise<Object>} HTTP server instance
 */
function startServer(app) {
    return new Promise((resolve, reject) => {
        const port = config.api.port;

        const server = app.listen(port, () => {
            console.log('');
            console.log(`${colors.green}${colors.bold}========================================${colors.reset}`);
            console.log(`${colors.green}${colors.bold}   RANKING BOT API SERVER STARTED${colors.reset}`);
            console.log(`${colors.green}${colors.bold}========================================${colors.reset}`);
            console.log('');
            console.log(`${colors.cyan}Server running on port:${colors.reset} ${port}`);
            console.log(`${colors.cyan}Local URL:${colors.reset}             http://localhost:${port}`);
            console.log('');
            console.log(`${colors.magenta}${colors.bold}Available Endpoints:${colors.reset}`);
            console.log(`${colors.blue}  GET  /health${colors.reset}              - Check server status`);
            console.log(`${colors.blue}  GET  /health/detailed${colors.reset}     - Detailed status (auth required)`);
            console.log(`${colors.blue}  GET  /api/rank/:userId${colors.reset}    - Get user's rank`);
            console.log(`${colors.blue}  GET  /api/user/:username${colors.reset}  - Get user by username`);
            console.log(`${colors.blue}  GET  /api/roles${colors.reset}           - List all group roles`);
            console.log(`${colors.blue}  POST /api/rank${colors.reset}            - Set user's rank`);
            console.log(`${colors.blue}  POST /api/rank/username${colors.reset}   - Set rank by username`);
            console.log(`${colors.blue}  POST /api/rank/bulk${colors.reset}       - Bulk rank operation`);
            console.log(`${colors.blue}  POST /api/promote${colors.reset}         - Promote user`);
            console.log(`${colors.blue}  POST /api/demote${colors.reset}          - Demote user`);
            console.log('');
            console.log(`${colors.yellow}Rate Limit:${colors.reset} ${config.rateLimit.max} requests per 15 minutes`);
            console.log(`${colors.yellow}CORS:${colors.reset} Enabled`);
            console.log('');
            console.log(`${colors.green}${colors.bold}Ready to receive requests!${colors.reset}`);
            console.log('');

            resolve(server);
        });

        // Track connections for graceful shutdown
        server.on('connection', (conn) => {
            activeConnections.add(conn);
            conn.on('close', () => activeConnections.delete(conn));
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`${colors.red}${colors.bold}[SERVER ERROR]${colors.reset} Port ${port} is already in use`);
                console.error(`${colors.yellow}Try changing the PORT in your .env file${colors.reset}`);
            } else {
                console.error(`${colors.red}${colors.bold}[SERVER ERROR]${colors.reset}`, error.message);
            }
            reject(error);
        });

        // Setup graceful shutdown
        setupGracefulShutdown(server);
    });
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log(`\n${colors.yellow}[SHUTDOWN]${colors.reset} ${signal} received, starting graceful shutdown...`);
        
        // Stop accepting new connections
        server.close(() => {
            console.log(`${colors.green}[SHUTDOWN]${colors.reset} Server closed, no longer accepting connections`);
        });

        // Close existing connections with timeout
        console.log(`${colors.yellow}[SHUTDOWN]${colors.reset} Closing ${activeConnections.size} active connections...`);
        
        // Give connections 5 seconds to finish
        const forceCloseTimeout = setTimeout(() => {
            console.log(`${colors.yellow}[SHUTDOWN]${colors.reset} Force closing remaining connections`);
            activeConnections.forEach(conn => conn.destroy());
        }, 5000);

        // Wait for connections to close naturally
        const checkConnections = setInterval(() => {
            if (activeConnections.size === 0) {
                clearInterval(checkConnections);
                clearTimeout(forceCloseTimeout);
                console.log(`${colors.green}[SHUTDOWN]${colors.reset} All connections closed`);
                console.log(`${colors.green}[SHUTDOWN]${colors.reset} Graceful shutdown complete`);
                process.exit(0);
            }
        }, 100);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = {
    createApp,
    startServer
};
