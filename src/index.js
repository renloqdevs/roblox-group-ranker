/**
 * Roblox Group Ranking Bot
 * Main entry point - initializes all components and starts the server
 *
 * GitHub: https://github.com/YOUR_USERNAME/roblox-ranking-bot
 */

const { colors } = require('./utils/colors');

// ASCII Art Banner
const banner = `
${colors.cyan}${colors.bold}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗  █████╗ ███╗   ██╗██╗  ██╗██████╗  ██████╗ ████████╗   ║
║   ██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝   ║
║   ██████╔╝███████║██╔██╗ ██║█████╔╝ ██████╔╝██║   ██║   ██║      ║
║   ██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ██╔══██╗██║   ██║   ██║      ║
║   ██║  ██║██║  ██║██║ ╚████║██║  ██╗██████╔╝╚██████╔╝   ██║      ║
║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝      ║
║                                                           ║
║           Roblox Group Ranking Bot v1.0.0                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`;

/**
 * Main startup function
 */
async function main() {
    console.log(banner);
    console.log(`${colors.dim}Starting up...${colors.reset}\n`);

    try {
        // Step 1: Load and validate configuration
        console.log(`${colors.blue}[1/3]${colors.reset} Loading configuration...`);
        const config = require('./config');
        console.log(`${colors.green}[1/3]${colors.reset} Configuration loaded successfully\n`);

        // Step 2: Initialize Roblox client
        console.log(`${colors.blue}[2/3]${colors.reset} Connecting to Roblox...`);
        const robloxClient = require('./roblox/client');
        await robloxClient.initialize();
        console.log(`${colors.green}[2/3]${colors.reset} Roblox connection established\n`);

        // Step 3: Start the API server
        console.log(`${colors.blue}[3/3]${colors.reset} Starting API server...`);
        const { createApp, startServer } = require('./api/server');
        const app = createApp();
        await startServer(app);

    } catch (error) {
        console.error(`\n${colors.red}${colors.bold}[FATAL ERROR]${colors.reset} Failed to start:`, error.message);
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}[SHUTDOWN]${colors.reset} Received SIGINT, shutting down gracefully...`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`\n${colors.yellow}[SHUTDOWN]${colors.reset} Received SIGTERM, shutting down gracefully...`);
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(`${colors.red}${colors.bold}[UNCAUGHT EXCEPTION]${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`${colors.red}${colors.bold}[UNHANDLED REJECTION]${colors.reset}`, reason);
    process.exit(1);
});

// Start the application
main();
