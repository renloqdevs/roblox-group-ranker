/**
 * Format Utilities - Data formatting helpers
 */

class Format {
    /**
     * Format number with commas
     */
    number(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Format duration from seconds
     */
    duration(seconds) {
        if (!seconds || seconds < 0) return '0s';
        
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        } else if (m > 0) {
            return `${m}m ${s}s`;
        } else {
            return `${s}s`;
        }
    }

    /**
     * Format duration from milliseconds
     */
    durationMs(ms) {
        return this.duration(Math.floor(ms / 1000));
    }

    /**
     * Format relative time (e.g., "2 minutes ago")
     */
    relativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        
        return then.toLocaleDateString();
    }

    /**
     * Format timestamp
     */
    timestamp(date) {
        const d = new Date(date);
        return d.toLocaleTimeString();
    }

    /**
     * Format full date and time
     */
    dateTime(date) {
        const d = new Date(date);
        return d.toLocaleString();
    }

    /**
     * Format date only
     */
    date(date) {
        const d = new Date(date);
        return d.toLocaleDateString();
    }

    /**
     * Truncate string with ellipsis
     */
    truncate(str, maxLength, suffix = '...') {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Pad string to width
     */
    pad(str, width, align = 'left', char = ' ') {
        str = String(str || '');
        if (str.length >= width) return str.substring(0, width);
        
        const padding = width - str.length;
        
        if (align === 'center') {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return char.repeat(leftPad) + str + char.repeat(rightPad);
        } else if (align === 'right') {
            return char.repeat(padding) + str;
        } else {
            return str + char.repeat(padding);
        }
    }

    /**
     * Format rank display
     */
    rank(rankNum, rankName) {
        if (rankName) {
            return `${rankName} (${rankNum})`;
        }
        return String(rankNum);
    }

    /**
     * Format user ID
     */
    userId(id) {
        return String(id || 'N/A');
    }

    /**
     * Format boolean as Yes/No
     */
    yesNo(value) {
        return value ? 'Yes' : 'No';
    }

    /**
     * Format boolean as checkmark
     */
    checkmark(value) {
        return value ? '[*]' : '[ ]';
    }

    /**
     * Format percentage
     */
    percent(value, decimals = 0) {
        if (value === null || value === undefined) return '0%';
        return value.toFixed(decimals) + '%';
    }

    /**
     * Format bytes to human readable
     */
    bytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
    }

    /**
     * Format action type for logs
     */
    actionType(action) {
        const types = {
            'setRank': 'RANK',
            'promote': 'PROMOTE',
            'demote': 'DEMOTE',
            'error': 'ERROR'
        };
        return types[action] || action.toUpperCase();
    }

    /**
     * Format status indicator
     */
    status(status) {
        const indicators = {
            'online': '[ONLINE]',
            'offline': '[OFFLINE]',
            'error': '[ERROR]',
            'loading': '[...]'
        };
        return indicators[status] || `[${status.toUpperCase()}]`;
    }

    /**
     * Create a visual bar
     */
    bar(value, max, width = 20, filled = '=', empty = ' ') {
        const percent = Math.min(value / max, 1);
        const filledCount = Math.floor(width * percent);
        const emptyCount = width - filledCount;
        
        return '[' + filled.repeat(filledCount) + empty.repeat(emptyCount) + ']';
    }

    /**
     * Format table row
     */
    tableRow(cells, widths, separator = ' | ') {
        return cells.map((cell, i) => this.pad(String(cell), widths[i])).join(separator);
    }

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Format error message
     */
    error(err) {
        if (typeof err === 'string') return err;
        if (err.message) return err.message;
        return String(err);
    }

    /**
     * Mask sensitive data
     */
    mask(str, visibleChars = 4) {
        if (!str) return '';
        if (str.length <= visibleChars * 2) return '*'.repeat(str.length);
        
        const start = str.substring(0, visibleChars);
        const end = str.substring(str.length - visibleChars);
        const middle = '*'.repeat(Math.min(str.length - visibleChars * 2, 20));
        
        return start + middle + end;
    }

    /**
     * Format API URL for display
     */
    apiUrl(url) {
        if (!url) return 'Not configured';
        try {
            const u = new URL(url);
            return u.hostname;
        } catch {
            return url;
        }
    }

    /**
     * Create column layout
     */
    columns(items, columnCount, columnWidth) {
        const rows = [];
        for (let i = 0; i < items.length; i += columnCount) {
            const rowItems = items.slice(i, i + columnCount);
            rows.push(rowItems.map(item => this.pad(item, columnWidth)).join('  '));
        }
        return rows;
    }
}

module.exports = new Format();
