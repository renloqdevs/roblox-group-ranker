/**
 * Audit Log Service - Tracks all ranking operations
 * Includes memory-efficient log management
 */

class AuditLog {
    constructor() {
        this.logs = [];
        this.maxEntries = 100;
        this.cleanupInterval = null;
        
        // Start periodic cleanup
        this.startCleanup();
    }

    /**
     * Start periodic cleanup of old entries
     */
    startCleanup() {
        // Clean up entries older than 1 hour every 10 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 600000); // 10 minutes
    }

    /**
     * Stop cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Remove entries older than 1 hour
     */
    cleanup() {
        const oneHourAgo = Date.now() - 3600000;
        const beforeCount = this.logs.length;
        this.logs = this.logs.filter(log => 
            new Date(log.timestamp).getTime() > oneHourAgo
        );
        const removed = beforeCount - this.logs.length;
        if (removed > 0) {
            console.log(`\x1b[34m[AUDIT]\x1b[0m Cleaned up ${removed} old log entries`);
        }
    }

    /**
     * Add a log entry
     * @param {Object} entry - Log entry
     */
    add(entry) {
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
            timestamp: new Date().toISOString(),
            action: entry.action,
            userId: entry.userId,
            username: entry.username || null,
            targetRank: entry.targetRank || null,
            oldRank: entry.oldRank || null,
            newRank: entry.newRank || null,
            success: entry.success,
            error: entry.error || null,
            ip: entry.ip || null
        };

        this.logs.unshift(logEntry);

        // Efficient in-place trimming
        if (this.logs.length > this.maxEntries) {
            this.logs.length = this.maxEntries;
        }

        return logEntry;
    }

    /**
     * Get all logs
     * @param {Object} options - Filter options
     */
    getAll(options = {}) {
        let filtered = [...this.logs];

        // Filter by action
        if (options.action) {
            filtered = filtered.filter(log => log.action === options.action);
        }

        // Filter by success
        if (options.success !== undefined) {
            filtered = filtered.filter(log => log.success === options.success);
        }

        // Filter by user
        if (options.userId) {
            filtered = filtered.filter(log => log.userId === options.userId);
        }

        // Pagination
        const limit = options.limit || 50;
        const offset = options.offset || 0;

        return {
            logs: filtered.slice(offset, offset + limit),
            total: filtered.length,
            limit,
            offset
        };
    }

    /**
     * Get log by ID
     */
    getById(id) {
        return this.logs.find(log => log.id === id);
    }

    /**
     * Get recent logs
     */
    getRecent(count = 10) {
        return this.logs.slice(0, count);
    }

    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
    }

    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            successful: this.logs.filter(l => l.success).length,
            failed: this.logs.filter(l => !l.success).length,
            byAction: {}
        };

        this.logs.forEach(log => {
            stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
        });

        return stats;
    }
}

module.exports = new AuditLog();
