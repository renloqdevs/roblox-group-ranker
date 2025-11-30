/**
 * Input Handler - Keyboard input management for the console UI
 */

const readline = require('readline');
const renderer = require('../ui/renderer');

class InputHandler {
    constructor() {
        this.listeners = new Map();
        this.globalListeners = [];
        this.inputBuffer = '';
        this.inputMode = 'navigation'; // 'navigation' or 'text'
        this.textInputCallback = null;
        this.textInputOptions = {};
        this.isInitialized = false;
    }

    /**
     * Initialize the input handler
     */
    initialize() {
        if (this.isInitialized) return;

        // Enable raw mode for keypress detection
        if (process.stdin.isTTY) {
            readline.emitKeypressEvents(process.stdin);
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', (str, key) => {
            this.handleKeypress(str, key);
        });

        // Handle process termination
        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });

        this.isInitialized = true;
    }

    /**
     * Clean up input handler
     */
    cleanup() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        renderer.showCursor();
        renderer.clear();
    }

    /**
     * Handle keypress event
     */
    handleKeypress(str, key) {
        if (!key) return;

        // Handle Ctrl+C to exit
        if (key.ctrl && key.name === 'c') {
            this.cleanup();
            process.exit(0);
        }

        // Text input mode
        if (this.inputMode === 'text') {
            this.handleTextInput(str, key);
            return;
        }

        // Navigation mode
        this.handleNavigationInput(str, key);
    }

    /**
     * Handle text input mode
     */
    handleTextInput(str, key) {
        const { onInput, onComplete, onCancel, maxLength, validator } = this.textInputOptions;

        if (key.name === 'escape') {
            this.inputMode = 'navigation';
            this.inputBuffer = '';
            if (onCancel) onCancel();
            return;
        }

        if (key.name === 'return') {
            const value = this.inputBuffer;
            this.inputMode = 'navigation';
            this.inputBuffer = '';
            if (onComplete) onComplete(value);
            return;
        }

        if (key.name === 'backspace') {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            if (onInput) onInput(this.inputBuffer);
            return;
        }

        // Add character to buffer
        if (str && str.length === 1) {
            if (maxLength && this.inputBuffer.length >= maxLength) return;
            if (validator && !validator(str)) return;
            
            this.inputBuffer += str;
            if (onInput) onInput(this.inputBuffer);
        }
    }

    /**
     * Handle navigation mode input
     */
    handleNavigationInput(str, key) {
        // Create key identifier
        let keyId = key.name || str;
        if (key.ctrl) keyId = 'ctrl+' + keyId;
        if (key.shift) keyId = 'shift+' + keyId;
        if (key.meta) keyId = 'meta+' + keyId;

        // Check specific listeners
        if (this.listeners.has(keyId)) {
            const callback = this.listeners.get(keyId);
            callback(key);
            return;
        }

        // Check character listeners (for menu shortcuts like '1', '2', etc.)
        if (str && this.listeners.has(str)) {
            const callback = this.listeners.get(str);
            callback(key);
            return;
        }

        // Call global listeners
        for (const listener of this.globalListeners) {
            listener(str, key);
        }
    }

    /**
     * Register a key listener
     */
    on(key, callback) {
        this.listeners.set(key.toLowerCase(), callback);
    }

    /**
     * Register multiple key listeners
     */
    onKeys(keyMap) {
        for (const [key, callback] of Object.entries(keyMap)) {
            this.on(key, callback);
        }
    }

    /**
     * Remove a key listener
     */
    off(key) {
        this.listeners.delete(key.toLowerCase());
    }

    /**
     * Clear all listeners
     */
    clearListeners() {
        this.listeners.clear();
    }

    /**
     * Add global listener (receives all keypresses)
     */
    addGlobalListener(callback) {
        this.globalListeners.push(callback);
    }

    /**
     * Remove global listeners
     */
    clearGlobalListeners() {
        this.globalListeners = [];
    }

    /**
     * Start text input mode
     */
    startTextInput(options = {}) {
        this.inputMode = 'text';
        this.inputBuffer = options.initialValue || '';
        this.textInputOptions = {
            onInput: options.onInput || (() => {}),
            onComplete: options.onComplete || (() => {}),
            onCancel: options.onCancel || (() => {}),
            maxLength: options.maxLength || 100,
            validator: options.validator || null
        };

        if (options.initialValue && options.onInput) {
            options.onInput(options.initialValue);
        }
    }

    /**
     * Stop text input mode
     */
    stopTextInput() {
        this.inputMode = 'navigation';
        this.inputBuffer = '';
        this.textInputOptions = {};
    }

    /**
     * Get current input buffer
     */
    getInputBuffer() {
        return this.inputBuffer;
    }

    /**
     * Set input buffer
     */
    setInputBuffer(value) {
        this.inputBuffer = value;
    }

    /**
     * Check if in text input mode
     */
    isTextInputMode() {
        return this.inputMode === 'text';
    }

    /**
     * Prompt for text input (async)
     */
    async prompt(options = {}) {
        return new Promise((resolve, reject) => {
            this.startTextInput({
                ...options,
                onComplete: (value) => resolve(value),
                onCancel: () => resolve(null)
            });
        });
    }

    /**
     * Wait for specific key
     */
    async waitForKey(keys = []) {
        return new Promise((resolve) => {
            const handler = (str, key) => {
                if (keys.length === 0 || keys.includes(key.name) || keys.includes(str)) {
                    this.clearGlobalListeners();
                    resolve({ str, key });
                }
            };
            this.addGlobalListener(handler);
        });
    }

    /**
     * Wait for any key
     */
    async waitForAnyKey() {
        return this.waitForKey([]);
    }

    /**
     * Confirm dialog (Y/N)
     */
    async confirm(defaultValue = false) {
        return new Promise((resolve) => {
            const handler = (str, key) => {
                const char = (str || '').toLowerCase();
                if (char === 'y') {
                    this.clearGlobalListeners();
                    resolve(true);
                } else if (char === 'n' || key.name === 'escape') {
                    this.clearGlobalListeners();
                    resolve(false);
                } else if (key.name === 'return') {
                    this.clearGlobalListeners();
                    resolve(defaultValue);
                }
            };
            this.addGlobalListener(handler);
        });
    }

    /**
     * Menu selection helper
     */
    createMenuHandler(options = {}) {
        const {
            items = [],
            onSelect = () => {},
            onCancel = () => {},
            allowEscape = true,
            numberKeys = true
        } = options;

        let selectedIndex = 0;

        const updateSelection = (newIndex) => {
            if (newIndex >= 0 && newIndex < items.length) {
                selectedIndex = newIndex;
                if (options.onSelectionChange) {
                    options.onSelectionChange(selectedIndex, items[selectedIndex]);
                }
            }
        };

        // Register handlers
        this.on('up', () => updateSelection(selectedIndex - 1));
        this.on('down', () => updateSelection(selectedIndex + 1));
        this.on('return', () => onSelect(selectedIndex, items[selectedIndex]));
        
        if (allowEscape) {
            this.on('escape', onCancel);
        }

        // Number key shortcuts
        if (numberKeys) {
            for (let i = 0; i < Math.min(9, items.length); i++) {
                this.on(String(i + 1), () => {
                    selectedIndex = i;
                    onSelect(i, items[i]);
                });
            }
        }

        return {
            getSelectedIndex: () => selectedIndex,
            setSelectedIndex: (index) => updateSelection(index),
            cleanup: () => {
                this.off('up');
                this.off('down');
                this.off('return');
                this.off('escape');
                for (let i = 1; i <= 9; i++) {
                    this.off(String(i));
                }
            }
        };
    }

    /**
     * List navigation helper
     */
    createListNavigator(options = {}) {
        const {
            itemCount = 0,
            pageSize = 10,
            onNavigate = () => {},
            onSelect = () => {},
            onPageChange = () => {}
        } = options;

        let currentIndex = 0;
        let currentPage = 0;

        const totalPages = Math.ceil(itemCount / pageSize);

        const navigate = (delta) => {
            const newIndex = currentIndex + delta;
            if (newIndex >= 0 && newIndex < itemCount) {
                currentIndex = newIndex;
                const newPage = Math.floor(currentIndex / pageSize);
                if (newPage !== currentPage) {
                    currentPage = newPage;
                    onPageChange(currentPage);
                }
                onNavigate(currentIndex);
            }
        };

        const goToPage = (page) => {
            if (page >= 0 && page < totalPages) {
                currentPage = page;
                currentIndex = page * pageSize;
                onPageChange(currentPage);
                onNavigate(currentIndex);
            }
        };

        this.on('up', () => navigate(-1));
        this.on('down', () => navigate(1));
        this.on('pageup', () => goToPage(currentPage - 1));
        this.on('pagedown', () => goToPage(currentPage + 1));
        this.on('home', () => { currentIndex = 0; currentPage = 0; onNavigate(0); onPageChange(0); });
        this.on('end', () => { currentIndex = itemCount - 1; currentPage = totalPages - 1; onNavigate(currentIndex); onPageChange(currentPage); });
        this.on('return', () => onSelect(currentIndex));
        this.on('n', () => goToPage(currentPage + 1));
        this.on('p', () => goToPage(currentPage - 1));

        return {
            getCurrentIndex: () => currentIndex,
            getCurrentPage: () => currentPage,
            getTotalPages: () => totalPages,
            setItemCount: (count) => {
                options.itemCount = count;
            },
            cleanup: () => {
                this.off('up');
                this.off('down');
                this.off('pageup');
                this.off('pagedown');
                this.off('home');
                this.off('end');
                this.off('return');
                this.off('n');
                this.off('p');
            }
        };
    }
}

module.exports = new InputHandler();
