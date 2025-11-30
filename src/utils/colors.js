/**
 * Shared color constants and logging utilities
 * Centralizes ANSI color codes to avoid duplication
 */

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

/**
 * Structured logging utilities
 */
const log = {
    error: (tag, msg) => console.error(`${colors.red}${colors.bold}[${tag}]${colors.reset} ${msg}`),
    warn: (tag, msg) => console.warn(`${colors.yellow}[${tag}]${colors.reset} ${msg}`),
    info: (tag, msg) => console.log(`${colors.blue}[${tag}]${colors.reset} ${msg}`),
    success: (tag, msg) => console.log(`${colors.green}${colors.bold}[${tag}]${colors.reset} ${msg}`),
    debug: (tag, msg) => console.log(`${colors.dim}[${tag}] ${msg}${colors.reset}`)
};

module.exports = { colors, log };
