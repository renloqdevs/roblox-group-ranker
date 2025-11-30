/**
 * Help Screen - Usage instructions and keyboard shortcuts
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const input = require('../utils/input');

class HelpScreen {
    constructor(app) {
        this.app = app;
        this.page = 0;
        this.totalPages = 3;
    }

    /**
     * Show the help screen
     */
    async show() {
        this.page = 0;
        await this.render();
        this.setupInput();
    }

    /**
     * Render the screen
     */
    async render() {
        const { width, height } = renderer.getDimensions();

        renderer.clear();
        renderer.hideCursor();

        // Draw main frame
        const { contentY } = components.drawFrame('HELP', `Page ${this.page + 1}/${this.totalPages}`);

        const contentX = 3;

        switch (this.page) {
            case 0:
                this.renderOverviewPage(contentX, contentY + 1, width - 6);
                break;
            case 1:
                this.renderKeyboardPage(contentX, contentY + 1, width - 6);
                break;
            case 2:
                this.renderTroubleshootingPage(contentX, contentY + 1, width - 6);
                break;
        }

        // Key hints
        components.drawKeyHints([
            { key: 'LEFT/RIGHT', action: 'Page' },
            { key: 'ESC', action: 'Back' }
        ]);
    }

    /**
     * Render overview page
     */
    renderOverviewPage(x, y, width) {
        const titleColor = renderer.color('subtitle');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');
        const keyColor = renderer.color('menuKey');

        renderer.writeAt(x, y, `${titleColor}Overview${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        const lines = [
            '',
            'RankBot Console is a terminal interface for managing your Roblox',
            'group rankings. It connects to your self-hosted ranking bot API',
            'and provides an easy way to rank, promote, and demote members.',
            '',
            `${titleColor}Features:${renderer.constructor.ANSI.RESET}`,
            '',
            '  - Set user ranks by username or user ID',
            '  - Promote and demote users by one rank level',
            '  - Search for members and view their information',
            '  - View all available group roles',
            '  - Track activity history with exportable logs',
            '  - Multiple color themes',
            '',
            `${titleColor}Getting Started:${renderer.constructor.ANSI.RESET}`,
            '',
            '  1. Deploy your ranking bot API to Railway (see README)',
            '  2. Go to Settings and enter your API URL and key',
            '  3. Test the connection to verify it works',
            '  4. Start ranking users from the dashboard!'
        ];

        lines.forEach((line, i) => {
            renderer.writeAt(x, y + 2 + i, `${textColor}${line}${renderer.constructor.ANSI.RESET}`);
        });
    }

    /**
     * Render keyboard shortcuts page
     */
    renderKeyboardPage(x, y, width) {
        const titleColor = renderer.color('subtitle');
        const textColor = renderer.color('text');
        const keyColor = renderer.color('menuKey');
        const dimColor = renderer.color('textDim');

        renderer.writeAt(x, y, `${titleColor}Keyboard Shortcuts${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        const shortcuts = [
            { section: 'Global' },
            { key: 'ESC', action: 'Go back / Cancel' },
            { key: 'Q', action: 'Quit application (from dashboard)' },
            { key: 'R', action: 'Refresh current view' },
            { key: '', action: '' },
            { section: 'Navigation' },
            { key: 'UP/DOWN', action: 'Move selection' },
            { key: 'ENTER', action: 'Confirm / Select' },
            { key: 'N/P', action: 'Next / Previous page' },
            { key: '1-9', action: 'Quick select menu item' },
            { key: '', action: '' },
            { section: 'Dashboard' },
            { key: '1', action: 'Rank User' },
            { key: '2', action: 'Promote User' },
            { key: '3', action: 'Demote User' },
            { key: '4', action: 'Search Members' },
            { key: '5', action: 'Favorites' },
            { key: '6', action: 'View Roles' },
            { key: '7', action: 'Activity Logs' },
            { key: '8', action: 'Settings' },
            { key: '9', action: 'Help' }
        ];

        let currentY = y + 3;
        shortcuts.forEach(item => {
            if (item.section) {
                renderer.writeAt(x, currentY, `${titleColor}${item.section}:${renderer.constructor.ANSI.RESET}`);
            } else if (item.key) {
                renderer.writeAt(x + 2, currentY, `${keyColor}[${item.key.padEnd(10)}]${renderer.constructor.ANSI.RESET} ${textColor}${item.action}${renderer.constructor.ANSI.RESET}`);
            }
            currentY++;
        });
    }

    /**
     * Render troubleshooting page
     */
    renderTroubleshootingPage(x, y, width) {
        const titleColor = renderer.color('subtitle');
        const textColor = renderer.color('text');
        const errorColor = renderer.color('error');
        const successColor = renderer.color('success');

        renderer.writeAt(x, y, `${titleColor}Troubleshooting${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        const issues = [
            { problem: 'Connection Failed', solution: 'Check your API URL and key in Settings. Make sure your bot is deployed and running on Railway.' },
            { problem: '', solution: '' },
            { problem: 'User Not Found', solution: 'Verify the username or ID is correct. The user must exist on Roblox.' },
            { problem: '', solution: '' },
            { problem: 'Cannot Rank User', solution: 'The user must be in your group. The bot can only rank users below its own rank level.' },
            { problem: '', solution: '' },
            { problem: 'Cookie Expired', solution: 'Get a new .ROBLOSECURITY cookie from your bot account and update it in Railway.' },
            { problem: '', solution: '' },
            { problem: 'Rate Limited', solution: 'Wait 15 minutes before trying again. You can increase the limit in your .env file.' },
            { problem: '', solution: '' },
            { problem: 'Config Not Saving', solution: 'Make sure you have write permissions to your home directory (~/.rankbot).' }
        ];

        let currentY = y + 3;
        issues.forEach(issue => {
            if (issue.problem) {
                renderer.writeAt(x, currentY, `${errorColor}${issue.problem}${renderer.constructor.ANSI.RESET}`);
                currentY++;
                
                // Word wrap solution
                const words = issue.solution.split(' ');
                let line = '  ';
                words.forEach(word => {
                    if (line.length + word.length > width - 4) {
                        renderer.writeAt(x, currentY, `${textColor}${line}${renderer.constructor.ANSI.RESET}`);
                        currentY++;
                        line = '  ';
                    }
                    line += word + ' ';
                });
                if (line.trim()) {
                    renderer.writeAt(x, currentY, `${textColor}${line}${renderer.constructor.ANSI.RESET}`);
                    currentY++;
                }
            } else {
                currentY++;
            }
        });
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        input.on('escape', () => this.app.showScreen('dashboard'));

        input.on('left', () => {
            if (this.page > 0) {
                this.page--;
                this.render();
            }
        });

        input.on('right', () => {
            if (this.page < this.totalPages - 1) {
                this.page++;
                this.render();
            }
        });

        input.on('p', () => {
            if (this.page > 0) {
                this.page--;
                this.render();
            }
        });

        input.on('n', () => {
            if (this.page < this.totalPages - 1) {
                this.page++;
                this.render();
            }
        });
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
    }
}

module.exports = HelpScreen;
