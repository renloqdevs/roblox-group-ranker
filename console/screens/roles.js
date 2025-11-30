/**
 * Roles Screen - View group roles
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class RolesScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            roles: [],
            loading: true,
            error: null,
            selectedIndex: 0
        };
    }

    /**
     * Show the roles screen
     */
    async show() {
        this.state = {
            roles: [],
            loading: true,
            error: null,
            selectedIndex: 0
        };

        await this.loadRoles();
        await this.render();
        this.setupInput();
    }

    /**
     * Load roles from API or cache
     */
    async loadRoles() {
        // Try cache first
        const cached = config.getCachedRoles();
        if (cached) {
            this.state.roles = cached;
            this.state.loading = false;
            return;
        }

        // Load from API
        try {
            const result = await api.getRoles();
            if (result.success) {
                this.state.roles = result.roles;
                config.cacheRoles(result.roles);
            } else {
                this.state.error = result.message;
            }
        } catch (e) {
            this.state.error = e.message;
        }

        this.state.loading = false;
    }

    /**
     * Render the screen
     */
    async render() {
        const { width, height } = renderer.getDimensions();

        renderer.clear();
        renderer.hideCursor();

        // Draw main frame
        const { contentY } = components.drawFrame('GROUP ROLES', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        if (this.state.loading) {
            renderer.writeAt(contentX, currentY, `${renderer.color('textDim')}Loading roles...${renderer.constructor.ANSI.RESET}`);
            return;
        }

        if (this.state.error) {
            renderer.writeAt(contentX, currentY, `${renderer.color('error')}Error: ${this.state.error}${renderer.constructor.ANSI.RESET}`);
            return;
        }

        // Group info
        const groupInfo = config.getBotInfo();
        const botInfo = api.getBotInfo();

        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');

        renderer.writeAt(contentX, currentY, `${labelColor}Group:${renderer.constructor.ANSI.RESET} ${textColor}${groupInfo.groupName || 'Unknown'}${renderer.constructor.ANSI.RESET} (ID: ${groupInfo.groupId || 'N/A'})`);
        renderer.writeAt(contentX, currentY + 1, `${labelColor}Total Roles:${renderer.constructor.ANSI.RESET} ${textColor}${this.state.roles.length}${renderer.constructor.ANSI.RESET}`);

        components.drawSeparator(contentX, currentY + 3, width - 6);

        // Roles table
        const tableY = currentY + 5;
        this.renderRolesTable(contentX, tableY, width - 6, height - tableY - 4);

        // Key hints
        components.drawKeyHints([
            { key: 'UP/DOWN', action: 'Navigate' },
            { key: 'R', action: 'Refresh' },
            { key: 'ESC', action: 'Back' }
        ]);
    }

    /**
     * Render roles table
     */
    renderRolesTable(x, y, width, maxHeight) {
        const borderColor = renderer.color('border');
        const headerColor = renderer.color('tableHeader');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');
        const selectedColor = renderer.color('menuSelected');

        // Column widths
        const cols = {
            rank: 6,
            name: 25,
            members: 10,
            canAssign: 15
        };

        // Header
        const header = `${format.pad('Rank', cols.rank)} ${format.pad('Name', cols.name)} ${format.pad('Members', cols.members)} ${format.pad('Bot Can Assign', cols.canAssign)}`;
        renderer.writeAt(x, y, `${headerColor}${header}${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        // Sort roles by rank descending
        const sortedRoles = [...this.state.roles].sort((a, b) => b.rank - a.rank);

        // Calculate visible range
        const maxVisible = Math.min(maxHeight - 3, sortedRoles.length);
        const startIndex = Math.max(0, this.state.selectedIndex - Math.floor(maxVisible / 2));
        const endIndex = Math.min(sortedRoles.length, startIndex + maxVisible);

        // Render rows
        sortedRoles.slice(startIndex, endIndex).forEach((role, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === this.state.selectedIndex;
            const isBotRole = role.rank === api.getBotInfo()?.rank;
            
            const rowColor = isSelected ? selectedColor : textColor;
            const prefix = isSelected ? '>' : ' ';
            
            const canAssignText = role.canAssign ? 'Yes' : 'No';
            const canAssignColor = role.canAssign ? successColor : dimColor;
            
            let roleLabel = role.name;
            if (isBotRole) {
                roleLabel += ' [BOT]';
            }

            const row = `${prefix}${format.pad(String(role.rank), cols.rank - 1)} ${format.pad(roleLabel, cols.name)} ${format.pad(format.number(role.memberCount || 0), cols.members)} `;
            
            renderer.writeAt(x, y + 2 + i, `${rowColor}${row}${renderer.constructor.ANSI.RESET}${canAssignColor}${canAssignText}${renderer.constructor.ANSI.RESET}`);
        });

        // Scroll indicators
        if (startIndex > 0) {
            renderer.writeAt(x + width - 10, y + 2, `${dimColor}(more)${renderer.constructor.ANSI.RESET}`);
        }
        if (endIndex < sortedRoles.length) {
            renderer.writeAt(x + width - 10, y + 2 + maxVisible - 1, `${dimColor}(more)${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        input.on('escape', () => this.app.showScreen('dashboard'));
        
        input.on('up', () => {
            if (this.state.selectedIndex > 0) {
                this.state.selectedIndex--;
                this.render();
            }
        });

        input.on('down', () => {
            if (this.state.selectedIndex < this.state.roles.length - 1) {
                this.state.selectedIndex++;
                this.render();
            }
        });

        // Page Up/Down for faster navigation
        input.on('pageup', () => {
            this.state.selectedIndex = Math.max(0, this.state.selectedIndex - 5);
            this.render();
        });

        input.on('pagedown', () => {
            this.state.selectedIndex = Math.min(this.state.roles.length - 1, this.state.selectedIndex + 5);
            this.render();
        });

        input.on('r', async () => {
            this.state.loading = true;
            await this.render();
            
            config.clearCache();
            await this.loadRoles();
            
            await this.render();
        });
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
    }
}

module.exports = RolesScreen;
