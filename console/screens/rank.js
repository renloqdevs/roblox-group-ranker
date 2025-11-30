/**
 * Rank Screen - Set user rank interface
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class RankScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            stage: 'input', // 'input', 'lookup', 'select', 'confirm', 'result'
            userInput: '',
            user: null,
            roles: [],
            selectedRoleIndex: 0,
            result: null,
            error: null
        };
    }

    /**
     * Show the rank screen
     */
    async show() {
        this.state = {
            stage: 'input',
            userInput: '',
            user: null,
            roles: [],
            selectedRoleIndex: 0,
            result: null,
            error: null
        };

        // Load roles
        const cachedRoles = config.getCachedRoles();
        if (cachedRoles) {
            this.state.roles = cachedRoles.filter(r => r.canAssign);
        } else {
            try {
                const rolesResult = await api.getRoles();
                if (rolesResult.success) {
                    config.cacheRoles(rolesResult.roles);
                    this.state.roles = rolesResult.roles.filter(r => r.canAssign);
                }
            } catch (e) {
                // Will show error when trying to rank
            }
        }

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
        const { contentY } = components.drawFrame('RANK USER', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        switch (this.state.stage) {
            case 'input':
                await this.renderInputStage(contentX, currentY, width - 6);
                break;
            case 'lookup':
                await this.renderLookupStage(contentX, currentY, width - 6);
                break;
            case 'select':
                await this.renderSelectStage(contentX, currentY, width - 6);
                break;
            case 'confirm':
                await this.renderConfirmStage(contentX, currentY, width - 6);
                break;
            case 'result':
                await this.renderResultStage(contentX, currentY, width - 6);
                break;
        }
    }

    /**
     * Render input stage
     */
    async renderInputStage(x, y, width) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');

        renderer.writeAt(x, y, `${textColor}Enter username or user ID:${renderer.constructor.ANSI.RESET}`);
        
        // Input field
        const inputY = y + 2;
        renderer.writeAt(x, inputY, `${labelColor}>${renderer.constructor.ANSI.RESET} ${this.state.userInput}_`);

        // Clear rest of line
        renderer.writeAt(x + 3 + this.state.userInput.length, inputY, ' '.repeat(40));

        // Instructions
        renderer.writeAt(x, y + 5, `${dimColor}Press ENTER to search, ESC to go back${renderer.constructor.ANSI.RESET}`);

        if (this.state.error) {
            renderer.writeAt(x, y + 7, `${renderer.color('error')}Error: ${this.state.error}${renderer.constructor.ANSI.RESET}`);
        }

        renderer.showCursor();
    }

    /**
     * Render lookup stage (loading)
     */
    async renderLookupStage(x, y, width) {
        const dimColor = renderer.color('textDim');
        
        renderer.writeAt(x, y, `${dimColor}Looking up user...${renderer.constructor.ANSI.RESET}`);
        
        // Show spinner
        const spinnerId = animations.startSpinner(x, y + 2, 'bounce', 'Searching');

        try {
            const result = await api.lookupUser(this.state.userInput);
            animations.stopSpinner(spinnerId);

            if (result.success) {
                this.state.user = result;
                
                if (!result.inGroup) {
                    this.state.error = 'User is not in the group';
                    this.state.stage = 'input';
                } else {
                    // Find current role index
                    const currentRoleIndex = this.state.roles.findIndex(r => r.rank === result.rank);
                    if (currentRoleIndex !== -1) {
                        this.state.selectedRoleIndex = currentRoleIndex;
                    }
                    this.state.stage = 'select';
                }
            } else {
                this.state.error = result.message || 'User not found';
                this.state.stage = 'input';
            }
        } catch (e) {
            animations.stopSpinner(spinnerId);
            this.state.error = e.message;
            this.state.stage = 'input';
        }

        await this.render();
        this.setupInput();
    }

    /**
     * Render role selection stage
     */
    async renderSelectStage(x, y, width) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');

        // User card
        if (this.state.user) {
            components.drawUserCard(x, y, this.state.user);
        }

        // Role selection
        const selectY = y + 10;
        renderer.writeAt(x, selectY, `${textColor}Select new rank:${renderer.constructor.ANSI.RESET}`);

        // Build role items
        const roleItems = this.state.roles.map(role => ({
            label: `${role.name} (${role.rank})`,
            current: this.state.user && role.rank === this.state.user.rank
        }));

        // Draw selection list
        components.drawSelectionList(x + 2, selectY + 2, roleItems, this.state.selectedRoleIndex, 8);

        // Instructions
        renderer.writeAt(x, selectY + 12, `${dimColor}Use UP/DOWN to select, ENTER to confirm, ESC to cancel${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Render confirmation stage
     */
    async renderConfirmStage(x, y, width) {
        const textColor = renderer.color('text');
        const warningColor = renderer.color('warning');
        const labelColor = renderer.color('label');

        const selectedRole = this.state.roles[this.state.selectedRoleIndex];

        renderer.writeAt(x, y, `${warningColor}Confirm Rank Change${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, 40);

        renderer.writeAt(x, y + 3, `${labelColor}User:${renderer.constructor.ANSI.RESET}     ${textColor}${this.state.user.username}${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 4, `${labelColor}From:${renderer.constructor.ANSI.RESET}     ${textColor}${this.state.user.rankName} (${this.state.user.rank})${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 5, `${labelColor}To:${renderer.constructor.ANSI.RESET}       ${textColor}${selectedRole.name} (${selectedRole.rank})${renderer.constructor.ANSI.RESET}`);

        renderer.writeAt(x, y + 8, `${textColor}Are you sure? ${renderer.color('menuKey')}[Y]${renderer.constructor.ANSI.RESET}${textColor}es / ${renderer.color('menuKey')}[N]${renderer.constructor.ANSI.RESET}${textColor}o${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Render result stage
     */
    async renderResultStage(x, y, width) {
        const result = this.state.result;

        if (result && result.success) {
            const successColor = renderer.color('success');
            const textColor = renderer.color('text');
            const labelColor = renderer.color('label');

            renderer.writeAt(x, y, `${successColor}Rank Changed Successfully${renderer.constructor.ANSI.RESET}`);
            components.drawSeparator(x, y + 1, 40);

            renderer.writeAt(x, y + 3, `${labelColor}User:${renderer.constructor.ANSI.RESET}     ${textColor}${result.username || this.state.user.username}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 4, `${labelColor}Old Rank:${renderer.constructor.ANSI.RESET} ${textColor}${result.oldRankName} (${result.oldRank})${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 5, `${labelColor}New Rank:${renderer.constructor.ANSI.RESET} ${textColor}${result.newRankName} (${result.newRank})${renderer.constructor.ANSI.RESET}`);

            await animations.successCheck(x, y + 7);
        } else {
            const errorColor = renderer.color('error');
            renderer.writeAt(x, y, `${errorColor}Rank Change Failed${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 2, `${renderer.color('text')}${this.state.error || 'Unknown error'}${renderer.constructor.ANSI.RESET}`);
            
            await animations.errorX(x, y + 4);
        }

        renderer.writeAt(x, y + 10, `${renderer.color('textDim')}Press any key to continue...${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Setup input handlers based on current stage
     */
    setupInput() {
        input.clearListeners();

        switch (this.state.stage) {
            case 'input':
                this.setupInputStageHandlers();
                break;
            case 'select':
                this.setupSelectStageHandlers();
                break;
            case 'confirm':
                this.setupConfirmStageHandlers();
                break;
            case 'result':
                this.setupResultStageHandlers();
                break;
        }
    }

    /**
     * Input stage handlers
     */
    setupInputStageHandlers() {
        input.on('escape', () => this.app.showScreen('dashboard'));

        input.startTextInput({
            initialValue: this.state.userInput,
            maxLength: 50,
            onInput: (value) => {
                this.state.userInput = value;
                this.state.error = null;
                this.render();
            },
            onComplete: (value) => {
                if (value && value.trim()) {
                    this.state.userInput = value.trim();
                    this.state.stage = 'lookup';
                    this.render();
                }
            },
            onCancel: () => {
                this.app.showScreen('dashboard');
            }
        });
    }

    /**
     * Select stage handlers
     */
    setupSelectStageHandlers() {
        input.on('escape', () => {
            this.state.stage = 'input';
            this.state.error = null;
            this.render();
            this.setupInput();
        });

        input.on('up', () => {
            if (this.state.selectedRoleIndex > 0) {
                this.state.selectedRoleIndex--;
                this.render();
            }
        });

        input.on('down', () => {
            if (this.state.selectedRoleIndex < this.state.roles.length - 1) {
                this.state.selectedRoleIndex++;
                this.render();
            }
        });

        input.on('return', () => {
            const selectedRole = this.state.roles[this.state.selectedRoleIndex];
            
            // Check if same rank
            if (selectedRole.rank === this.state.user.rank) {
                this.state.error = 'User is already at this rank';
                this.render();
                return;
            }

            // Check if confirmation needed
            if (config.getPreference('confirmBeforeRank')) {
                this.state.stage = 'confirm';
            } else {
                this.executeRankChange();
            }
            this.render();
            this.setupInput();
        });
    }

    /**
     * Confirm stage handlers
     */
    setupConfirmStageHandlers() {
        input.on('y', () => this.executeRankChange());
        input.on('n', () => {
            this.state.stage = 'select';
            this.render();
            this.setupInput();
        });
        input.on('escape', () => {
            this.state.stage = 'select';
            this.render();
            this.setupInput();
        });
    }

    /**
     * Result stage handlers
     */
    setupResultStageHandlers() {
        input.addGlobalListener(() => {
            this.app.showScreen('dashboard');
        });
    }

    /**
     * Execute the rank change
     */
    async executeRankChange() {
        const selectedRole = this.state.roles[this.state.selectedRoleIndex];
        
        this.state.stage = 'result';
        await this.render();

        try {
            const result = await api.setRank(this.state.user.userId, selectedRole.rank);
            this.state.result = result;

            if (result.success) {
                // Log the activity
                config.addLogEntry({
                    action: 'RANK',
                    userId: this.state.user.userId,
                    username: this.state.user.username,
                    message: `${this.state.user.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('rank');
            } else {
                this.state.error = result.message;
            }
        } catch (e) {
            this.state.result = { success: false };
            this.state.error = e.message;

            config.addLogEntry({
                action: 'ERROR',
                message: `Failed to rank ${this.state.user.username}: ${e.message}`
            });
        }

        await this.render();
        this.setupInput();
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
        input.stopTextInput();
    }
}

module.exports = RankScreen;
