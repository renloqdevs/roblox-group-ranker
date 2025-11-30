/**
 * Auth Screen - Password authentication gate
 * 
 * Security: Password is NEVER stored in plaintext.
 * Password hash is stored in ~/.rankbot/config.json (user home, NOT project files)
 * 
 * Flow:
 * - First time: User sets a password
 * - Every startup: User enters password to login
 */

const renderer = require('../ui/renderer');
const input = require('../utils/input');
const config = require('../services/config');

class AuthScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            password: '',
            confirmPassword: '',
            mode: 'login',          // 'login', 'setup', 'confirm'
            error: null,
            cursorVisible: true
        };
        this.cursorInterval = null;
    }

    /**
     * Show the auth screen
     */
    async show() {
        // Determine mode based on whether password is configured
        const mode = config.isPasswordConfigured() ? 'login' : 'setup';
        
        this.state = {
            password: '',
            confirmPassword: '',
            mode: mode,
            error: null,
            cursorVisible: true
        };
        
        // Start cursor blink
        this.startCursorBlink();
        
        await this.render();
        this.setupInput();
    }

    /**
     * Start cursor blinking effect
     */
    startCursorBlink() {
        if (this.cursorInterval) {
            clearInterval(this.cursorInterval);
        }
        this.cursorInterval = setInterval(() => {
            this.state.cursorVisible = !this.state.cursorVisible;
            this.renderPasswordField();
        }, 500);
    }

    /**
     * Stop cursor blinking
     */
    stopCursorBlink() {
        if (this.cursorInterval) {
            clearInterval(this.cursorInterval);
            this.cursorInterval = null;
        }
    }

    /**
     * Render the auth screen
     */
    async render() {
        const { width, height } = renderer.getDimensions();
        
        renderer.clear();
        renderer.hideCursor();
        
        // Draw border
        renderer.drawBox(1, 1, width, height, '', true);

        const centerY = Math.floor(height / 2) - 6;
        const titleColor = renderer.color('title');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');
        const warningColor = renderer.color('warning');

        // Lock icon (ASCII art)
        const lockIcon = [
            '  ████  ',
            ' █    █ ',
            ' █    █ ',
            '████████',
            '█ ▓▓▓▓ █',
            '█ ▓▓▓▓ █',
            '████████'
        ];
        
        const iconX = Math.floor((width - 8) / 2);
        for (let i = 0; i < lockIcon.length; i++) {
            renderer.writeAt(iconX, centerY + i, dimColor + lockIcon[i] + renderer.constructor.ANSI.RESET);
        }

        // Title
        const titleY = centerY + lockIcon.length + 1;
        renderer.writeCentered(titleY, titleColor + 'RANKBOT CONSOLE' + renderer.constructor.ANSI.RESET, width);
        
        // Subtitle based on mode
        let subtitle = '';
        if (this.state.mode === 'setup') {
            subtitle = 'Set up a password to protect your console';
        } else if (this.state.mode === 'confirm') {
            subtitle = 'Confirm your password';
        } else {
            subtitle = 'Password Protected';
        }
        renderer.writeCentered(titleY + 1, dimColor + subtitle + renderer.constructor.ANSI.RESET, width);

        // Check for lockout
        if (config.isLockedOut()) {
            const remaining = config.getLockoutRemaining();
            const errorColor = renderer.color('error');
            renderer.writeCentered(titleY + 3, errorColor + `Too many failed attempts. Locked for ${remaining} seconds.` + renderer.constructor.ANSI.RESET, width);
            renderer.writeCentered(titleY + 5, dimColor + 'Press ESC to exit' + renderer.constructor.ANSI.RESET, width);
            return;
        }

        // Password prompt
        const promptY = titleY + 4;
        let promptText = '';
        if (this.state.mode === 'setup') {
            promptText = 'Create a password:';
        } else if (this.state.mode === 'confirm') {
            promptText = 'Confirm password:';
        } else {
            promptText = 'Enter password:';
        }
        renderer.writeCentered(promptY, textColor + promptText + renderer.constructor.ANSI.RESET, width);
        
        // Password field will be rendered separately for blinking cursor
        this.renderPasswordField();

        // Error message
        if (this.state.error) {
            const errorColor = renderer.color('error');
            renderer.writeCentered(promptY + 3, errorColor + this.state.error + renderer.constructor.ANSI.RESET, width);
        }

        // Hints
        const hintY = height - 4;
        if (this.state.mode === 'setup') {
            renderer.writeCentered(hintY, dimColor + 'Minimum 4 characters' + renderer.constructor.ANSI.RESET, width);
        }
        renderer.writeCentered(hintY + 1, dimColor + 'Press ENTER to submit' + renderer.constructor.ANSI.RESET, width);
        renderer.writeCentered(hintY + 2, dimColor + 'Press ESC to exit' + renderer.constructor.ANSI.RESET, width);
    }

    /**
     * Render just the password field (for cursor blinking)
     */
    renderPasswordField() {
        const { width, height } = renderer.getDimensions();
        const centerY = Math.floor(height / 2) - 6;
        const lockIconHeight = 7;
        const titleY = centerY + lockIconHeight + 1;
        const promptY = titleY + 4;
        
        const password = this.state.mode === 'confirm' ? this.state.confirmPassword : this.state.password;
        const maskedPassword = '*'.repeat(password.length);
        const cursor = this.state.cursorVisible ? '_' : ' ';
        const textColor = renderer.color('text');
        
        // Clear the line first
        const fieldWidth = 30;
        const fieldX = Math.floor((width - fieldWidth) / 2);
        renderer.writeAt(fieldX, promptY + 1, ' '.repeat(fieldWidth));
        
        // Draw the password field
        const displayText = `[ ${maskedPassword}${cursor} ]`;
        renderer.writeCentered(promptY + 1, textColor + displayText + renderer.constructor.ANSI.RESET, width);
    }

    /**
     * Set up input handlers
     */
    setupInput() {
        input.clearListeners();
        
        // Check for lockout
        if (config.isLockedOut()) {
            input.on('escape', () => {
                this.cleanup();
                process.exit(0);
            });
            return;
        }
        
        const currentPassword = this.state.mode === 'confirm' ? 'confirmPassword' : 'password';
        
        input.startTextInput({
            initialValue: '',
            maxLength: 50,
            onInput: (value) => {
                this.state[currentPassword] = value;
                this.state.error = null;
                this.renderPasswordField();
            },
            onComplete: (value) => {
                this.handleSubmit(value);
            },
            onCancel: () => {
                this.cleanup();
                process.exit(0);
            }
        });
    }

    /**
     * Handle password submission
     */
    async handleSubmit(value) {
        input.stopTextInput();
        this.stopCursorBlink();
        
        if (this.state.mode === 'setup') {
            // Setting up new password
            if (value.length < 4) {
                this.state.error = 'Password must be at least 4 characters';
                this.state.password = '';
                this.startCursorBlink();
                await this.render();
                this.setupInput();
                return;
            }
            
            // Move to confirm mode
            this.state.password = value;
            this.state.mode = 'confirm';
            this.state.confirmPassword = '';
            this.state.showSkipOption = false;
            this.startCursorBlink();
            await this.render();
            this.setupInput();
            
        } else if (this.state.mode === 'confirm') {
            // Confirming password
            if (value !== this.state.password) {
                this.state.error = 'Passwords do not match. Please try again.';
                this.state.mode = 'setup';
                this.state.password = '';
                this.state.confirmPassword = '';
                this.state.showSkipOption = true;
                this.startCursorBlink();
                await this.render();
                this.setupInput();
                return;
            }
            
            // Save the password
            config.setPassword(value);
            
            // Show success message briefly
            const { width, height } = renderer.getDimensions();
            const successColor = renderer.color('success');
            renderer.writeCentered(Math.floor(height / 2) + 4, successColor + 'Password set successfully!' + renderer.constructor.ANSI.RESET, width);
            
            await this.sleep(1000);
            
            // Proceed to app
            this.proceedToApp();
            
        } else {
            // Login mode - verify password
            if (config.verifyPassword(value)) {
                // Success
                this.proceedToApp();
            } else {
                // Failed
                const remaining = 5 - (config.getSecurityStatus().failedAttempts);
                
                if (config.isLockedOut()) {
                    this.state.error = 'Too many failed attempts. Account locked.';
                    await this.render();
                    await this.sleep(2000);
                    this.cleanup();
                    process.exit(1);
                } else {
                    this.state.error = `Incorrect password (${remaining} attempts remaining)`;
                    this.state.password = '';
                    this.startCursorBlink();
                    await this.render();
                    this.setupInput();
                }
            }
        }
    }

    /**
     * Proceed to the main application
     */
    proceedToApp() {
        this.cleanup();
        
        if (config.isFirstRun() || !config.isConfigured()) {
            this.app.showScreen('setup');
        } else {
            this.app.showScreen('dashboard');
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopCursorBlink();
        input.clearListeners();
        input.stopTextInput();
    }

    /**
     * Hide the screen
     */
    hide() {
        this.cleanup();
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AuthScreen;
