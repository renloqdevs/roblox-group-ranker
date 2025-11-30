/**
 * Setup Wizard - First-run configuration
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const api = require('../services/api');
const config = require('../services/config');

class SetupScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            step: 1,
            totalSteps: 3,
            apiUrl: '',
            apiKey: '',
            testResult: null,
            error: null
        };
    }

    /**
     * Show the setup wizard
     */
    async show() {
        this.state = {
            step: 1,
            totalSteps: 3,
            apiUrl: '',
            apiKey: '',
            testResult: null,
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
        renderer.drawBox(1, 1, width, height, '', true);

        const contentX = 3;
        const contentY = 4;

        // Title
        const titleColor = renderer.color('title');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');

        renderer.writeAt(contentX, contentY, `${titleColor}FIRST-TIME SETUP${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(contentX, contentY + 1, width - 6);

        renderer.writeAt(contentX, contentY + 3, `${textColor}Welcome to RankBot Console!${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(contentX, contentY + 5, `${dimColor}Before you can use this application, we need to configure your${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(contentX, contentY + 6, `${dimColor}connection to your ranking bot API.${renderer.constructor.ANSI.RESET}`);

        // Skip option
        const skipColor = renderer.color('menuKey');
        renderer.writeAt(width - 35, contentY + 3, `${dimColor}Press ${skipColor}[S]${dimColor} to skip and explore${renderer.constructor.ANSI.RESET}`);

        // Step indicator
        const stepY = contentY + 9;
        renderer.writeAt(contentX, stepY, `${renderer.color('subtitle')}Step ${this.state.step} of ${this.state.totalSteps}${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(contentX, stepY + 1, 50);

        // Step content
        switch (this.state.step) {
            case 1:
                this.renderStep1(contentX, stepY + 3);
                break;
            case 2:
                this.renderStep2(contentX, stepY + 3);
                break;
            case 3:
                this.renderStep3(contentX, stepY + 3);
                break;
        }

        // Error display
        if (this.state.error) {
            renderer.writeAt(contentX, height - 5, `${renderer.color('error')}Error: ${this.state.error}${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Render step 1 - API URL
     */
    renderStep1(x, y) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');

        renderer.writeAt(x, y, `${labelColor}API URL${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 2, `${textColor}Enter your Railway deployment URL:${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 4, `${labelColor}>${renderer.constructor.ANSI.RESET} ${this.state.apiUrl}_`);

        renderer.writeAt(x, y + 7, `${dimColor}Example: https://your-app-name.up.railway.app${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 9, `${dimColor}Press ENTER to continue, ESC to exit${renderer.constructor.ANSI.RESET}`);

        renderer.showCursor();
    }

    /**
     * Render step 2 - API Key
     */
    renderStep2(x, y) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');

        // Mask the API key for security
        const maskedKey = '*'.repeat(this.state.apiKey.length);

        renderer.writeAt(x, y, `${labelColor}API Key${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 2, `${textColor}Enter your API key (from your .env file):${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 4, `${labelColor}>${renderer.constructor.ANSI.RESET} ${maskedKey}_`);

        renderer.writeAt(x, y + 7, `${dimColor}This is the API_KEY value you configured in Railway${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 9, `${dimColor}Press ENTER to continue, ESC to go back${renderer.constructor.ANSI.RESET}`);

        renderer.showCursor();
    }

    /**
     * Render step 3 - Test Connection
     */
    renderStep3(x, y) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');

        renderer.writeAt(x, y, `${labelColor}Test Connection${renderer.constructor.ANSI.RESET}`);

        if (!this.state.testResult) {
            renderer.writeAt(x, y + 2, `${textColor}Testing connection to your API...${renderer.constructor.ANSI.RESET}`);
        } else if (this.state.testResult.success) {
            renderer.writeAt(x, y + 2, `${successColor}Connection successful!${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 4, `${labelColor}Bot:${renderer.constructor.ANSI.RESET}   ${textColor}${this.state.testResult.bot?.username || 'Unknown'}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 5, `${labelColor}ID:${renderer.constructor.ANSI.RESET}    ${textColor}${this.state.testResult.bot?.userId || 'N/A'}${renderer.constructor.ANSI.RESET}`);

            renderer.writeAt(x, y + 8, `${textColor}Press ENTER to complete setup${renderer.constructor.ANSI.RESET}`);
        } else {
            renderer.writeAt(x, y + 2, `${errorColor}Connection failed!${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, y + 4, `${textColor}${this.state.testResult.error}${renderer.constructor.ANSI.RESET}`);

            renderer.writeAt(x, y + 7, `${dimColor}Press R to retry, B to go back and fix settings${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        switch (this.state.step) {
            case 1:
                this.setupStep1Input();
                break;
            case 2:
                this.setupStep2Input();
                break;
            case 3:
                this.setupStep3Input();
                break;
        }
    }

    /**
     * Step 1 input handlers
     */
    setupStep1Input() {
        input.startTextInput({
            initialValue: this.state.apiUrl,
            maxLength: 100,
            onInput: (value) => {
                this.state.apiUrl = value;
                this.state.error = null;
                this.render();
            },
            onComplete: (value) => {
                if (this.validateUrl(value)) {
                    this.state.apiUrl = value.trim().replace(/\/$/, '');
                    this.state.step = 2;
                    this.render();
                    this.setupInput();
                } else {
                    this.state.error = 'Please enter a valid URL';
                    this.render();
                }
            },
            onCancel: () => {
                input.cleanup();
                process.exit(0);
            },
            // Special keys that work even when input is empty
            specialKeys: {
                's': () => this.skipSetup(),
                'S': () => this.skipSetup(),
                'tab': () => this.skipSetup()  // Tab also works to skip
            }
        });
    }

    /**
     * Skip setup and enter demo mode
     */
    async skipSetup() {
        const { width, height } = renderer.getDimensions();
        
        // Show confirmation dialog
        components.drawConfirmDialog(
            'Skip setup and explore in Demo Mode?',
            'Ranking features will be disabled until configured.'
        );
        
        const confirmed = await input.confirm(false);
        
        if (confirmed) {
            // Enable demo mode
            config.enableDemoMode();
            
            // Go to dashboard
            this.app.showScreen('dashboard');
        } else {
            await this.render();
            this.setupInput();
        }
    }

    /**
     * Step 2 input handlers
     */
    setupStep2Input() {
        // Note: escape is handled by onCancel in text input mode
        input.startTextInput({
            initialValue: this.state.apiKey,
            maxLength: 200,
            onInput: (value) => {
                this.state.apiKey = value;
                this.state.error = null;
                this.render();
            },
            onComplete: async (value) => {
                if (value && value.trim().length >= 8) {
                    this.state.apiKey = value.trim();
                    this.state.step = 3;
                    await this.render();
                    await this.testConnection();
                    this.setupInput();
                } else {
                    this.state.error = 'API key must be at least 8 characters';
                    this.render();
                }
            },
            onCancel: () => {
                this.state.step = 1;
                this.state.error = null;
                this.render();
                this.setupInput();
            }
        });
    }

    /**
     * Step 3 input handlers
     */
    setupStep3Input() {
        if (this.state.testResult?.success) {
            input.on('return', () => this.completeSetup());
        } else {
            input.on('r', async () => {
                this.state.testResult = null;
                await this.render();
                await this.testConnection();
                this.setupInput();
            });

            input.on('b', () => {
                this.state.step = 1;
                this.state.testResult = null;
                this.render();
                this.setupInput();
            });
        }

        input.on('escape', () => {
            this.state.step = 2;
            this.state.testResult = null;
            this.render();
            this.setupInput();
        });
    }

    /**
     * Validate URL
     */
    validateUrl(url) {
        if (!url || !url.trim()) return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test connection
     */
    async testConnection() {
        api.setCredentials(this.state.apiUrl, this.state.apiKey);
        
        const result = await api.testConnection();
        this.state.testResult = result;
        
        await this.render();
    }

    /**
     * Complete setup
     */
    completeSetup() {
        // Save configuration
        config.setApiCredentials(this.state.apiUrl, this.state.apiKey);
        
        if (this.state.testResult?.bot) {
            config.setBotInfo({
                username: this.state.testResult.bot.username,
                userId: this.state.testResult.bot.userId
            });
        }

        config.completeSetup();

        // Initialize API with saved credentials
        api.initialize();

        // Go to dashboard
        this.app.showScreen('dashboard');
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
        input.stopTextInput();
    }
}

module.exports = SetupScreen;
