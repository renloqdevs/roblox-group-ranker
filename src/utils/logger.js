/**
 * Logger Utility - Configurable logging with levels
 * 
 * Log levels (in order of severity):
 *   error (0) - Only errors
 *   warn  (1) - Warnings and errors
 *   info  (2) - Info, warnings, and errors (default)
 *   debug (3) - All messages including debug
 * 
 * Set via environment variable: LOG_LEVEL=debug
 */

const chalk = require('chalk');

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

class Logger {
    constructor() {
        this.level = this.getLogLevel();
        this.timestamps = process.env.LOG_TIMESTAMPS !== 'false';
    }

    /**
     * Get log level from environment or default to 'info'
     */
    getLogLevel() {
        const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
        return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
    }

    /**
     * Reload log level from environment (useful for runtime changes)
     */
    reload() {
        this.level = this.getLogLevel();
    }

    /**
     * Set log level programmatically
     * @param {string} level - 'error', 'warn', 'info', or 'debug'
     */
    setLevel(level) {
        const normalized = level.toLowerCase();
        if (LOG_LEVELS[normalized] !== undefined) {
            this.level = LOG_LEVELS[normalized];
        }
    }

    /**
     * Get current log level name
     * @returns {string}
     */
    getLevel() {
        return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.level) || 'info';
    }

    /**
     * Format timestamp
     */
    timestamp() {
        if (!this.timestamps) return '';
        return chalk.gray(`[${new Date().toISOString()}] `);
    }

    /**
     * Log an error message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (this.level >= LOG_LEVELS.error) {
            console.error(this.timestamp() + chalk.red('[ERROR]'), message, ...args);
        }
    }

    /**
     * Log a warning message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (this.level >= LOG_LEVELS.warn) {
            console.warn(this.timestamp() + chalk.yellow('[WARN]'), message, ...args);
        }
    }

    /**
     * Log an info message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (this.level >= LOG_LEVELS.info) {
            console.log(this.timestamp() + chalk.blue('[INFO]'), message, ...args);
        }
    }

    /**
     * Log a debug message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (this.level >= LOG_LEVELS.debug) {
            console.log(this.timestamp() + chalk.magenta('[DEBUG]'), message, ...args);
        }
    }

    /**
     * Log a success message (always shown at info level)
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments
     */
    success(message, ...args) {
        if (this.level >= LOG_LEVELS.info) {
            console.log(this.timestamp() + chalk.green('[OK]'), message, ...args);
        }
    }

    /**
     * Log an API request (debug level)
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {number} status - Response status code
     * @param {number} duration - Request duration in ms
     */
    request(method, path, status, duration) {
        if (this.level >= LOG_LEVELS.debug) {
            const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;
            console.log(
                this.timestamp() + 
                chalk.gray('[REQ]'),
                chalk.cyan(method.padEnd(6)),
                path,
                statusColor(status),
                chalk.gray(`${duration}ms`)
            );
        }
    }

    /**
     * Log a rank operation
     * @param {string} action - 'rank', 'promote', 'demote'
     * @param {number} userId - Target user ID
     * @param {string} username - Target username
     * @param {number} oldRank - Old rank number
     * @param {number} newRank - New rank number
     * @param {boolean} success - Whether operation succeeded
     */
    rankOperation(action, userId, username, oldRank, newRank, success) {
        if (this.level >= LOG_LEVELS.info) {
            const actionColor = success ? chalk.green : chalk.red;
            const arrow = success ? chalk.white('->') : chalk.red('X');
            console.log(
                this.timestamp() +
                actionColor(`[${action.toUpperCase()}]`),
                chalk.white(username),
                chalk.gray(`(${userId})`),
                chalk.yellow(oldRank),
                arrow,
                chalk.cyan(newRank)
            );
        }
    }

    /**
     * Create a child logger with a prefix
     * @param {string} prefix - Prefix for all log messages
     * @returns {Object} Logger-like object with prefix
     */
    child(prefix) {
        const parent = this;
        const formattedPrefix = chalk.gray(`[${prefix}]`) + ' ';
        
        return {
            error: (msg, ...args) => parent.error(formattedPrefix + msg, ...args),
            warn: (msg, ...args) => parent.warn(formattedPrefix + msg, ...args),
            info: (msg, ...args) => parent.info(formattedPrefix + msg, ...args),
            debug: (msg, ...args) => parent.debug(formattedPrefix + msg, ...args),
            success: (msg, ...args) => parent.success(formattedPrefix + msg, ...args)
        };
    }
}

// Export singleton instance
module.exports = new Logger();
