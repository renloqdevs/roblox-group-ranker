/**
 * Roblox client - handles authentication with noblox.js
 * This module manages the connection to Roblox's API
 */

const noblox = require('noblox.js');
const config = require('../config');

// ANSI color codes for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Store bot information after login
let botUser = null;
let botRankInGroup = null;
let groupRoles = null;

/**
 * Initialize the Roblox client by logging in with the cookie
 * @returns {Promise<Object>} Bot user information
 */
async function initialize() {
    console.log(`${colors.blue}${colors.bold}[ROBLOX]${colors.reset} Authenticating with Roblox...`);

    try {
        // Login with the cookie
        const currentUser = await noblox.setCookie(config.roblox.cookie);
        botUser = currentUser;

        console.log(`${colors.green}${colors.bold}[ROBLOX]${colors.reset} Logged in as: ${colors.cyan}${currentUser.UserName}${colors.reset} (ID: ${currentUser.UserID})`);

        // Get group information
        console.log(`${colors.blue}${colors.bold}[ROBLOX]${colors.reset} Fetching group information...`);

        // Get all roles in the group
        groupRoles = await noblox.getRoles(config.roblox.groupId);
        console.log(`${colors.green}${colors.bold}[ROBLOX]${colors.reset} Found ${groupRoles.length} roles in group`);

        // Get the bot's rank in the group
        const botRank = await noblox.getRankInGroup(config.roblox.groupId, currentUser.UserID);
        botRankInGroup = botRank;

        if (botRank === 0) {
            console.error(`${colors.red}${colors.bold}[ROBLOX ERROR]${colors.reset} Bot account is not in the group!`);
            console.error(`${colors.yellow}Please add the bot account (${currentUser.UserName}) to your group.${colors.reset}`);
            process.exit(1);
        }

        // Find the bot's role name
        const botRole = groupRoles.find(role => role.rank === botRank);
        console.log(`${colors.green}${colors.bold}[ROBLOX]${colors.reset} Bot rank in group: ${colors.cyan}${botRole ? botRole.name : 'Unknown'}${colors.reset} (Rank ${botRank})`);

        // Warn about ranking limitations
        const rankableRoles = groupRoles.filter(role => role.rank < botRank && role.rank > 0);
        console.log(`${colors.green}${colors.bold}[ROBLOX]${colors.reset} Bot can assign ${rankableRoles.length} roles (ranks 1-${botRank - 1})`);

        if (rankableRoles.length === 0) {
            console.warn(`${colors.yellow}${colors.bold}[ROBLOX WARNING]${colors.reset} Bot cannot rank anyone - its rank is too low!`);
            console.warn(`${colors.yellow}Give the bot a higher rank in your group to enable ranking.${colors.reset}`);
        }

        return currentUser;

    } catch (error) {
        console.error(`${colors.red}${colors.bold}[ROBLOX ERROR]${colors.reset} Failed to authenticate:`, error.message);

        if (error.message.includes('Cookie')) {
            console.error(`${colors.yellow}Your ROBLOX_COOKIE may be invalid or expired.${colors.reset}`);
            console.error(`${colors.yellow}Please get a fresh cookie from your bot account.${colors.reset}`);
        }

        process.exit(1);
    }
}

/**
 * Get the bot's user information
 * @returns {Object|null} Bot user info
 */
function getBotUser() {
    return botUser;
}

/**
 * Get the bot's rank number in the group
 * @returns {number|null} Bot's rank
 */
function getBotRank() {
    return botRankInGroup;
}

/**
 * Get all roles in the group
 * @returns {Array|null} Array of group roles
 */
function getGroupRoles() {
    return groupRoles;
}

/**
 * Get the noblox instance for direct access
 * @returns {Object} noblox.js instance
 */
function getNoblox() {
    return noblox;
}

module.exports = {
    initialize,
    getBotUser,
    getBotRank,
    getGroupRoles,
    getNoblox
};
