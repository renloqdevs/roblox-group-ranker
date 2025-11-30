/**
 * Logs Screen - Activity logs viewer
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const input = require('../utils/input');
const format = require('../utils/format');
const config = require('../services/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LogsScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            logs: [],
            filter: 'all', // 'all', 'rank', 'promote', 'demote', 'error'
            page: 0,
            pageSize: 15,
            selectedIndex: 0
        };
    }

    /**
     * Show the logs screen
     */
    async show() {
        this.state.logs = config.getActivityLog();
        this.state.page = 0;
        this.state.selectedIndex = 0;

        await this.render();
        this.setupInput();
    }

    /**
     * Get filtered logs
     */
    getFilteredLogs() {
        if (this.state.filter === 'all') {
            return this.state.logs;
        }
        return this.state.logs.filter(log => 
            log.action.toLowerCase() === this.state.filter.toLowerCase()
        );
    }

    /**
     * Render the screen
     */
    async render() {
        const { width, height } = renderer.getDimensions();

        renderer.clear();
        renderer.hideCursor();

        // Draw main frame
        const { contentY } = components.drawFrame('ACTIVITY LOGS', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        // Filter tabs
        this.renderFilterTabs(contentX, currentY, width - 6);
        currentY += 3;

        // Logs table
        const filteredLogs = this.getFilteredLogs();
        this.renderLogsTable(contentX, currentY, width - 6, height - currentY - 5, filteredLogs);

        // Footer with pagination
        const totalPages = Math.ceil(filteredLogs.length / this.state.pageSize) || 1;
        const footerY = height - 3;
        
        components.drawPagination(contentX, footerY, this.state.page + 1, totalPages, filteredLogs.length);

        // Key hints
        components.drawKeyHints([
            { key: '1-5', action: 'Filter' },
            { key: 'N/P', action: 'Page' },
            { key: 'E', action: 'Export' },
            { key: 'C', action: 'Clear' },
            { key: 'ESC', action: 'Back' }
        ]);
    }

    /**
     * Render filter tabs
     */
    renderFilterTabs(x, y, width) {
        const filters = [
            { key: '1', label: 'All', value: 'all' },
            { key: '2', label: 'Rank', value: 'rank' },
            { key: '3', label: 'Promote', value: 'promote' },
            { key: '4', label: 'Demote', value: 'demote' },
            { key: '5', label: 'Error', value: 'error' }
        ];

        const activeColor = renderer.color('menuSelected');
        const inactiveColor = renderer.color('textDim');
        const keyColor = renderer.color('menuKey');

        renderer.writeAt(x, y, `${renderer.color('label')}Filter:${renderer.constructor.ANSI.RESET} `);

        let xOffset = x + 8;
        filters.forEach(filter => {
            const isActive = this.state.filter === filter.value;
            const color = isActive ? activeColor : inactiveColor;
            const prefix = isActive ? '[' : ' ';
            const suffix = isActive ? ']' : ' ';

            renderer.writeAt(xOffset, y, `${keyColor}${filter.key}${renderer.constructor.ANSI.RESET}${color}${prefix}${filter.label}${suffix}${renderer.constructor.ANSI.RESET}`);
            xOffset += filter.label.length + 5;
        });

        components.drawSeparator(x, y + 1, width);
    }

    /**
     * Render logs table
     */
    renderLogsTable(x, y, width, maxHeight, logs) {
        const headerColor = renderer.color('tableHeader');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');

        // Column widths
        const cols = {
            time: 10,
            action: 10,
            message: width - 24
        };

        // Header
        const header = `${format.pad('Time', cols.time)} ${format.pad('Action', cols.action)} Message`;
        renderer.writeAt(x, y, `${headerColor}${header}${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        if (logs.length === 0) {
            renderer.writeAt(x, y + 3, `${dimColor}No activity logs${renderer.constructor.ANSI.RESET}`);
            return;
        }

        // Calculate page bounds
        const startIndex = this.state.page * this.state.pageSize;
        const endIndex = Math.min(startIndex + this.state.pageSize, logs.length);
        const pageLogs = logs.slice(startIndex, endIndex);

        // Action colors
        const actionColors = {
            'RANK': renderer.color('info'),
            'PROMOTE': renderer.color('success'),
            'DEMOTE': renderer.color('warning'),
            'ERROR': renderer.color('error')
        };

        pageLogs.forEach((log, i) => {
            const time = format.timestamp(log.timestamp);
            const actionColor = actionColors[log.action] || textColor;
            
            const row = `${dimColor}${format.pad(time, cols.time)}${renderer.constructor.ANSI.RESET} ` +
                       `${actionColor}${format.pad(log.action, cols.action)}${renderer.constructor.ANSI.RESET} ` +
                       `${textColor}${format.truncate(log.message, cols.message)}${renderer.constructor.ANSI.RESET}`;

            renderer.writeAt(x, y + 2 + i, row);
        });
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        input.on('escape', () => this.app.showScreen('dashboard'));

        // Filter keys
        input.on('1', () => this.setFilter('all'));
        input.on('2', () => this.setFilter('rank'));
        input.on('3', () => this.setFilter('promote'));
        input.on('4', () => this.setFilter('demote'));
        input.on('5', () => this.setFilter('error'));

        // Pagination
        input.on('n', () => this.nextPage());
        input.on('p', () => this.prevPage());
        input.on('pagedown', () => this.nextPage());
        input.on('pageup', () => this.prevPage());

        // Actions
        input.on('e', () => this.exportLogs());
        input.on('c', () => this.confirmClear());
        input.on('r', () => this.refresh());
    }

    /**
     * Set filter
     */
    setFilter(filter) {
        this.state.filter = filter;
        this.state.page = 0;
        this.render();
    }

    /**
     * Next page
     */
    nextPage() {
        const filteredLogs = this.getFilteredLogs();
        const totalPages = Math.ceil(filteredLogs.length / this.state.pageSize);
        
        if (this.state.page < totalPages - 1) {
            this.state.page++;
            this.render();
        }
    }

    /**
     * Previous page
     */
    prevPage() {
        if (this.state.page > 0) {
            this.state.page--;
            this.render();
        }
    }

    /**
     * Export logs to CSV
     */
    async exportLogs() {
        const logs = this.getFilteredLogs();
        
        if (logs.length === 0) {
            components.drawAlert('Export', 'No logs to export', 'warning');
            await input.waitForAnyKey();
            this.render();
            return;
        }

        // Create CSV content
        const headers = ['Timestamp', 'Action', 'User ID', 'Username', 'Message'];
        const csvLines = [headers.join(',')];

        logs.forEach(log => {
            const row = [
                `"${log.timestamp}"`,
                `"${log.action}"`,
                `"${log.userId || ''}"`,
                `"${log.username || ''}"`,
                `"${(log.message || '').replace(/"/g, '""')}"`
            ];
            csvLines.push(row.join(','));
        });

        const csvContent = csvLines.join('\n');

        // Save to file
        const filename = `rankbot_logs_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(os.homedir(), 'Downloads', filename);

        try {
            fs.writeFileSync(filepath, csvContent);
            components.drawAlert('Export Successful', `Saved to: ${filepath}`, 'success');
        } catch (e) {
            // Try current directory as fallback
            const fallbackPath = path.join(process.cwd(), filename);
            try {
                fs.writeFileSync(fallbackPath, csvContent);
                components.drawAlert('Export Successful', `Saved to: ${fallbackPath}`, 'success');
            } catch (e2) {
                components.drawAlert('Export Failed', e2.message, 'error');
            }
        }

        await input.waitForAnyKey();
        this.render();
        this.setupInput();
    }

    /**
     * Confirm clear logs
     */
    async confirmClear() {
        components.drawConfirmDialog('Clear all activity logs?');
        
        const confirmed = await input.confirm(false);
        
        if (confirmed) {
            config.clearActivityLog();
            this.state.logs = [];
            this.state.page = 0;
        }

        this.render();
        this.setupInput();
    }

    /**
     * Refresh logs
     */
    refresh() {
        this.state.logs = config.getActivityLog();
        this.render();
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
    }
}

module.exports = LogsScreen;
