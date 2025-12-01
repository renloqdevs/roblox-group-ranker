/**
 * Roblox client - handles authentication with noblox.js
 * This module manages the connection to Roblox's API
 */

const noblox = require('noblox.js');
const config = require('../config');
const { colors } = require('../utils/colors');

// Lazy-load webhook to avoid circular dependency
let webhook = null;
function getWebhook() {
    if (!webhook) {
        webhook = require('../services/webhook');
    }
    return webhook;
}

// Store bot information after login
let botUser = null;
let botRankInGroup = null;
let groupRoles = null;

// Pre-computed data structures for O(1) lookups
let sortedGroupRoles = null;  // Sorted by rank for promote/demote
let rolesByRank = new Map();  // Map for O(1) rank lookup
let rolesByName = new Map();  // Map for O(1) name lookup (lowercase)

// Session health monitoring
let sessionHealthy = true;
let lastHealthCheck = null;
let healthCheckInterval = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const HEALTH_CHECK_INTERVAL = parseInt(process.env.SESSION_HEALTH_INTERVAL) || 60000; // Default: 1 minute

// Event listeners for session status changes
const sessionListeners = new Set();

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

        // Pre-compute sorted roles and lookup maps for O(1) access
        sortedGroupRoles = [...groupRoles].sort((a, b) => a.rank - b.rank);
        rolesByRank = new Map(groupRoles.map(role => [role.rank, role]));
        rolesByName = new Map(groupRoles.map(role => [role.name.toLowerCase(), role]));

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

        // Start session health monitoring
        startSessionHealthMonitoring();

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

// ============================================
// SESSION HEALTH MONITORING
// ============================================

/**
 * Start periodic session health checks
 * Verifies the Roblox cookie is still valid
 */
function startSessionHealthMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }

    console.log(`${colors.blue}[SESSION]${colors.reset} Starting health monitoring (interval: ${HEALTH_CHECK_INTERVAL / 1000}s)`);
    
    // Initial health check
    checkSessionHealth();

    // Periodic health checks
    healthCheckInterval = setInterval(checkSessionHealth, HEALTH_CHECK_INTERVAL);
}

/**
 * Stop session health monitoring
 */
function stopSessionHealthMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        console.log(`${colors.yellow}[SESSION]${colors.reset} Health monitoring stopped`);
    }
}

/**
 * Check if the Roblox session is still valid
 * @returns {Promise<boolean>} True if session is healthy
 */
async function checkSessionHealth() {
    try {
        // Try to get current user info - this will fail if cookie is invalid
        const currentUser = await noblox.getCurrentUser();
        
        if (!currentUser || !currentUser.UserID) {
            throw new Error('Invalid user response from Roblox');
        }

        // Verify it's the same user we logged in with
        if (botUser && currentUser.UserID !== botUser.UserID) {
            console.error(`${colors.red}[SESSION CRITICAL]${colors.reset} User mismatch! Expected ${botUser.UserID}, got ${currentUser.UserID}`);
            handleSessionFailure('User ID mismatch - possible session hijack');
            return false;
        }

        // Session is healthy
        if (!sessionHealthy || consecutiveFailures > 0) {
            console.log(`${colors.green}[SESSION]${colors.reset} Session recovered - cookie is valid`);
            notifySessionListeners('recovered', { user: currentUser });
            
            // Send webhook notification for session recovery
            if (!sessionHealthy) {
                try {
                    getWebhook().notifySessionRecovered({ user: currentUser });
                } catch (err) {
                    console.error(`${colors.red}[SESSION]${colors.reset} Failed to send recovery webhook:`, err.message);
                }
            }
        }

        sessionHealthy = true;
        lastHealthCheck = new Date();
        consecutiveFailures = 0;
        
        return true;

    } catch (error) {
        consecutiveFailures++;
        
        console.warn(`${colors.yellow}[SESSION]${colors.reset} Health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${error.message}`);

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            handleSessionFailure(error.message);
        }

        return false;
    }
}

/**
 * Handle session failure after max consecutive failures
 * @param {string} reason - Failure reason
 */
function handleSessionFailure(reason) {
    const wasHealthy = sessionHealthy;
    sessionHealthy = false;
    lastHealthCheck = new Date();

    console.error(`${colors.red}${colors.bold}[SESSION CRITICAL]${colors.reset} Session is unhealthy!`);
    console.error(`${colors.red}[SESSION]${colors.reset} Reason: ${reason}`);
    console.error(`${colors.yellow}[SESSION]${colors.reset} The Roblox cookie may have expired or been invalidated.`);
    console.error(`${colors.yellow}[SESSION]${colors.reset} Please restart the bot with a fresh cookie.`);

    if (wasHealthy) {
        notifySessionListeners('unhealthy', { reason, timestamp: lastHealthCheck });
        
        // Send webhook alert for cookie invalidation
        try {
            getWebhook().notifySessionUnhealthy({
                reason,
                botUser: botUser ? { username: botUser.UserName, userId: botUser.UserID } : null,
                timestamp: lastHealthCheck
            });
        } catch (err) {
            console.error(`${colors.red}[SESSION]${colors.reset} Failed to send webhook alert:`, err.message);
        }
    }
}

/**
 * Add a listener for session status changes
 * @param {Function} callback - Function to call on status change
 * @returns {Function} Unsubscribe function
 */
function onSessionStatusChange(callback) {
    sessionListeners.add(callback);
    return () => sessionListeners.delete(callback);
}

/**
 * Notify all session listeners of a status change
 * @param {string} status - 'healthy', 'unhealthy', 'recovered'
 * @param {Object} data - Additional data
 */
function notifySessionListeners(status, data = {}) {
    sessionListeners.forEach(callback => {
        try {
            callback(status, data);
        } catch (err) {
            console.error(`${colors.red}[SESSION]${colors.reset} Listener error:`, err.message);
        }
    });
}

/**
 * Get current session health status
 * @returns {Object} Session health information
 */
function getSessionHealth() {
    return {
        healthy: sessionHealthy,
        lastCheck: lastHealthCheck,
        consecutiveFailures,
        botUser: botUser ? {
            userId: botUser.UserID,
            username: botUser.UserName
        } : null,
        monitoringActive: !!healthCheckInterval
    };
}

/**
 * Force a session health check
 * @returns {Promise<Object>} Health check result
 */
async function forceHealthCheck() {
    const healthy = await checkSessionHealth();
    return {
        healthy,
        timestamp: new Date(),
        consecutiveFailures
    };
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

/**
 * Get pre-sorted roles array (sorted by rank ascending)
 * @returns {Array|null} Sorted array of group roles
 */
function getSortedRoles() {
    return sortedGroupRoles;
}

/**
 * Get a role by its rank number - O(1) lookup
 * @param {number} rank - The rank number
 * @returns {Object|undefined} The role object or undefined
 */
function getRoleByRank(rank) {
    return rolesByRank.get(rank);
}

/**
 * Get a role by its name - O(1) lookup (case-insensitive)
 * @param {string} name - The role name
 * @returns {Object|undefined} The role object or undefined
 */
function getRoleByName(name) {
    return rolesByName.get(name.toLowerCase());
}

module.exports = {
    initialize,
    getBotUser,
    getBotRank,
    getGroupRoles,
    getNoblox,
    getSortedRoles,
    getRoleByRank,
    getRoleByName,
    // Session health monitoring
    getSessionHealth,
    checkSessionHealth,
    forceHealthCheck,
    onSessionStatusChange,
    startSessionHealthMonitoring,
    stopSessionHealthMonitoring
};
