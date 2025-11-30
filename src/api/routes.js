/**
 * API Routes - All ranking endpoints
 * Provides REST API for ranking operations
 * 
 * API Version: v1
 * All endpoints support both /api/* and /v1/api/* paths
 */

const express = require('express');
const router = express.Router();
const ranking = require('../roblox/ranking');
const client = require('../roblox/client');
const config = require('../config');
const middleware = require('./middleware');
const auditLog = require('../services/auditLog');
const webhook = require('../services/webhook');

// Initialize webhook service
webhook.initialize();

// Track request metrics
const metrics = {
    totalRequests: 0,
    requestsByEndpoint: {},
    requestsByMethod: {},
    errors: 0,
    startTime: Date.now()
};

// Metrics tracking middleware
function trackMetrics(req, res, next) {
    metrics.totalRequests++;
    metrics.requestsByMethod[req.method] = (metrics.requestsByMethod[req.method] || 0) + 1;
    
    const endpoint = req.route ? req.route.path : req.path;
    metrics.requestsByEndpoint[endpoint] = (metrics.requestsByEndpoint[endpoint] || 0) + 1;
    
    // Track errors
    res.on('finish', () => {
        if (res.statusCode >= 400) {
            metrics.errors++;
        }
    });
    
    next();
}

router.use(trackMetrics);

// Apply authentication to all /api routes except health check
router.use('/api', middleware.authenticate);
router.use('/v1/api', middleware.authenticate);

// ============================================
// HEALTH CHECK (No auth required)
// ============================================

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * GET /health
 * Returns basic server status - useful for uptime monitoring
 * Sanitized to not expose sensitive information
 */
router.get('/health', (req, res) => {
    const botUser = client.getBotUser();
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
        version: '1.1.1',
        // Only expose whether bot is connected, not details
        botConnected: !!botUser
    });
});

/**
 * GET /health/detailed
 * Returns detailed server status with full system info (authenticated)
 */
router.get('/health/detailed', middleware.authenticate, (req, res) => {
    const botUser = client.getBotUser();
    const botRank = client.getBotRank();
    const roles = ranking.getAllRoles();
    const logStats = auditLog.getStats();
    const memUsage = process.memoryUsage();
    const securityStats = middleware.getSecurityStats();
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor((Date.now() - serverStartTime) / 1000),
            formatted: formatUptime(Date.now() - serverStartTime)
        },
        version: '1.1.1',
        bot: botUser ? {
            username: botUser.UserName,
            userId: botUser.UserID,
            rank: botRank,
            rankableLevels: roles.filter(r => r.canAssign).length
        } : null,
        group: {
            totalRoles: roles.length,
            assignableRoles: roles.filter(r => r.canAssign).length
        },
        operations: logStats,
        security: {
            lockedIPs: securityStats.lockedIPs.length,
            activeCooldowns: securityStats.activeCooldowns,
            pendingDedupe: securityStats.pendingDedupe
        },
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024),
                unit: 'MB'
            },
            cpuUsage: process.cpuUsage()
        }
    });
});

/**
 * Format uptime to human readable string
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// ============================================
// RANKING ENDPOINTS
// ============================================

/**
 * POST /api/rank
 * Set a user to a specific rank
 * Body: { userId: number, rank: number } OR { userId: number, rankName: string }
 */
router.post(['/api/rank', '/v1/api/rank'],
    middleware.validateUserId,
    middleware.validateRank,
    middleware.deduplicateRequest,
    middleware.checkRankCooldown,
    async (req, res, next) => {
        try {
            const userId = req.robloxUserId;
            const { rank, rankName } = req.body;

            // Must provide either rank number or rank name
            if (rank === undefined && !rankName) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'Please provide either "rank" (number) or "rankName" (string)'
                });
            }

            let result;

            if (rankName) {
                // Set by role name
                result = await ranking.setRankByName(userId, rankName);
            } else {
                // Set by rank number
                result = await ranking.setRank(userId, rank);
            }

            // Log the operation
            auditLog.add({
                action: 'setRank',
                userId: userId,
                targetRank: rankName || rank,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            // Send webhook notification
            if (result.success && result.changed) {
                webhook.notifyRankChange(result);
                // Record for cooldown tracking
                middleware.recordRankChange(userId);
            }

            res.json(result);

        } catch (error) {
            auditLog.add({
                action: 'setRank',
                userId: req.robloxUserId,
                success: false,
                error: error.message,
                ip: req.ip
            });

            res.status(400).json({
                success: false,
                error: 'Rank change failed',
                errorCode: 'E_RANK_CHANGE',
                message: error.message,
                requestId: req.id
            });
        }
    }
);

/**
 * POST /api/promote
 * Promote a user by one rank
 * Body: { userId: number }
 */
router.post(['/api/promote', '/v1/api/promote'],
    middleware.validateUserId,
    middleware.deduplicateRequest,
    middleware.checkRankCooldown,
    async (req, res, next) => {
        try {
            const userId = req.robloxUserId;
            const result = await ranking.promote(userId);

            auditLog.add({
                action: 'promote',
                userId: userId,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            if (result.success && result.changed) {
                webhook.notifyPromotion(result);
                middleware.recordRankChange(userId);
            }

            res.json(result);

        } catch (error) {
            auditLog.add({
                action: 'promote',
                userId: req.robloxUserId,
                success: false,
                error: error.message,
                ip: req.ip
            });

            res.status(400).json({
                success: false,
                error: 'Promotion failed',
                errorCode: 'E_PROMOTE',
                message: error.message,
                requestId: req.id
            });
        }
    }
);

/**
 * POST /api/demote
 * Demote a user by one rank
 * Body: { userId: number }
 */
router.post(['/api/demote', '/v1/api/demote'],
    middleware.validateUserId,
    middleware.deduplicateRequest,
    middleware.checkRankCooldown,
    async (req, res, next) => {
        try {
            const userId = req.robloxUserId;
            const result = await ranking.demote(userId);

            auditLog.add({
                action: 'demote',
                userId: userId,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            if (result.success && result.changed) {
                webhook.notifyDemotion(result);
                middleware.recordRankChange(userId);
            }

            res.json(result);

        } catch (error) {
            auditLog.add({
                action: 'demote',
                userId: req.robloxUserId,
                success: false,
                error: error.message,
                ip: req.ip
            });

            res.status(400).json({
                success: false,
                error: 'Demotion failed',
                errorCode: 'E_DEMOTE',
                message: error.message,
                requestId: req.id
            });
        }
    }
);

/**
 * GET /api/rank/:userId
 * Get a user's current rank in the group
 * Params: userId (number)
 * Headers: x-api-key
 */
router.get(['/api/rank/:userId', '/v1/api/rank/:userId'],
    middleware.validateUserId,
    async (req, res, next) => {
        try {
            const userId = req.robloxUserId;
            const rankInfo = await ranking.getUserRank(userId);

            // Get username for better response
            let username = null;
            try {
                username = await ranking.getUsernameFromId(userId);
            } catch (e) {
                // Username lookup failed, continue without it
            }

            res.json({
                success: true,
                userId: userId,
                username: username,
                rank: rankInfo.rank,
                rankName: rankInfo.rankName,
                inGroup: rankInfo.inGroup
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to get rank',
                errorCode: 'E_GET_RANK',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/user/:username
 * Get a user's ID and rank by their username
 * Params: username (string)
 * Headers: x-api-key
 */
router.get(['/api/user/:username', '/v1/api/user/:username'],
    middleware.validateUsername,
    async (req, res, next) => {
        try {
            const username = req.robloxUsername;

            // Get user ID from username
            const userId = await ranking.getUserIdFromUsername(username);

            // Get their rank
            const rankInfo = await ranking.getUserRank(userId);

            res.json({
                success: true,
                userId: userId,
                username: username,
                rank: rankInfo.rank,
                rankName: rankInfo.rankName,
                inGroup: rankInfo.inGroup
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'User lookup failed',
                errorCode: 'E_USER_LOOKUP',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/roles
 * Get all roles in the group
 * Headers: x-api-key
 */
router.get(['/api/roles', '/v1/api/roles'], (req, res) => {
    try {
        const roles = ranking.getAllRoles();

        res.json({
            success: true,
            roles: roles,
            count: roles.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get roles',
            errorCode: 'E_ROLES_FETCH',
            message: error.message
        });
    }
});

/**
 * GET /api/group
 * Get group information including member count
 * Headers: x-api-key
 */
router.get(['/api/group', '/v1/api/group'], async (req, res) => {
    try {
        const noblox = client.getNoblox();
        const groupInfo = await noblox.getGroup(config.roblox.groupId);
        const roles = ranking.getAllRoles();
        const botUser = client.getBotUser();
        const botRank = client.getBotRank();

        res.json({
            success: true,
            group: {
                id: groupInfo.id,
                name: groupInfo.name,
                description: groupInfo.description,
                memberCount: groupInfo.memberCount,
                owner: {
                    userId: groupInfo.owner?.userId,
                    username: groupInfo.owner?.username
                },
                shout: groupInfo.shout ? {
                    body: groupInfo.shout.body,
                    poster: groupInfo.shout.poster?.username,
                    created: groupInfo.shout.created
                } : null
            },
            roles: {
                total: roles.length,
                assignable: roles.filter(r => r.canAssign).length
            },
            bot: {
                username: botUser?.UserName,
                rank: botRank
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get group info',
            errorCode: 'E_GROUP_FETCH',
            message: error.message
        });
    }
});

/**
 * GET /api/roles/:roleId/members
 * Get members of a specific role (paginated)
 * Query: limit (default 100, max 100), cursor (for pagination)
 * Headers: x-api-key
 */
router.get(['/api/roles/:roleId/members', '/v1/api/roles/:roleId/members'], async (req, res) => {
    try {
        const roleId = parseInt(req.params.roleId);
        if (isNaN(roleId) || roleId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid roleId',
                errorCode: 'E_INVALID_ROLE_ID',
                message: 'roleId must be a positive integer'
            });
        }

        const noblox = client.getNoblox();
        const limit = Math.min(parseInt(req.query.limit) || 100, 100);
        const cursor = req.query.cursor || '';

        const result = await noblox.getPlayers(config.roblox.groupId, roleId, limit, cursor);

        res.json({
            success: true,
            roleId: roleId,
            members: result.data || result,
            nextCursor: result.nextPageCursor || null,
            count: (result.data || result).length
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'Failed to get role members',
            errorCode: 'E_ROLE_MEMBERS_FETCH',
            message: error.message
        });
    }
});

/**
 * GET /api/users/batch
 * Get multiple users' ranks in a single request
 * Query: ids=123,456,789 (comma-separated user IDs, max 25)
 * Headers: x-api-key
 */
router.get(['/api/users/batch', '/v1/api/users/batch'], async (req, res) => {
    try {
        const idsParam = req.query.ids;
        if (!idsParam) {
            return res.status(400).json({
                success: false,
                error: 'Missing ids parameter',
                errorCode: 'E_MISSING_IDS',
                message: 'Please provide comma-separated user IDs in the "ids" query parameter'
            });
        }

        const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
        
        if (ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid IDs provided',
                errorCode: 'E_INVALID_IDS',
                message: 'Please provide valid numeric user IDs'
            });
        }

        if (ids.length > 25) {
            return res.status(400).json({
                success: false,
                error: 'Too many IDs',
                errorCode: 'E_TOO_MANY_IDS',
                message: 'Maximum 25 user IDs per batch request'
            });
        }

        // Fetch all users in parallel
        const results = await Promise.all(ids.map(async (userId) => {
            try {
                const rankInfo = await ranking.getUserRank(userId);
                let username = null;
                try {
                    username = await ranking.getUsernameFromId(userId);
                } catch (e) {
                    // Username lookup failed, continue without it
                }
                return {
                    userId,
                    username,
                    rank: rankInfo.rank,
                    rankName: rankInfo.rankName,
                    inGroup: rankInfo.inGroup,
                    success: true
                };
            } catch (error) {
                return {
                    userId,
                    success: false,
                    error: error.message
                };
            }
        }));

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            message: `Fetched ${successful} users successfully, ${failed} failed`,
            users: results,
            count: results.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Batch lookup failed',
            errorCode: 'E_BATCH_LOOKUP',
            message: error.message
        });
    }
});

/**
 * GET /api/metrics
 * Get API metrics and statistics
 * Headers: x-api-key
 */
router.get(['/api/metrics', '/v1/api/metrics'], (req, res) => {
    const uptime = Date.now() - metrics.startTime;
    const logStats = auditLog.getStats();
    const memUsage = process.memoryUsage();
    const securityStats = middleware.getSecurityStats();

    res.json({
        success: true,
        metrics: {
            uptime: {
                ms: uptime,
                seconds: Math.floor(uptime / 1000),
                formatted: formatUptime(uptime)
            },
            requests: {
                total: metrics.totalRequests,
                byMethod: metrics.requestsByMethod,
                byEndpoint: metrics.requestsByEndpoint,
                errors: metrics.errors,
                errorRate: metrics.totalRequests > 0 
                    ? ((metrics.errors / metrics.totalRequests) * 100).toFixed(2) + '%' 
                    : '0%'
            },
            operations: logStats,
            security: {
                lockedIPs: securityStats.lockedIPs.length,
                activeCooldowns: securityStats.activeCooldowns,
                pendingDedupe: securityStats.pendingDedupe
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                memory: {
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    rss: Math.round(memUsage.rss / 1024 / 1024),
                    unit: 'MB'
                }
            }
        }
    });
});

/**
 * GET /api/bot/permissions
 * Get bot's ranking permissions and capabilities
 * Headers: x-api-key
 */
router.get(['/api/bot/permissions', '/v1/api/bot/permissions'], (req, res) => {
    try {
        const botUser = client.getBotUser();
        const botRank = client.getBotRank();
        const roles = ranking.getAllRoles();

        const canAssign = roles.filter(r => r.canAssign);
        const cannotAssign = roles.filter(r => !r.canAssign);

        res.json({
            success: true,
            bot: {
                username: botUser?.UserName,
                userId: botUser?.UserID,
                rank: botRank,
                rankName: roles.find(r => r.rank === botRank)?.name || 'Unknown'
            },
            permissions: {
                canRankUsers: canAssign.length > 0,
                assignableRoles: canAssign.map(r => ({ rank: r.rank, name: r.name })),
                unassignableRoles: cannotAssign.map(r => ({ rank: r.rank, name: r.name, reason: r.rank >= botRank ? 'At or above bot rank' : 'Guest rank' }))
            },
            limits: {
                minRank: config.ranks.min,
                maxRank: config.ranks.max,
                botRank: botRank
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get permissions',
            errorCode: 'E_PERMISSIONS_FETCH',
            message: error.message
        });
    }
});

/**
 * POST /api/rank/username
 * Set a user's rank by their username (convenience endpoint)
 * Body: { username: string, rank: number } OR { username: string, rankName: string }
 */
router.post(['/api/rank/username', '/v1/api/rank/username'],
    middleware.validateUsername,
    middleware.validateRank,
    async (req, res, next) => {
        try {
            const username = req.robloxUsername;
            const { rank, rankName } = req.body;

            if (rank === undefined && !rankName) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'Please provide either "rank" (number) or "rankName" (string)'
                });
            }

            // Get user ID from username
            const userId = await ranking.getUserIdFromUsername(username);

            let result;

            if (rankName) {
                result = await ranking.setRankByName(userId, rankName);
            } else {
                result = await ranking.setRank(userId, parseInt(rank));
            }

            // Add username to result
            result.username = username;

            auditLog.add({
                action: 'setRank',
                userId: userId,
                username: username,
                targetRank: rankName || rank,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            if (result.success && result.changed) {
                webhook.notifyRankChange(result);
            }

            res.json(result);

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Rank change failed',
                errorCode: 'E_RANK_CHANGE_USERNAME',
                message: error.message
            });
        }
    }
);

/**
 * POST /api/promote/username
 * Promote a user by their username
 * Body: { username: string }
 */
router.post(['/api/promote/username', '/v1/api/promote/username'],
    middleware.validateUsername,
    async (req, res, next) => {
        try {
            const username = req.robloxUsername;

            // Get user ID from username
            const userId = await ranking.getUserIdFromUsername(username);
            const result = await ranking.promote(userId);

            // Add username to result
            result.username = username;

            auditLog.add({
                action: 'promote',
                userId: userId,
                username: username,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            if (result.success && result.changed) {
                webhook.notifyPromotion(result);
            }

            res.json(result);

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Promotion failed',
                errorCode: 'E_PROMOTE_USERNAME',
                message: error.message
            });
        }
    }
);

/**
 * POST /api/demote/username
 * Demote a user by their username
 * Body: { username: string }
 */
router.post(['/api/demote/username', '/v1/api/demote/username'],
    middleware.validateUsername,
    async (req, res, next) => {
        try {
            const username = req.robloxUsername;

            // Get user ID from username
            const userId = await ranking.getUserIdFromUsername(username);
            const result = await ranking.demote(userId);

            // Add username to result
            result.username = username;

            auditLog.add({
                action: 'demote',
                userId: userId,
                username: username,
                oldRank: result.oldRank,
                newRank: result.newRank,
                success: result.success,
                ip: req.ip
            });

            if (result.success && result.changed) {
                webhook.notifyDemotion(result);
            }

            res.json(result);

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Demotion failed',
                errorCode: 'E_DEMOTE_USERNAME',
                message: error.message
            });
        }
    }
);

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Validate a single user entry for bulk operations
 * @param {Object} user - User entry to validate
 * @returns {Object} Validation result with valid flag and error message
 */
function validateBulkUserEntry(user) {
    // Must have either userId or username
    if (!user.userId && !user.username) {
        return { valid: false, error: 'Must provide userId or username' };
    }
    
    // Validate userId if provided
    if (user.userId !== undefined) {
        const parsedId = parseInt(user.userId);
        if (isNaN(parsedId) || parsedId <= 0 || parsedId > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: 'Invalid userId - must be a positive integer' };
        }
    }
    
    // Validate username if provided (Roblox: 3-20 chars, alphanumeric + underscore)
    if (user.username !== undefined) {
        if (typeof user.username !== 'string' || 
            user.username.length < 3 || 
            user.username.length > 20 ||
            !/^[a-zA-Z0-9_]+$/.test(user.username)) {
            return { valid: false, error: 'Invalid username - must be 3-20 alphanumeric characters or underscores' };
        }
    }
    
    // Must have either rank or rankName
    if (user.rank === undefined && !user.rankName) {
        return { valid: false, error: 'Must provide rank or rankName' };
    }
    
    // Validate rank if provided
    if (user.rank !== undefined) {
        const parsedRank = parseInt(user.rank);
        if (isNaN(parsedRank) || parsedRank < 0 || parsedRank > 255) {
            return { valid: false, error: 'Invalid rank - must be between 0 and 255' };
        }
    }
    
    // Validate rankName if provided
    if (user.rankName !== undefined && (typeof user.rankName !== 'string' || user.rankName.length === 0)) {
        return { valid: false, error: 'Invalid rankName - must be a non-empty string' };
    }
    
    return { valid: true };
}

/**
 * POST /api/rank/bulk
 * Rank multiple users at once with parallel processing
 * Body: { users: [{ userId: number, rank: number }] } OR { users: [{ username: string, rankName: string }] }
 */
router.post(['/api/rank/bulk', '/v1/api/rank/bulk'],
    async (req, res, next) => {
        try {
            const { users } = req.body;

            if (!users || !Array.isArray(users) || users.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'users array is required'
                });
            }

            if (users.length > 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Too many users',
                    message: 'Maximum 10 users per bulk operation'
                });
            }

            // Validate all entries upfront before processing
            const validationErrors = [];
            for (let i = 0; i < users.length; i++) {
                const validation = validateBulkUserEntry(users[i]);
                if (!validation.valid) {
                    validationErrors.push({ index: i, error: validation.error, user: users[i] });
                }
            }
            
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    message: `${validationErrors.length} user entries failed validation`,
                    validationErrors
                });
            }

            // Process users in parallel for better performance
            const operations = users.map(async (user) => {
                try {
                    let userId = user.userId;
                    let username = user.username;

                    // Get userId from username if needed
                    if (!userId && username) {
                        userId = await ranking.getUserIdFromUsername(username);
                    }

                    if (!userId) {
                        return {
                            userId: user.userId,
                            username: user.username,
                            success: false,
                            error: 'Invalid user identifier'
                        };
                    }

                    let result;
                    if (user.rankName) {
                        result = await ranking.setRankByName(userId, user.rankName);
                    } else if (user.rank !== undefined) {
                        result = await ranking.setRank(userId, user.rank);
                    } else {
                        return {
                            userId,
                            username,
                            success: false,
                            error: 'No rank specified'
                        };
                    }

                    result.username = username;

                    auditLog.add({
                        action: 'setRank',
                        userId,
                        username,
                        oldRank: result.oldRank,
                        newRank: result.newRank,
                        success: result.success,
                        ip: req.ip
                    });

                    return result;

                } catch (error) {
                    return {
                        userId: user.userId,
                        username: user.username,
                        success: false,
                        error: error.message
                    };
                }
            });

            // Wait for all operations to complete
            const results = await Promise.all(operations);

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            res.json({
                success: true,
                message: `Processed ${results.length} users: ${successful} successful, ${failed} failed`,
                results
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Bulk operation failed',
                errorCode: 'E_BULK_OPERATION',
                message: error.message
            });
        }
    }
);

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

/**
 * GET /api/logs
 * Get audit logs
 * Query: action, limit, offset
 */
router.get(['/api/logs', '/v1/api/logs'], (req, res) => {
    try {
        const options = {
            action: req.query.action,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const logs = auditLog.getAll(options);

        res.json({
            success: true,
            ...logs
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get logs',
            errorCode: 'E_LOGS_FETCH',
            message: error.message
        });
    }
});

/**
 * GET /api/stats
 * Get statistics
 */
router.get(['/api/stats', '/v1/api/stats'], (req, res) => {
    try {
        const botUser = client.getBotUser();
        const botRank = client.getBotRank();
        const roles = ranking.getAllRoles();
        const logStats = auditLog.getStats();

        res.json({
            success: true,
            bot: {
                username: botUser?.UserName,
                userId: botUser?.UserID,
                rank: botRank
            },
            group: {
                roleCount: roles.length,
                assignableRoles: roles.filter(r => r.canAssign).length
            },
            operations: logStats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            errorCode: 'E_STATS_FETCH',
            message: error.message
        });
    }
});

// ============================================
// 404 Handler
// ============================================

router.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        errorCode: 'E_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} does not exist`,
        hint: 'All API endpoints support both /api/* and /v1/api/* paths',
        availableEndpoints: {
            health: [
                'GET  /health',
                'GET  /health/detailed'
            ],
            users: [
                'GET  /api/rank/:userId',
                'GET  /api/user/:username',
                'GET  /api/users/batch?ids=1,2,3'
            ],
            ranking: [
                'POST /api/rank',
                'POST /api/rank/username',
                'POST /api/rank/bulk',
                'POST /api/promote',
                'POST /api/promote/username',
                'POST /api/demote',
                'POST /api/demote/username'
            ],
            group: [
                'GET  /api/group',
                'GET  /api/roles',
                'GET  /api/roles/:roleId/members'
            ],
            info: [
                'GET  /api/bot/permissions',
                'GET  /api/metrics',
                'GET  /api/logs',
                'GET  /api/stats'
            ]
        }
    });
});

module.exports = router;
