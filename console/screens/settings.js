/**
 * Settings Screen - Configuration and preferences
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');
const themes = require('../ui/themes');

class SettingsScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            section: 'connection', // 'connection', 'preferences', 'theme'
            editing: null,
            editValue: '',
            showApiKey: false,
            testingConnection: false,
            testResult: null
        };
    }

    /**
     * Show the settings screen
     */
    async show() {
        this.state = {
            section: 'connection',
            editing: null,
            editValue: '',
            showApiKey: false,
            testingConnection: false,
            testResult: null
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
        const { contentY } = components.drawFrame('SETTINGS', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        // Connection section
        this.renderConnectionSection(contentX, currentY, width - 6);
        currentY += 9;

        // Preferences section
        this.renderPreferencesSection(contentX, currentY, width - 6);
        currentY += 8;

        // Theme section
        this.renderThemeSection(contentX, currentY, width - 6);

        // Key hints
        if (this.state.editing) {
            components.drawKeyHints([
                { key: 'ENTER', action: 'Save' },
                { key: 'ESC', action: 'Cancel' }
            ]);
        } else {
            components.drawKeyHints([
                { key: 'U', action: 'Edit URL' },
                { key: 'K', action: 'Edit Key' },
                { key: 'T', action: 'Test' },
                { key: '1-4', action: 'Toggle' },
                { key: 'ESC', action: 'Back' }
            ]);
        }
    }

    /**
     * Render connection section
     */
    renderConnectionSection(x, y, width) {
        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');
        const keyColor = renderer.color('menuKey');

        const credentials = config.getApiCredentials();
        const connected = api.isConnected();

        renderer.writeAt(x, y, `${renderer.color('subtitle')}Connection${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        // API URL
        const urlDisplay = credentials.url || 'Not configured';
        const urlEditing = this.state.editing === 'url';
        renderer.writeAt(x, y + 2, 
            `${keyColor}[U]${renderer.constructor.ANSI.RESET} ${labelColor}API URL:${renderer.constructor.ANSI.RESET}   ${textColor}${urlEditing ? this.state.editValue + '_' : format.truncate(urlDisplay, 50)}${renderer.constructor.ANSI.RESET}`
        );

        // API Key
        const keyDisplay = this.state.showApiKey ? credentials.key : format.mask(credentials.key, 4);
        const keyEditing = this.state.editing === 'key';
        renderer.writeAt(x, y + 3, 
            `${keyColor}[K]${renderer.constructor.ANSI.RESET} ${labelColor}API Key:${renderer.constructor.ANSI.RESET}   ${textColor}${keyEditing ? this.state.editValue + '_' : (keyDisplay || 'Not configured')}${renderer.constructor.ANSI.RESET}`
        );

        // Show/hide key toggle
        renderer.writeAt(x + 45, y + 3, `${dimColor}[S]how${renderer.constructor.ANSI.RESET}`);

        // Connection status
        const statusText = connected ? 'Connected' : 'Disconnected';
        const statusColor = connected ? successColor : errorColor;
        renderer.writeAt(x, y + 4, `${labelColor}Status:${renderer.constructor.ANSI.RESET}      ${statusColor}${statusText}${renderer.constructor.ANSI.RESET}`);

        // Test button
        renderer.writeAt(x, y + 6, `${keyColor}[T]${renderer.constructor.ANSI.RESET} ${textColor}Test Connection${renderer.constructor.ANSI.RESET}`);

        // Test result
        if (this.state.testResult) {
            const resultColor = this.state.testResult.success ? successColor : errorColor;
            const resultText = this.state.testResult.success 
                ? `Connected as ${this.state.testResult.bot?.username}` 
                : this.state.testResult.error;
            renderer.writeAt(x + 20, y + 6, `${resultColor}${resultText}${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Render preferences section
     */
    renderPreferencesSection(x, y, width) {
        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');
        const keyColor = renderer.color('menuKey');

        const prefs = config.getPreferences();

        renderer.writeAt(x, y, `${renderer.color('subtitle')}Preferences${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        const prefItems = [
            { key: '1', label: 'Confirm before rank changes', value: prefs.confirmBeforeRank },
            { key: '2', label: 'Show animations', value: prefs.showAnimations },
            { key: '3', label: 'Auto-refresh dashboard', value: prefs.autoRefresh },
            { key: '4', label: 'Sound notifications', value: prefs.soundNotifications }
        ];

        prefItems.forEach((item, i) => {
            const checkbox = format.checkmark(item.value);
            renderer.writeAt(x, y + 2 + i, 
                `${keyColor}[${item.key}]${renderer.constructor.ANSI.RESET} ${textColor}${checkbox} ${item.label}${renderer.constructor.ANSI.RESET}`
            );
        });
    }

    /**
     * Render theme section
     */
    renderThemeSection(x, y, width) {
        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');
        const selectedColor = renderer.color('menuSelected');

        const currentTheme = config.getTheme();
        const allThemes = themes.getAllThemes();

        renderer.writeAt(x, y, `${renderer.color('subtitle')}Theme${renderer.constructor.ANSI.RESET}`);
        components.drawSeparator(x, y + 1, width);

        let xOffset = x;
        allThemes.forEach((theme, i) => {
            const isSelected = theme.id === currentTheme;
            const color = isSelected ? selectedColor : textColor;
            const marker = isSelected ? '(*)' : '( )';
            const key = String.fromCharCode(65 + i); // A, B, C, etc.

            renderer.writeAt(xOffset, y + 2, `${renderer.color('menuKey')}[${key}]${renderer.constructor.ANSI.RESET} ${color}${marker} ${theme.name}${renderer.constructor.ANSI.RESET}`);
            xOffset += theme.name.length + 10;
        });
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        if (this.state.editing) {
            this.setupEditingHandlers();
            return;
        }

        input.on('escape', () => this.app.showScreen('dashboard'));

        // Connection
        input.on('u', () => this.startEditing('url'));
        input.on('k', () => this.startEditing('key'));
        input.on('s', () => {
            this.state.showApiKey = !this.state.showApiKey;
            this.render();
        });
        input.on('t', () => this.testConnection());

        // Preferences toggles
        input.on('1', () => this.togglePreference('confirmBeforeRank'));
        input.on('2', () => this.togglePreference('showAnimations'));
        input.on('3', () => this.togglePreference('autoRefresh'));
        input.on('4', () => this.togglePreference('soundNotifications'));

        // Theme selection (A-F)
        const allThemes = themes.getAllThemes();
        allThemes.forEach((theme, i) => {
            const key = String.fromCharCode(97 + i); // a, b, c, etc.
            input.on(key, () => this.setTheme(theme.id));
        });
    }

    /**
     * Setup editing handlers
     */
    setupEditingHandlers() {
        input.startTextInput({
            initialValue: this.state.editValue,
            maxLength: this.state.editing === 'url' ? 100 : 200,
            onInput: (value) => {
                this.state.editValue = value;
                this.render();
            },
            onComplete: (value) => {
                this.saveEdit(value);
            },
            onCancel: () => {
                this.state.editing = null;
                this.state.editValue = '';
                this.render();
                this.setupInput();
            }
        });
    }

    /**
     * Start editing a field
     */
    startEditing(field) {
        const credentials = config.getApiCredentials();
        this.state.editing = field;
        this.state.editValue = field === 'url' ? credentials.url : credentials.key;
        this.state.testResult = null;
        this.render();
        this.setupInput();
    }

    /**
     * Save edit
     */
    saveEdit(value) {
        const credentials = config.getApiCredentials();
        
        if (this.state.editing === 'url') {
            config.setApiCredentials(value, credentials.key);
            api.setCredentials(value, credentials.key);
        } else if (this.state.editing === 'key') {
            config.setApiCredentials(credentials.url, value);
            api.setCredentials(credentials.url, value);
        }

        this.state.editing = null;
        this.state.editValue = '';
        this.state.testResult = null;
        
        this.render();
        this.setupInput();
    }

    /**
     * Test connection
     */
    async testConnection() {
        this.state.testingConnection = true;
        this.state.testResult = null;
        await this.render();

        const result = await api.testConnection();
        this.state.testResult = result;
        this.state.testingConnection = false;

        if (result.success && result.bot) {
            config.setBotInfo({
                username: result.bot.username,
                userId: result.bot.userId
            });
        }

        await this.render();
    }

    /**
     * Toggle preference
     */
    togglePreference(key) {
        const current = config.getPreference(key);
        config.setPreference(key, !current);
        this.render();
    }

    /**
     * Set theme
     */
    setTheme(themeId) {
        config.setTheme(themeId);
        renderer.setTheme(themeId);
        this.render();
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
        input.stopTextInput();
    }
}

module.exports = SettingsScreen;
