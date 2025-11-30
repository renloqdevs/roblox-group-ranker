/**
 * Promote Screen - Promote user interface
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class PromoteScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            stage: 'input', // 'input', 'lookup', 'confirm', 'result'
            userInput: '',
            user: null,
            result: null,
            error: null
        };
    }

    /**
     * Show the promote screen
     */
    async show() {
        this.state = {
            stage: 'input',
            userInput: '',
            user: null,
            result: null,
            error: null
        };

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
        const { contentY } = components.drawFrame('PROMOTE USER', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        switch (this.state.stage) {
            case 'input':
                await this.renderInputStage(contentX, currentY, width - 6);
                break;
            case 'lookup':
                await this.renderLookupStage(contentX, currentY, width - 6);
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

        renderer.writeAt(x, y, `${textColor}Enter username or user ID to promote:${renderer.constructor.ANSI.RESET}`);
        
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
                    this.state.stage = 'confirm';
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
     * Render confirmation stage
     */
    async renderConfirmStage(x, y, width) {
        const textColor = renderer.color('text');
        const warningColor = renderer.color('warning');
        const labelColor = renderer.color('label');
        const successColor = renderer.color('success');

        // User card
        components.drawUserCard(x, y, this.state.user);

        const confirmY = y + 10;
        renderer.writeAt(x, confirmY, `${successColor}Promote this user?${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, confirmY + 2, `${textColor}This will increase their rank by one level.${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, confirmY + 4, `${textColor}Confirm? ${renderer.color('menuKey')}[Y]${renderer.constructor.ANSI.RESET}${textColor}es / ${renderer.color('menuKey')}[N]${renderer.constructor.ANSI.RESET}${textColor}o${renderer.constructor.ANSI.RESET}`);
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

            renderer.writeAt(x, y, `${successColor}User Promoted Successfully${renderer.constructor.ANSI.RESET}`);
            components.drawSeparator(x, y + 1, 40);

            renderer.writeAt(x, y + 3, `${labelColor}User:${renderer.constructor.ANSI.RESET}     ${textColor}${result.username || this.state.user.username}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 4, `${labelColor}Old Rank:${renderer.constructor.ANSI.RESET} ${textColor}${result.oldRankName} (${result.oldRank})${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 5, `${labelColor}New Rank:${renderer.constructor.ANSI.RESET} ${textColor}${result.newRankName} (${result.newRank})${renderer.constructor.ANSI.RESET}`);

            await animations.successCheck(x, y + 7);
        } else {
            const errorColor = renderer.color('error');
            renderer.writeAt(x, y, `${errorColor}Promotion Failed${renderer.constructor.ANSI.RESET}`);
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
     * Confirm stage handlers
     */
    setupConfirmStageHandlers() {
        input.on('y', () => this.executePromotion());
        input.on('n', () => {
            this.state.stage = 'input';
            this.state.error = null;
            this.render();
            this.setupInput();
        });
        input.on('escape', () => {
            this.state.stage = 'input';
            this.state.error = null;
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
     * Execute the promotion
     */
    async executePromotion() {
        this.state.stage = 'result';
        await this.render();

        try {
            const result = await api.promote(this.state.user.userId);
            this.state.result = result;

            if (result.success) {
                config.addLogEntry({
                    action: 'PROMOTE',
                    userId: this.state.user.userId,
                    username: this.state.user.username,
                    message: `${this.state.user.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('promote');
            } else {
                this.state.error = result.message;
            }
        } catch (e) {
            this.state.result = { success: false };
            this.state.error = e.message;

            config.addLogEntry({
                action: 'ERROR',
                message: `Failed to promote ${this.state.user.username}: ${e.message}`
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

module.exports = PromoteScreen;
