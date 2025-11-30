/**
 * Configuration loader and validator
 * Loads environment variables and validates required settings
 */

require('dotenv').config();

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
 * Log an error message and exit the process
 * @param {string} message - Error message to display
 */
function configError(message) {
    console.error(`${colors.red}${colors.bold}[CONFIG ERROR]${colors.reset} ${message}`);
    console.error(`${colors.yellow}Check your .env file and ensure all required values are set.${colors.reset}`);
    console.error(`${colors.yellow}See .env.example for reference.${colors.reset}`);
    process.exit(1);
}

/**
 * Log a warning message
 * @param {string} message - Warning message to display
 */
function configWarning(message) {
    console.warn(`${colors.yellow}${colors.bold}[CONFIG WARNING]${colors.reset} ${message}`);
}

/**
 * Log a success message
 * @param {string} message - Success message to display
 */
function configSuccess(message) {
    console.log(`${colors.green}${colors.bold}[CONFIG]${colors.reset} ${message}`);
}

// Validate required environment variables
function validateConfig() {
    const errors = [];

    // Check ROBLOX_COOKIE
    if (!process.env.ROBLOX_COOKIE) {
        errors.push('ROBLOX_COOKIE is required. This is your bot account\'s .ROBLOSECURITY cookie.');
    } else if (process.env.ROBLOX_COOKIE.includes('PASTE_YOUR_COOKIE_HERE')) {
        errors.push('ROBLOX_COOKIE still contains placeholder text. Please paste your actual cookie.');
    } else if (!process.env.ROBLOX_COOKIE.startsWith('_|WARNING:')) {
        configWarning('ROBLOX_COOKIE may be invalid - it should start with "_|WARNING:"');
    }

    // Check GROUP_ID
    if (!process.env.GROUP_ID) {
        errors.push('GROUP_ID is required. This is your Roblox group\'s ID number.');
    } else if (isNaN(parseInt(process.env.GROUP_ID))) {
        errors.push('GROUP_ID must be a number.');
    }

    // Check API_KEY
    if (!process.env.API_KEY) {
        errors.push('API_KEY is required. This secures your API from unauthorized access.');
    } else if (process.env.API_KEY === 'your-super-secret-api-key-change-this') {
        errors.push('API_KEY still contains the default value. Please set a unique secret key.');
    } else if (process.env.API_KEY.length < 16) {
        configWarning('API_KEY is short. Consider using a longer key for better security.');
    }

    // If there are errors, display them all and exit
    if (errors.length > 0) {
        console.error(`\n${colors.red}${colors.bold}========== CONFIGURATION ERRORS ==========${colors.reset}\n`);
        errors.forEach((error, index) => {
            console.error(`${colors.red}${index + 1}. ${error}${colors.reset}`);
        });
        console.error(`\n${colors.yellow}Please fix these issues in your .env file.${colors.reset}`);
        console.error(`${colors.yellow}Copy .env.example to .env if you haven't already.${colors.reset}\n`);
        process.exit(1);
    }

    configSuccess('All required configuration values are present.');
}

// Run validation
validateConfig();

// Export configuration object
const config = {
    // Roblox settings
    roblox: {
        cookie: process.env.ROBLOX_COOKIE,
        groupId: parseInt(process.env.GROUP_ID)
    },

    // API settings
    api: {
        key: process.env.API_KEY,
        port: parseInt(process.env.PORT) || 3000
    },

    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 30
    },

    // Rank constraints
    ranks: {
        min: parseInt(process.env.MIN_RANK) || 1,
        max: parseInt(process.env.MAX_RANK) || 255
    }
};

module.exports = config;
