/**
 * Dashboard Screen - Main menu and status overview
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class DashboardScreen {
    constructor(app) {
        this.app = app;
        this.refreshInterval = null;
        this.startTime = Date.now();
    }

    /**
     * Show the dashboard
     */
    async show() {
        this.startTime = Date.now();
        await this.render();
        this.setupInput();
        this.startAutoRefresh();
    }

    /**
     * Render the dashboard
     */
    async render() {
        const { width, height } = renderer.getDimensions();

        renderer.clear();
        renderer.hideCursor();

        // Draw main frame
        const { contentY } = components.drawFrame('RANKBOT CONSOLE', 'v1.0.0');

        // Status section
        this.renderStatusSection(3, contentY + 1, width - 6);

        // Menu section
        this.renderMenuSection(3, contentY + 7, width - 6);

        // Recent activity section
        this.renderActivitySection(3, contentY + 17, width - 6, height - contentY - 20);

        // Key hints
        components.drawKeyHints([
            { key: '1-8', action: 'Select' },
            { key: 'R', action: 'Refresh' },
            { key: 'Q', action: 'Quit' }
        ]);
    }

    /**
     * Render status section
     */
    renderStatusSection(x, y, width) {
        const borderColor = renderer.color('border');
        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');
        const dimColor = renderer.color('textDim');

        // Status box
        components.drawSeparator(x, y, width);
        
        const botInfo = api.getBotInfo() || config.getBotInfo();
        const connected = api.isConnected();
        const stats = config.getStats();
        
        // Left column - Bot info
        renderer.writeAt(x, y + 1, `${labelColor}Bot:${renderer.constructor.ANSI.RESET}     ${textColor}${botInfo?.username || 'Not connected'}${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 2, `${labelColor}Status:${renderer.constructor.ANSI.RESET}  ${connected ? successColor + 'Online' : errorColor + 'Offline'}${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 3, `${labelColor}Uptime:${renderer.constructor.ANSI.RESET}  ${textColor}${format.duration(Math.floor((Date.now() - this.startTime) / 1000))}${renderer.constructor.ANSI.RESET}`);

        // Right column - Group info
        const rightX = x + Math.floor(width / 2);
        const groupInfo = config.getBotInfo();
        
        renderer.writeAt(rightX, y + 1, `${labelColor}Group:${renderer.constructor.ANSI.RESET}   ${textColor}${groupInfo.groupName || 'Unknown'}${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(rightX, y + 2, `${labelColor}Group ID:${renderer.constructor.ANSI.RESET} ${textColor}${groupInfo.groupId || 'N/A'}${renderer.constructor.ANSI.RESET}`);
        
        // Stats
        const totalOps = stats.totalRankChanges + stats.totalPromotions + stats.totalDemotions;
        renderer.writeAt(rightX, y + 3, `${labelColor}Operations:${renderer.constructor.ANSI.RESET} ${textColor}${format.number(totalOps)}${renderer.constructor.ANSI.RESET}`);

        components.drawSeparator(x, y + 5, width);
    }

    /**
     * Render menu section
     */
    renderMenuSection(x, y, width) {
        const keyColor = renderer.color('menuKey');
        const textColor = renderer.color('menuItem');

        const leftMenuItems = [
            { key: '1', label: 'Rank User' },
            { key: '2', label: 'Promote User' },
            { key: '3', label: 'Demote User' },
            { key: '4', label: 'Search Members' }
        ];

        const rightMenuItems = [
            { key: '5', label: 'View Roles' },
            { key: '6', label: 'Activity Logs' },
            { key: '7', label: 'Settings' },
            { key: '8', label: 'Help' }
        ];

        // Left column
        leftMenuItems.forEach((item, i) => {
            renderer.writeAt(x + 2, y + i, 
                `${keyColor}[${item.key}]${renderer.constructor.ANSI.RESET} ${textColor}${item.label}${renderer.constructor.ANSI.RESET}`
            );
        });

        // Right column
        const rightX = x + Math.floor(width / 2);
        rightMenuItems.forEach((item, i) => {
            renderer.writeAt(rightX, y + i, 
                `${keyColor}[${item.key}]${renderer.constructor.ANSI.RESET} ${textColor}${item.label}${renderer.constructor.ANSI.RESET}`
            );
        });

        // Quit option
        renderer.writeAt(x + 2, y + 5, 
            `${keyColor}[Q]${renderer.constructor.ANSI.RESET} ${textColor}Quit${renderer.constructor.ANSI.RESET}`
        );
    }

    /**
     * Render activity section
     */
    renderActivitySection(x, y, width, maxHeight) {
        const borderColor = renderer.color('border');
        const titleColor = renderer.color('subtitle');
        const dimColor = renderer.color('textDim');

        // Section title
        renderer.writeAt(x, y, `${titleColor}Recent Activity${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        // Get recent logs
        const logs = config.getActivityLog(maxHeight - 2);

        if (logs.length === 0) {
            renderer.writeAt(x, y + 2, `${dimColor}No recent activity${renderer.constructor.ANSI.RESET}`);
            return;
        }

        // Render log entries
        components.drawLogEntries(x, y + 2, logs, maxHeight - 2);
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        // Menu options
        input.on('1', () => this.app.showScreen('rank'));
        input.on('2', () => this.app.showScreen('promote'));
        input.on('3', () => this.app.showScreen('demote'));
        input.on('4', () => this.app.showScreen('search'));
        input.on('5', () => this.app.showScreen('roles'));
        input.on('6', () => this.app.showScreen('logs'));
        input.on('7', () => this.app.showScreen('settings'));
        input.on('8', () => this.app.showScreen('help'));

        // Refresh
        input.on('r', () => this.refresh());

        // Quit
        input.on('q', () => this.confirmQuit());
        input.on('escape', () => this.confirmQuit());
    }

    /**
     * Refresh the dashboard
     */
    async refresh() {
        // Test connection
        if (config.isConfigured()) {
            await api.testConnection();
        }
        await this.render();
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        if (config.getPreference('autoRefresh')) {
            const interval = config.getPreference('autoRefreshInterval') || 30000;
            this.refreshInterval = setInterval(() => {
                this.render();
            }, interval);
        }
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Confirm quit
     */
    async confirmQuit() {
        const { width, height } = renderer.getDimensions();
        
        components.drawConfirmDialog('Are you sure you want to quit?');
        
        const confirmed = await input.confirm(false);
        
        if (confirmed) {
            this.stopAutoRefresh();
            input.cleanup();
            process.exit(0);
        } else {
            await this.render();
            this.setupInput();
        }
    }

    /**
     * Hide/cleanup
     */
    hide() {
        this.stopAutoRefresh();
        input.clearListeners();
    }
}

module.exports = DashboardScreen;
