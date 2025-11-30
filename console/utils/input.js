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
        
        // Command history support
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.tempBuffer = ''; // Store current input when navigating history
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
        // Ensure key object exists
        if (!key) {
            key = {};
        }

        // Normalize escape key at the top level
        // On some systems/terminals, ESC comes as str='\x1b' with key.name undefined
        if (str === '\x1b' || str === '\u001b' || str === '\x1B') {
            key.name = 'escape';
        }

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
        const { onInput, onComplete, onCancel, maxLength, validator, enableHistory, specialKeys } = this.textInputOptions;

        // Check for special keys that should work even in text input mode
        // These are keys that trigger actions instead of typing
        if (specialKeys && key.name) {
            const specialHandler = specialKeys[key.name];
            if (specialHandler) {
                specialHandler();
                return;
            }
        }

        // Also check for special key by character (for single chars like 's')
        if (specialKeys && str && specialKeys[str]) {
            // Only trigger if input is empty (so user can still type the character in text)
            if (this.inputBuffer.length === 0) {
                specialKeys[str]();
                return;
            }
        }

        if (key.name === 'escape') {
            this.inputMode = 'navigation';
            this.inputBuffer = '';
            this.historyIndex = -1;
            if (onCancel) onCancel();
            return;
        }

        if (key.name === 'return') {
            const value = this.inputBuffer;
            
            // Add to history if enabled and not empty
            if (enableHistory && value.trim()) {
                this.addToHistory(value);
            }
            
            this.inputMode = 'navigation';
            this.inputBuffer = '';
            this.historyIndex = -1;
            if (onComplete) onComplete(value);
            return;
        }

        if (key.name === 'backspace') {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            if (onInput) onInput(this.inputBuffer);
            return;
        }

        // Check if up/down have special handlers (takes priority over history)
        if (specialKeys && key.name === 'up' && specialKeys['up']) {
            specialKeys['up']();
            return;
        }

        if (specialKeys && key.name === 'down' && specialKeys['down']) {
            specialKeys['down']();
            return;
        }

        // History navigation with up/down arrows (only if no special handlers)
        if (enableHistory && key.name === 'up') {
            this.navigateHistory(1, onInput);
            return;
        }

        if (enableHistory && key.name === 'down') {
            this.navigateHistory(-1, onInput);
            return;
        }

        // Add character to buffer
        if (str && str.length === 1) {
            if (maxLength && this.inputBuffer.length >= maxLength) return;
            if (validator && !validator(str)) return;
            
            // Reset history navigation when typing
            if (this.historyIndex !== -1) {
                this.historyIndex = -1;
            }
            
            this.inputBuffer += str;
            if (onInput) onInput(this.inputBuffer);
        }
    }

    /**
     * Navigate through command history
     */
    navigateHistory(direction, onInput) {
        if (this.history.length === 0) return;

        // Save current buffer when starting to navigate
        if (this.historyIndex === -1 && direction > 0) {
            this.tempBuffer = this.inputBuffer;
        }

        const newIndex = this.historyIndex + direction;

        if (newIndex < -1) {
            // Going past the beginning, restore temp buffer
            this.historyIndex = -1;
            this.inputBuffer = this.tempBuffer;
        } else if (newIndex >= this.history.length) {
            // At the end of history, don't go further
            return;
        } else if (newIndex === -1) {
            // Back to current input
            this.historyIndex = -1;
            this.inputBuffer = this.tempBuffer;
        } else {
            // Navigate through history
            this.historyIndex = newIndex;
            this.inputBuffer = this.history[this.historyIndex];
        }

        if (onInput) onInput(this.inputBuffer);
    }

    /**
     * Add entry to command history
     */
    addToHistory(entry) {
        // Don't add duplicates at the front
        if (this.history[0] === entry) return;
        
        // Remove if exists elsewhere
        const existingIndex = this.history.indexOf(entry);
        if (existingIndex > -1) {
            this.history.splice(existingIndex, 1);
        }
        
        // Add to front
        this.history.unshift(entry);
        
        // Trim to max
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
    }

    /**
     * Get command history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Set command history (for persistence)
     */
    setHistory(history) {
        this.history = Array.isArray(history) ? history.slice(0, this.maxHistory) : [];
    }

    /**
     * Clear command history
     */
    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
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

        // Also check key.name directly in case keyId transformation affected it
        if (key.name && key.name !== keyId && this.listeners.has(key.name)) {
            const callback = this.listeners.get(key.name);
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
     * Clear all listeners and reset input state
     */
    clearListeners() {
        this.listeners.clear();
        this.globalListeners = [];
        // Also ensure we're in navigation mode for clean screen transitions
        if (this.inputMode === 'text') {
            this.inputMode = 'navigation';
            this.inputBuffer = '';
            this.textInputOptions = {};
        }
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
        this.historyIndex = -1;
        this.tempBuffer = '';
        this.textInputOptions = {
            onInput: options.onInput || (() => {}),
            onComplete: options.onComplete || (() => {}),
            onCancel: options.onCancel || (() => {}),
            maxLength: options.maxLength || 100,
            validator: options.validator || null,
            enableHistory: options.enableHistory !== false, // Enable by default
            specialKeys: options.specialKeys || null // Keys that trigger actions instead of typing
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
        // Stop any active text input to switch to navigation mode
        if (this.inputMode === 'text') {
            this.stopTextInput();
        }
        
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
        // Stop any active text input to switch to navigation mode
        const wasTextMode = this.inputMode === 'text';
        if (wasTextMode) {
            this.stopTextInput();
        }
        
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
