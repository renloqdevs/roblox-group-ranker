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
        const { contentY } = components.drawFrame('RANKBOT CONSOLE', 'v1.1.1');

        let yOffset = 0;

        // Demo mode banner
        if (config.isInDemoMode()) {
            this.renderDemoModeBanner(3, contentY + 1, width - 6);
            yOffset = 3;
        }

        // Status section
        this.renderStatusSection(3, contentY + 1 + yOffset, width - 6);

        // Menu section
        this.renderMenuSection(3, contentY + 7 + yOffset, width - 6);

        // Recent activity section
        this.renderActivitySection(3, contentY + 18 + yOffset, width - 6, height - contentY - 21 - yOffset);

        // Key hints
        const hints = [
            { key: '1-9', action: 'Select' },
            { key: 'R', action: 'Refresh' },
            { key: 'Q', action: 'Quit' }
        ];
        
        if (config.isInDemoMode()) {
            hints.unshift({ key: 'S', action: 'Run Setup' });
        }
        
        // Add undo hint if available
        if (config.canUndo()) {
            hints.splice(hints.length - 1, 0, { key: 'Z', action: 'Undo' });
        }
        
        components.drawKeyHints(hints);
    }

    /**
     * Render demo mode banner
     */
    renderDemoModeBanner(x, y, width) {
        const warningColor = renderer.color('warning');
        const dimColor = renderer.color('textDim');
        const keyColor = renderer.color('menuKey');

        const bannerText = ' DEMO MODE ';
        const message = 'Ranking features disabled';
        
        renderer.writeAt(x, y, `${warningColor}>>>${bannerText}<<<${renderer.constructor.ANSI.RESET} ${dimColor}${message} - Press ${keyColor}[S]${dimColor} to configure${renderer.constructor.ANSI.RESET}`);
        
        components.drawSeparator(x, y + 1, width);
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
        const dimColor = renderer.color('textDim');

        const favorites = config.getFavorites();
        const favCount = favorites.length > 0 ? ` (${favorites.length})` : '';

        const leftMenuItems = [
            { key: '1', label: 'Rank User' },
            { key: '2', label: 'Promote User' },
            { key: '3', label: 'Demote User' },
            { key: '4', label: 'Search Members' },
            { key: '5', label: `Favorites${favCount}` }
        ];

        const rightMenuItems = [
            { key: '6', label: 'View Roles' },
            { key: '7', label: 'Activity Logs' },
            { key: '8', label: 'Settings' },
            { key: '9', label: 'Help' }
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
        renderer.writeAt(x + 2, y + 6, 
            `${keyColor}[Q]${renderer.constructor.ANSI.RESET} ${textColor}Quit${renderer.constructor.ANSI.RESET}`
        );

        // Quick tip
        renderer.writeAt(x, y + 8, 
            `${dimColor}Tip: Add users to Favorites for quick repeat ranking${renderer.constructor.ANSI.RESET}`
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

        // Menu options - wrap API-dependent screens with demo mode check
        input.on('1', () => this.navigateWithDemoCheck('rank'));
        input.on('2', () => this.navigateWithDemoCheck('promote'));
        input.on('3', () => this.navigateWithDemoCheck('demote'));
        input.on('4', () => this.navigateWithDemoCheck('search'));
        input.on('5', () => this.app.showScreen('favorites')); // Favorites works in demo mode
        input.on('6', () => this.navigateWithDemoCheck('roles'));
        input.on('7', () => this.app.showScreen('logs')); // Logs works in demo mode
        input.on('8', () => this.app.showScreen('settings'));
        input.on('9', () => this.app.showScreen('help'));

        // Setup shortcut for demo mode
        if (config.isInDemoMode()) {
            input.on('s', () => this.startSetup());
        }

        // Refresh
        input.on('r', () => this.refresh());

        // Undo last action
        input.on('z', () => this.confirmUndo());

        // Quit - only Q key, ESC does nothing on dashboard (it's the main screen)
        input.on('q', () => this.confirmQuit());
    }

    /**
     * Navigate to screen with demo mode check
     */
    async navigateWithDemoCheck(screen) {
        if (config.isInDemoMode()) {
            await this.showDemoModePrompt(screen);
        } else {
            this.app.showScreen(screen);
        }
    }

    /**
     * Show demo mode prompt when trying to access restricted features
     */
    async showDemoModePrompt(targetScreen) {
        const screenNames = {
            'rank': 'Rank User',
            'promote': 'Promote User',
            'demote': 'Demote User',
            'search': 'Search Members',
            'roles': 'View Roles'
        };

        components.drawConfirmDialog(
            `"${screenNames[targetScreen]}" requires setup.`,
            'Would you like to configure your API connection now?'
        );
        
        const confirmed = await input.confirm(true);
        
        if (confirmed) {
            this.startSetup();
        } else {
            await this.render();
            this.setupInput();
        }
    }

    /**
     * Start setup process (exit demo mode)
     */
    startSetup() {
        config.exitDemoMode();
        this.app.showScreen('setup');
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
     * Confirm and execute undo
     */
    async confirmUndo() {
        const lastAction = config.getLastAction();
        
        if (!lastAction) {
            // No action to undo
            await this.render();
            this.setupInput();
            return;
        }

        const actionType = lastAction.type.charAt(0).toUpperCase() + lastAction.type.slice(1);
        
        components.drawConfirmDialog(
            `Undo ${actionType}?`,
            `Revert ${lastAction.username} from ${lastAction.newRankName} back to ${lastAction.oldRankName}?`
        );
        
        const confirmed = await input.confirm(false);
        
        if (confirmed) {
            await this.executeUndo(lastAction);
        } else {
            await this.render();
            this.setupInput();
        }
    }

    /**
     * Execute the undo operation
     */
    async executeUndo(lastAction) {
        const { width, height } = renderer.getDimensions();
        const dimColor = renderer.color('textDim');
        
        // Show progress
        renderer.clear();
        const { contentY } = components.drawFrame('UNDO OPERATION', '');
        renderer.writeAt(3, contentY + 2, `${dimColor}Reverting ${lastAction.username} to ${lastAction.oldRankName}...${renderer.constructor.ANSI.RESET}`);
        
        try {
            const result = await api.setRank(lastAction.userId, lastAction.oldRank);
            
            if (result.success) {
                const successColor = renderer.color('success');
                renderer.writeAt(3, contentY + 4, `${successColor}Undo successful!${renderer.constructor.ANSI.RESET}`);
                
                // Log the undo
                config.addLogEntry({
                    action: 'UNDO',
                    userId: lastAction.userId,
                    username: lastAction.username,
                    message: `Reverted ${lastAction.username}: ${lastAction.newRankName} -> ${lastAction.oldRankName}`
                });
                
                // Clear the last action
                config.clearLastAction();
            } else {
                const errorColor = renderer.color('error');
                renderer.writeAt(3, contentY + 4, `${errorColor}Undo failed: ${result.message}${renderer.constructor.ANSI.RESET}`);
            }
        } catch (e) {
            const errorColor = renderer.color('error');
            renderer.writeAt(3, contentY + 4, `${errorColor}Undo failed: ${e.message}${renderer.constructor.ANSI.RESET}`);
        }
        
        renderer.writeAt(3, contentY + 6, `${dimColor}Press any key to continue...${renderer.constructor.ANSI.RESET}`);
        
        await input.waitForAnyKey();
        await this.render();
        this.setupInput();
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
