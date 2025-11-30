/**
 * Express Server Setup
 * Configures and starts the HTTP server
 */

const express = require('express');
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

    // Security headers
    app.use(middleware.securityHeaders);

    // Parse JSON bodies with size limit
    app.use(express.json({ limit: '1mb' }));

    // Parse URL-encoded bodies with size limit
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
            console.log(`${colors.blue}  GET  /api/rank/:userId${colors.reset}    - Get user's rank`);
            console.log(`${colors.blue}  GET  /api/user/:username${colors.reset}  - Get user by username`);
            console.log(`${colors.blue}  GET  /api/roles${colors.reset}           - List all group roles`);
            console.log(`${colors.blue}  POST /api/rank${colors.reset}            - Set user's rank`);
            console.log(`${colors.blue}  POST /api/rank/username${colors.reset}   - Set rank by username`);
            console.log(`${colors.blue}  POST /api/promote${colors.reset}         - Promote user`);
            console.log(`${colors.blue}  POST /api/promote/username${colors.reset}- Promote by username`);
            console.log(`${colors.blue}  POST /api/demote${colors.reset}          - Demote user`);
            console.log(`${colors.blue}  POST /api/demote/username${colors.reset} - Demote by username`);
            console.log('');
            console.log(`${colors.yellow}Rate Limit:${colors.reset} ${config.rateLimit.max} requests per 15 minutes`);
            console.log('');
            console.log(`${colors.green}${colors.bold}Ready to receive requests!${colors.reset}`);
            console.log('');

            resolve(server);
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
    });
}

module.exports = {
    createApp,
    startServer
};
