/**
 * Ranking module - handles all rank operations
 * Provides functions to get/set ranks, promote, demote users
 */

const noblox = require('noblox.js');
const config = require('../config');
const client = require('./client');
const { colors } = require('../utils/colors');

// Simple in-memory cache for user lookups
const userCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get cached user data or null if expired/missing
 */
function getCachedUser(key) {
    const cached = userCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    userCache.delete(key);
    return null;
}

/**
 * Cache user data with timestamp
 */
function cacheUser(key, data) {
    // Limit cache size to prevent memory issues
    if (userCache.size > 500) {
        const firstKey = userCache.keys().next().value;
        userCache.delete(firstKey);
    }
    userCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Get a user's ID from their username
 * @param {string} username - Roblox username
 * @returns {Promise<number>} User ID
 */
async function getUserIdFromUsername(username) {
    try {
        const userId = await noblox.getIdFromUsername(username);
        if (!userId) {
            throw new Error(`User "${username}" not found`);
        }
        return userId;
    } catch (error) {
        throw new Error(`Failed to find user "${username}": ${error.message}`);
    }
}

/**
 * Get a user's username from their ID
 * @param {number} userId - Roblox user ID
 * @returns {Promise<string>} Username
 */
async function getUsernameFromId(userId) {
    try {
        const username = await noblox.getUsernameFromId(userId);
        if (!username) {
            throw new Error(`User with ID ${userId} not found`);
        }
        return username;
    } catch (error) {
        throw new Error(`Failed to find user with ID ${userId}: ${error.message}`);
    }
}

/**
 * Get a user's current rank in the group
 * Uses caching to reduce redundant API calls
 * @param {number} userId - Roblox user ID
 * @returns {Promise<Object>} Rank information
 */
async function getUserRank(userId) {
    const cacheKey = `rank_${userId}`;
    const cached = getCachedUser(cacheKey);
    if (cached) return cached;

    try {
        // Get rank number - this is the primary call
        const rank = await noblox.getRankInGroup(config.roblox.groupId, userId);
        
        // Get rank name from our cached roles instead of another API call
        const groupRoles = client.getGroupRoles();
        const roleInfo = groupRoles.find(r => r.rank === rank);
        const rankName = roleInfo?.name || 'Unknown';

        const result = {
            userId: userId,
            rank: rank,
            rankName: rankName,
            inGroup: rank > 0
        };

        cacheUser(cacheKey, result);
        return result;
    } catch (error) {
        throw new Error(`Failed to get rank for user ${userId}: ${error.message}`);
    }
}

/**
 * Validate that a rank change is allowed
 * @param {number} targetRank - The rank to set
 * @param {number} currentRank - User's current rank
 * @returns {Object} Validation result
 */
function validateRankChange(targetRank, currentRank) {
    const botRank = client.getBotRank();
    const groupRoles = client.getGroupRoles();

    // Check if rank exists
    const targetRole = groupRoles.find(role => role.rank === targetRank);
    if (!targetRole) {
        return {
            valid: false,
            error: `Rank ${targetRank} does not exist in this group`
        };
    }

    // Check if rank is within configured bounds
    if (targetRank < config.ranks.min) {
        return {
            valid: false,
            error: `Cannot set rank below minimum (${config.ranks.min})`
        };
    }

    if (targetRank > config.ranks.max) {
        return {
            valid: false,
            error: `Cannot set rank above maximum (${config.ranks.max})`
        };
    }

    // Check if bot has permission (can only rank below itself)
    if (targetRank >= botRank) {
        return {
            valid: false,
            error: `Bot cannot set ranks at or above its own rank (${botRank})`
        };
    }

    // Check if user's current rank is below bot's rank
    if (currentRank >= botRank) {
        return {
            valid: false,
            error: `Cannot modify users at or above bot's rank (${botRank})`
        };
    }

    return {
        valid: true,
        targetRole: targetRole
    };
}

/**
 * Set a user to a specific rank
 * @param {number} userId - Roblox user ID
 * @param {number} rank - Rank number to set
 * @returns {Promise<Object>} Result of the operation
 */
async function setRank(userId, rank) {
    try {
        // Get current rank
        const currentRankInfo = await getUserRank(userId);

        if (!currentRankInfo.inGroup) {
            throw new Error('User is not in the group');
        }

        // Validate the rank change
        const validation = validateRankChange(rank, currentRankInfo.rank);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check if already at this rank
        if (currentRankInfo.rank === rank) {
            return {
                success: true,
                message: 'User is already at this rank',
                userId: userId,
                oldRank: currentRankInfo.rank,
                oldRankName: currentRankInfo.rankName,
                newRank: rank,
                newRankName: validation.targetRole.name,
                changed: false
            };
        }

        // Perform the rank change
        console.log(`${colors.blue}[RANKING]${colors.reset} Setting user ${userId} to rank ${rank} (${validation.targetRole.name})`);
        await noblox.setRank(config.roblox.groupId, userId, rank);

        const result = {
            success: true,
            message: `Successfully changed rank`,
            userId: userId,
            oldRank: currentRankInfo.rank,
            oldRankName: currentRankInfo.rankName,
            newRank: rank,
            newRankName: validation.targetRole.name,
            changed: true
        };

        console.log(`${colors.green}[RANKING]${colors.reset} User ${userId}: ${currentRankInfo.rankName} (${currentRankInfo.rank}) -> ${validation.targetRole.name} (${rank})`);

        return result;

    } catch (error) {
        console.error(`${colors.red}[RANKING ERROR]${colors.reset} Failed to set rank for ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Set a user to a specific rank by role name
 * @param {number} userId - Roblox user ID
 * @param {string} roleName - Name of the role to set
 * @returns {Promise<Object>} Result of the operation
 */
async function setRankByName(userId, roleName) {
    const groupRoles = client.getGroupRoles();

    // Find the role by name (case-insensitive)
    const targetRole = groupRoles.find(role =>
        role.name.toLowerCase() === roleName.toLowerCase()
    );

    if (!targetRole) {
        // Try partial match
        const partialMatch = groupRoles.find(role =>
            role.name.toLowerCase().includes(roleName.toLowerCase())
        );

        if (partialMatch) {
            throw new Error(`Role "${roleName}" not found. Did you mean "${partialMatch.name}"?`);
        }

        throw new Error(`Role "${roleName}" not found in the group`);
    }

    return await setRank(userId, targetRole.rank);
}

/**
 * Promote a user by one rank
 * @param {number} userId - Roblox user ID
 * @returns {Promise<Object>} Result of the operation
 */
async function promote(userId) {
    try {
        // Get current rank
        const currentRankInfo = await getUserRank(userId);

        if (!currentRankInfo.inGroup) {
            throw new Error('User is not in the group');
        }

        const groupRoles = client.getGroupRoles();
        const botRank = client.getBotRank();

        // Sort roles by rank
        const sortedRoles = [...groupRoles].sort((a, b) => a.rank - b.rank);

        // Find current role index
        const currentIndex = sortedRoles.findIndex(role => role.rank === currentRankInfo.rank);

        if (currentIndex === -1) {
            throw new Error('Could not find user\'s current role');
        }

        // Find next role
        const nextRole = sortedRoles[currentIndex + 1];

        if (!nextRole) {
            throw new Error('User is already at the highest rank');
        }

        // Check if next rank is below bot's rank
        if (nextRole.rank >= botRank) {
            throw new Error(`Cannot promote user - next rank (${nextRole.name}) is at or above bot's rank`);
        }

        // Check config constraints
        if (nextRole.rank > config.ranks.max) {
            throw new Error(`Cannot promote user above configured maximum rank (${config.ranks.max})`);
        }

        // Perform the promotion
        console.log(`${colors.blue}[RANKING]${colors.reset} Promoting user ${userId} to ${nextRole.name} (${nextRole.rank})`);
        await noblox.setRank(config.roblox.groupId, userId, nextRole.rank);

        const result = {
            success: true,
            message: 'Successfully promoted user',
            userId: userId,
            oldRank: currentRankInfo.rank,
            oldRankName: currentRankInfo.rankName,
            newRank: nextRole.rank,
            newRankName: nextRole.name,
            changed: true
        };

        console.log(`${colors.green}[RANKING]${colors.reset} Promoted ${userId}: ${currentRankInfo.rankName} (${currentRankInfo.rank}) -> ${nextRole.name} (${nextRole.rank})`);

        return result;

    } catch (error) {
        console.error(`${colors.red}[RANKING ERROR]${colors.reset} Failed to promote ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Demote a user by one rank
 * @param {number} userId - Roblox user ID
 * @returns {Promise<Object>} Result of the operation
 */
async function demote(userId) {
    try {
        // Get current rank
        const currentRankInfo = await getUserRank(userId);

        if (!currentRankInfo.inGroup) {
            throw new Error('User is not in the group');
        }

        const groupRoles = client.getGroupRoles();
        const botRank = client.getBotRank();

        // Check if user can be modified
        if (currentRankInfo.rank >= botRank) {
            throw new Error(`Cannot demote users at or above bot's rank (${botRank})`);
        }

        // Sort roles by rank
        const sortedRoles = [...groupRoles].sort((a, b) => a.rank - b.rank);

        // Find current role index
        const currentIndex = sortedRoles.findIndex(role => role.rank === currentRankInfo.rank);

        if (currentIndex === -1) {
            throw new Error('Could not find user\'s current role');
        }

        // Find previous role
        const prevRole = sortedRoles[currentIndex - 1];

        if (!prevRole || prevRole.rank === 0) {
            throw new Error('User is already at the lowest rankable position');
        }

        // Check config constraints
        if (prevRole.rank < config.ranks.min) {
            throw new Error(`Cannot demote user below configured minimum rank (${config.ranks.min})`);
        }

        // Perform the demotion
        console.log(`${colors.blue}[RANKING]${colors.reset} Demoting user ${userId} to ${prevRole.name} (${prevRole.rank})`);
        await noblox.setRank(config.roblox.groupId, userId, prevRole.rank);

        const result = {
            success: true,
            message: 'Successfully demoted user',
            userId: userId,
            oldRank: currentRankInfo.rank,
            oldRankName: currentRankInfo.rankName,
            newRank: prevRole.rank,
            newRankName: prevRole.name,
            changed: true
        };

        console.log(`${colors.green}[RANKING]${colors.reset} Demoted ${userId}: ${currentRankInfo.rankName} (${currentRankInfo.rank}) -> ${prevRole.name} (${prevRole.rank})`);

        return result;

    } catch (error) {
        console.error(`${colors.red}[RANKING ERROR]${colors.reset} Failed to demote ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Get all roles in the group
 * @returns {Array} Array of roles with rank and name
 */
function getAllRoles() {
    const groupRoles = client.getGroupRoles();
    const botRank = client.getBotRank();

    return groupRoles
        .map(role => ({
            rank: role.rank,
            name: role.name,
            memberCount: role.memberCount,
            canAssign: role.rank < botRank && role.rank > 0 && role.rank >= config.ranks.min && role.rank <= config.ranks.max
        }))
        .sort((a, b) => a.rank - b.rank);
}

module.exports = {
    getUserIdFromUsername,
    getUsernameFromId,
    getUserRank,
    setRank,
    setRankByName,
    promote,
    demote,
    getAllRoles
};
