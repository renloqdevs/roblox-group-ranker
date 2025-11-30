/**
 * API Routes - All ranking endpoints
 * Provides REST API for ranking operations
 */

const express = require('express');
const router = express.Router();
const ranking = require('../roblox/ranking');
const client = require('../roblox/client');
const middleware = require('./middleware');
const auditLog = require('../services/auditLog');
const webhook = require('../services/webhook');

// Initialize webhook service
webhook.initialize();

// Apply authentication to all routes except health check
router.use('/api', middleware.authenticate);

// ============================================
// HEALTH CHECK (No auth required)
// ============================================

/**
 * GET /health
 * Returns server status - useful for uptime monitoring
 */
router.get('/health', (req, res) => {
    const botUser = client.getBotUser();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        bot: botUser ? {
            username: botUser.UserName,
            userId: botUser.UserID
        } : null
    });
});

// ============================================
// RANKING ENDPOINTS
// ============================================

/**
 * POST /api/rank
 * Set a user to a specific rank
 * Body: { userId: number, rank: number } OR { userId: number, rankName: string }
 */
router.post('/api/rank',
    middleware.validateUserId,
    middleware.validateRank,
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
                message: error.message
            });
        }
    }
);

/**
 * POST /api/promote
 * Promote a user by one rank
 * Body: { userId: number }
 */
router.post('/api/promote',
    middleware.validateUserId,
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
                message: error.message
            });
        }
    }
);

/**
 * POST /api/demote
 * Demote a user by one rank
 * Body: { userId: number }
 */
router.post('/api/demote',
    middleware.validateUserId,
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
                message: error.message
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
router.get('/api/rank/:userId',
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
router.get('/api/user/:username',
    async (req, res, next) => {
        try {
            const username = req.params.username;

            if (!username || username.length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid username',
                    message: 'Username must be at least 3 characters'
                });
            }

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
router.get('/api/roles', (req, res) => {
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
            message: error.message
        });
    }
});

/**
 * POST /api/rank/username
 * Set a user's rank by their username (convenience endpoint)
 * Body: { username: string, rank: number } OR { username: string, rankName: string }
 */
router.post('/api/rank/username',
    async (req, res, next) => {
        try {
            const { username, rank, rankName } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'username is required'
                });
            }

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
router.post('/api/promote/username',
    async (req, res, next) => {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'username is required'
                });
            }

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
router.post('/api/demote/username',
    async (req, res, next) => {
        try {
            const { username } = req.body;

            if (!username) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field',
                    message: 'username is required'
                });
            }

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
                message: error.message
            });
        }
    }
);

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * POST /api/rank/bulk
 * Rank multiple users at once
 * Body: { users: [{ userId: number, rank: number }] } OR { users: [{ username: string, rankName: string }] }
 */
router.post('/api/rank/bulk',
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

            const results = [];

            for (const user of users) {
                try {
                    let userId = user.userId;
                    let username = user.username;

                    // Get userId from username if needed
                    if (!userId && username) {
                        userId = await ranking.getUserIdFromUsername(username);
                    }

                    if (!userId) {
                        results.push({
                            userId: user.userId,
                            username: user.username,
                            success: false,
                            error: 'Invalid user identifier'
                        });
                        continue;
                    }

                    let result;
                    if (user.rankName) {
                        result = await ranking.setRankByName(userId, user.rankName);
                    } else if (user.rank !== undefined) {
                        result = await ranking.setRank(userId, user.rank);
                    } else {
                        results.push({
                            userId,
                            username,
                            success: false,
                            error: 'No rank specified'
                        });
                        continue;
                    }

                    result.username = username;
                    results.push(result);

                    auditLog.add({
                        action: 'setRank',
                        userId,
                        username,
                        oldRank: result.oldRank,
                        newRank: result.newRank,
                        success: result.success,
                        ip: req.ip
                    });

                } catch (error) {
                    results.push({
                        userId: user.userId,
                        username: user.username,
                        success: false,
                        error: error.message
                    });
                }
            }

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
router.get('/api/logs', (req, res) => {
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
            message: error.message
        });
    }
});

/**
 * GET /api/stats
 * Get statistics
 */
router.get('/api/stats', (req, res) => {
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
        message: `Endpoint ${req.method} ${req.path} does not exist`,
        availableEndpoints: [
            'GET  /health',
            'GET  /api/rank/:userId',
            'GET  /api/user/:username',
            'GET  /api/roles',
            'GET  /api/logs',
            'GET  /api/stats',
            'POST /api/rank',
            'POST /api/rank/username',
            'POST /api/rank/bulk',
            'POST /api/promote',
            'POST /api/promote/username',
            'POST /api/demote',
            'POST /api/demote/username'
        ]
    });
});

module.exports = router;
