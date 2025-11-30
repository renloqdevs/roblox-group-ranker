/**
 * Audit Log Service - Tracks all ranking operations
 */

class AuditLog {
    constructor() {
        this.logs = [];
        this.maxEntries = 100;
    }

    /**
     * Add a log entry
     * @param {Object} entry - Log entry
     */
    add(entry) {
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
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

        // Trim to max entries
        if (this.logs.length > this.maxEntries) {
            this.logs = this.logs.slice(0, this.maxEntries);
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
