/**
 * Search Screen - Member search interface
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class SearchScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            searchQuery: '',
            results: [],
            selectedIndex: 0,
            loading: false,
            error: null,
            user: null // Selected user details
        };
    }

    /**
     * Show the search screen
     */
    async show() {
        this.state = {
            searchQuery: '',
            results: [],
            selectedIndex: 0,
            loading: false,
            error: null,
            user: null
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
        const { contentY } = components.drawFrame('MEMBER SEARCH', '[ESC] Back');

        const contentX = 3;
        let currentY = contentY + 1;

        // Search input
        this.renderSearchInput(contentX, currentY, width - 6);

        // Results or user details
        if (this.state.user) {
            this.renderUserDetails(contentX, currentY + 4, width - 6);
        } else if (this.state.loading) {
            this.renderLoading(contentX, currentY + 4);
        } else if (this.state.results.length > 0) {
            this.renderResults(contentX, currentY + 4, width - 6, height - contentY - 8);
        } else if (this.state.searchQuery && !this.state.error) {
            this.renderNoResults(contentX, currentY + 4);
        }

        // Error message
        if (this.state.error) {
            renderer.writeAt(contentX, height - 4, `${renderer.color('error')}Error: ${this.state.error}${renderer.constructor.ANSI.RESET}`);
        }

        // Key hints
        if (this.state.user) {
            components.drawKeyHints([
                { key: 'R', action: 'Rank' },
                { key: 'P', action: 'Promote' },
                { key: 'D', action: 'Demote' },
                { key: 'ESC', action: 'Back' }
            ]);
        } else {
            components.drawKeyHints([
                { key: 'ENTER', action: 'Search/Select' },
                { key: 'UP/DOWN', action: 'Navigate' },
                { key: 'ESC', action: 'Back' }
            ]);
        }
    }

    /**
     * Render search input
     */
    renderSearchInput(x, y, width) {
        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');

        renderer.writeAt(x, y, `${labelColor}Search:${renderer.constructor.ANSI.RESET} ${textColor}${this.state.searchQuery}${renderer.constructor.ANSI.RESET}_`);
        components.drawSeparator(x, y + 2, width);
    }

    /**
     * Render loading state
     */
    renderLoading(x, y) {
        const dimColor = renderer.color('textDim');
        renderer.writeAt(x, y, `${dimColor}Searching...${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Render no results message
     */
    renderNoResults(x, y) {
        const dimColor = renderer.color('textDim');
        renderer.writeAt(x, y, `${dimColor}No results found for "${this.state.searchQuery}"${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Render search results
     */
    renderResults(x, y, width, maxHeight) {
        const textColor = renderer.color('text');
        const selectedColor = renderer.color('menuSelected');
        const dimColor = renderer.color('textDim');
        const labelColor = renderer.color('label');

        renderer.writeAt(x, y, `${labelColor}Results (${this.state.results.length} found):${renderer.constructor.ANSI.RESET}`);

        const resultsY = y + 2;
        const maxResults = Math.min(maxHeight - 4, 10);

        this.state.results.slice(0, maxResults).forEach((result, i) => {
            const isSelected = i === this.state.selectedIndex;
            const color = isSelected ? selectedColor : textColor;
            const prefix = isSelected ? '> ' : '  ';

            const line = `${prefix}${format.pad(result.username || `ID: ${result.userId}`, 20)} ${format.pad(result.rankName || 'Unknown', 15)} (${result.rank || '?'})`;
            renderer.writeAt(x, resultsY + i, `${color}${line}${renderer.constructor.ANSI.RESET}`);
        });

        if (this.state.results.length > maxResults) {
            renderer.writeAt(x, resultsY + maxResults, `${dimColor}... and ${this.state.results.length - maxResults} more${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Render user details
     */
    renderUserDetails(x, y, width) {
        const user = this.state.user;
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');

        // User info box
        components.drawUserCard(x, y, user);

        // Actions
        const actionsY = y + 10;
        renderer.writeAt(x, actionsY, `${textColor}Actions:${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x + 2, actionsY + 1, `${renderer.color('menuKey')}[R]${renderer.constructor.ANSI.RESET} ${textColor}Set Rank${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x + 2, actionsY + 2, `${renderer.color('menuKey')}[P]${renderer.constructor.ANSI.RESET} ${textColor}Promote${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x + 2, actionsY + 3, `${renderer.color('menuKey')}[D]${renderer.constructor.ANSI.RESET} ${textColor}Demote${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        if (this.state.user) {
            // User detail mode
            input.on('escape', () => {
                this.state.user = null;
                this.render();
                this.setupInput();
            });

            input.on('r', () => {
                // Go to rank screen with this user
                this.app.showScreen('rank', { user: this.state.user });
            });

            input.on('p', async () => {
                await this.quickPromote();
            });

            input.on('d', async () => {
                await this.quickDemote();
            });
        } else {
            // Search mode - text input with special keys for navigation
            input.startTextInput({
                initialValue: this.state.searchQuery,
                maxLength: 50,
                enableHistory: true,
                onInput: (value) => {
                    this.state.searchQuery = value;
                    this.state.error = null;
                    this.render();
                },
                onComplete: async (value) => {
                    if (this.state.results.length > 0 && !value) {
                        // If no new input but we have results, select the current one
                        this.selectUser(this.state.selectedIndex);
                    } else if (value && value.trim()) {
                        await this.performSearch(value.trim());
                    }
                },
                onCancel: () => {
                    if (this.state.searchQuery) {
                        this.state.searchQuery = '';
                        this.state.results = [];
                        this.render();
                        this.setupInput();
                    } else {
                        this.app.showScreen('dashboard');
                    }
                },
                // Allow arrow keys to navigate results while typing
                specialKeys: {
                    'up': () => {
                        if (this.state.selectedIndex > 0) {
                            this.state.selectedIndex--;
                            this.render();
                        }
                    },
                    'down': () => {
                        if (this.state.selectedIndex < this.state.results.length - 1) {
                            this.state.selectedIndex++;
                            this.render();
                        }
                    }
                }
            });
        }
    }

    /**
     * Perform search
     */
    async performSearch(query) {
        this.state.loading = true;
        this.state.error = null;
        this.state.results = [];
        this.state.selectedIndex = 0;
        await this.render();

        try {
            // Try to look up as a single user first
            const result = await api.lookupUser(query);
            
            if (result.success) {
                this.state.results = [result];
            } else {
                this.state.error = result.message || 'User not found';
            }
        } catch (e) {
            this.state.error = e.message;
        }

        this.state.loading = false;
        await this.render();
        this.setupInput();
    }

    /**
     * Select a user from results
     */
    async selectUser(index) {
        const selectedResult = this.state.results[index];
        if (!selectedResult) return;

        this.state.loading = true;
        await this.render();

        // Show spinner during user fetch
        const { height } = renderer.getDimensions();
        const spinnerId = animations.startSpinner(3, height - 5, 'bounce', 'Fetching user details...');

        try {
            // Get full user details
            const user = await api.getUserRank(selectedResult.userId);
            if (user.success) {
                this.state.user = user;
            } else {
                this.state.error = user.message;
            }
        } catch (e) {
            this.state.error = e.message;
        }

        animations.stopSpinner(spinnerId);
        this.state.loading = false;
        await this.render();
        this.setupInput();
    }

    /**
     * Quick promote from search
     */
    async quickPromote() {
        if (!this.state.user) return;

        this.state.loading = true;
        await this.render();

        try {
            const result = await api.promote(this.state.user.userId);
            
            if (result.success) {
                config.addLogEntry({
                    action: 'PROMOTE',
                    userId: this.state.user.userId,
                    username: this.state.user.username,
                    message: `${this.state.user.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('promote');

                // Update displayed user
                this.state.user.rank = result.newRank;
                this.state.user.rankName = result.newRankName;
            } else {
                this.state.error = result.message;
            }
        } catch (e) {
            this.state.error = e.message;
        }

        this.state.loading = false;
        await this.render();
        this.setupInput();
    }

    /**
     * Quick demote from search
     */
    async quickDemote() {
        if (!this.state.user) return;

        this.state.loading = true;
        await this.render();

        try {
            const result = await api.demote(this.state.user.userId);
            
            if (result.success) {
                config.addLogEntry({
                    action: 'DEMOTE',
                    userId: this.state.user.userId,
                    username: this.state.user.username,
                    message: `${this.state.user.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('demote');

                // Update displayed user
                this.state.user.rank = result.newRank;
                this.state.user.rankName = result.newRankName;
            } else {
                this.state.error = result.message;
            }
        } catch (e) {
            this.state.error = e.message;
        }

        this.state.loading = false;
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

module.exports = SearchScreen;
