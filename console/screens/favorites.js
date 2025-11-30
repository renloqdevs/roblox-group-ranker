/**
 * Favorites Screen - Quick access to frequently ranked users
 */

const renderer = require('../ui/renderer');
const components = require('../ui/components');
const animations = require('../ui/animations');
const input = require('../utils/input');
const format = require('../utils/format');
const api = require('../services/api');
const config = require('../services/config');

class FavoritesScreen {
    constructor(app) {
        this.app = app;
        this.state = {
            favorites: [],
            selectedIndex: 0,
            page: 0,
            pageSize: 8,
            action: null // 'rank', 'promote', 'demote', 'remove'
        };
    }

    /**
     * Show the favorites screen
     */
    async show() {
        this.state.favorites = config.getFavorites();
        this.state.selectedIndex = 0;
        this.state.page = 0;
        this.state.action = null;

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
        const { contentY } = components.drawFrame('FAVORITES', `${this.state.favorites.length} users`);

        const contentX = 3;
        let currentY = contentY + 1;

        if (this.state.favorites.length === 0) {
            this.renderEmptyState(contentX, currentY, width - 6);
        } else {
            this.renderFavoritesList(contentX, currentY, width - 6);
        }

        // Key hints
        const totalPages = Math.ceil(this.state.favorites.length / this.state.pageSize);
        const hints = [
            { key: 'UP/DOWN', action: 'Navigate' },
            { key: 'ENTER', action: 'Quick Rank' },
            { key: '+', action: 'Promote' },
            { key: '-', action: 'Demote' },
            { key: 'X', action: 'Remove' }
        ];
        if (totalPages > 1) {
            hints.push({ key: 'N/P', action: 'Page' });
        }
        hints.push({ key: 'ESC', action: 'Back' });
        components.drawKeyHints(hints);
    }

    /**
     * Render empty state
     */
    renderEmptyState(x, y, width) {
        const dimColor = renderer.color('textDim');
        const textColor = renderer.color('text');

        renderer.writeAt(x, y + 2, `${dimColor}No favorites yet!${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 4, `${textColor}When you rank users, they'll appear here${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 5, `${textColor}for quick access.${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x, y + 8, `${dimColor}Press ESC to go back${renderer.constructor.ANSI.RESET}`);
    }

    /**
     * Render favorites list
     */
    renderFavoritesList(x, y, width) {
        const textColor = renderer.color('text');
        const labelColor = renderer.color('label');
        const dimColor = renderer.color('textDim');
        const highlightColor = renderer.color('menuKey');

        // Header
        renderer.writeAt(x, y, `${labelColor}User${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x + 25, y, `${labelColor}Current Rank${renderer.constructor.ANSI.RESET}`);
        renderer.writeAt(x + 45, y, `${labelColor}Uses${renderer.constructor.ANSI.RESET}`);

        components.drawSeparator(x, y + 1, width);

        // Calculate page
        const startIndex = this.state.page * this.state.pageSize;
        const endIndex = Math.min(startIndex + this.state.pageSize, this.state.favorites.length);
        const pageItems = this.state.favorites.slice(startIndex, endIndex);

        // Draw items
        pageItems.forEach((fav, index) => {
            const actualIndex = startIndex + index;
            const isSelected = actualIndex === this.state.selectedIndex;
            const prefix = isSelected ? `${highlightColor}>` : ' ';
            const color = isSelected ? highlightColor : textColor;

            const itemY = y + 2 + index;

            renderer.writeAt(x, itemY, `${prefix} ${color}${format.truncate(fav.username, 20).padEnd(22)}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x + 25, itemY, `${dimColor}${(fav.lastRankName || 'Unknown').substring(0, 18)}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x + 45, itemY, `${dimColor}${fav.useCount || 0}${renderer.constructor.ANSI.RESET}`);
        });

        // Page indicator
        const totalPages = Math.ceil(this.state.favorites.length / this.state.pageSize);
        if (totalPages > 1) {
            const pageY = y + 2 + this.state.pageSize + 1;
            renderer.writeAt(x, pageY, `${dimColor}Page ${this.state.page + 1}/${totalPages} - Use N/P to navigate${renderer.constructor.ANSI.RESET}`);
        }

        // Selected user details
        if (this.state.favorites.length > 0) {
            const selected = this.state.favorites[this.state.selectedIndex];
            const detailY = y + 2 + this.state.pageSize + 3;

            components.drawSeparator(x, detailY - 1, width);
            renderer.writeAt(x, detailY, `${labelColor}Selected:${renderer.constructor.ANSI.RESET} ${textColor}${selected.username}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, detailY + 1, `${labelColor}User ID:${renderer.constructor.ANSI.RESET}  ${dimColor}${selected.userId}${renderer.constructor.ANSI.RESET}`);
            renderer.writeAt(x, detailY + 2, `${labelColor}Last Used:${renderer.constructor.ANSI.RESET} ${dimColor}${selected.lastUsed ? format.relativeTime(selected.lastUsed) : 'Never'}${renderer.constructor.ANSI.RESET}`);
        }
    }

    /**
     * Setup input handlers
     */
    setupInput() {
        input.clearListeners();

        // Navigation
        input.on('up', () => this.navigate(-1));
        input.on('down', () => this.navigate(1));
        input.on('n', () => this.changePage(1));
        input.on('p', () => this.changePage(-1));
        input.on('pagedown', () => this.changePage(1));
        input.on('pageup', () => this.changePage(-1));

        // Actions - use + and - for promote/demote to avoid conflict with P for page
        input.on('return', () => this.quickRank());
        input.on('+', () => this.promoteSelected());
        input.on('=', () => this.promoteSelected());  // = is same key as + without shift
        input.on('-', () => this.demoteSelected());
        input.on('d', () => this.demoteSelected());   // D also works for demote
        input.on('x', () => this.removeSelected());

        // Back
        input.on('escape', () => this.app.showScreen('dashboard'));
    }

    /**
     * Navigate through the list
     */
    navigate(delta) {
        const newIndex = this.state.selectedIndex + delta;
        if (newIndex >= 0 && newIndex < this.state.favorites.length) {
            this.state.selectedIndex = newIndex;
            
            // Update page if needed
            const newPage = Math.floor(newIndex / this.state.pageSize);
            if (newPage !== this.state.page) {
                this.state.page = newPage;
            }
            
            this.render();
        }
    }

    /**
     * Change page
     */
    changePage(delta) {
        const totalPages = Math.ceil(this.state.favorites.length / this.state.pageSize);
        const newPage = this.state.page + delta;
        
        if (newPage >= 0 && newPage < totalPages) {
            this.state.page = newPage;
            this.state.selectedIndex = newPage * this.state.pageSize;
            this.render();
        }
    }

    /**
     * Quick rank - go to rank screen with user pre-filled
     */
    async quickRank() {
        if (this.state.favorites.length === 0) return;
        
        const selected = this.state.favorites[this.state.selectedIndex];
        config.incrementFavoriteUse(selected.userId);
        
        // Navigate to rank screen with user pre-selected
        this.app.showScreen('rank', { 
            prefillUser: selected.username 
        });
    }

    /**
     * Promote selected user
     */
    async promoteSelected() {
        if (this.state.favorites.length === 0) return;
        
        const selected = this.state.favorites[this.state.selectedIndex];
        
        // Confirm before promoting
        components.drawConfirmDialog(`Promote ${selected.username}?`);
        const confirmed = await input.confirm(true);
        
        if (!confirmed) {
            await this.render();
            this.setupInput();
            return;
        }
        
        config.incrementFavoriteUse(selected.userId);

        // Show loading
        const { width, height } = renderer.getDimensions();
        const spinnerId = animations.startSpinner(3, height - 5, 'bounce', `Promoting ${selected.username}...`);

        try {
            const result = await api.promote(selected.userId);
            animations.stopSpinner(spinnerId);

            if (result.success) {
                // Update favorite with new rank
                selected.lastRank = result.newRank;
                selected.lastRankName = result.newRankName;
                config.addFavorite(selected);

                // Log activity
                config.addLogEntry({
                    action: 'PROMOTE',
                    userId: selected.userId,
                    username: selected.username,
                    message: `${selected.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('promote');

                // Show success
                await this.showResult(true, `Promoted to ${result.newRankName}`);
            } else {
                await this.showResult(false, result.message || 'Promotion failed');
            }
        } catch (e) {
            animations.stopSpinner(spinnerId);
            await this.showResult(false, e.message);
        }

        this.state.favorites = config.getFavorites();
        await this.render();
        this.setupInput();
    }

    /**
     * Demote selected user
     */
    async demoteSelected() {
        if (this.state.favorites.length === 0) return;
        
        const selected = this.state.favorites[this.state.selectedIndex];
        
        // Confirm before demoting
        components.drawConfirmDialog(`Demote ${selected.username}?`);
        const confirmed = await input.confirm(true);
        
        if (!confirmed) {
            await this.render();
            this.setupInput();
            return;
        }
        
        config.incrementFavoriteUse(selected.userId);

        // Show loading
        const { width, height } = renderer.getDimensions();
        const spinnerId = animations.startSpinner(3, height - 5, 'bounce', `Demoting ${selected.username}...`);

        try {
            const result = await api.demote(selected.userId);
            animations.stopSpinner(spinnerId);

            if (result.success) {
                // Update favorite with new rank
                selected.lastRank = result.newRank;
                selected.lastRankName = result.newRankName;
                config.addFavorite(selected);

                // Log activity
                config.addLogEntry({
                    action: 'DEMOTE',
                    userId: selected.userId,
                    username: selected.username,
                    message: `${selected.username}: ${result.oldRankName} -> ${result.newRankName}`
                });
                config.updateStats('demote');

                // Show success
                await this.showResult(true, `Demoted to ${result.newRankName}`);
            } else {
                await this.showResult(false, result.message || 'Demotion failed');
            }
        } catch (e) {
            animations.stopSpinner(spinnerId);
            await this.showResult(false, e.message);
        }

        this.state.favorites = config.getFavorites();
        await this.render();
        this.setupInput();
    }

    /**
     * Remove selected from favorites
     */
    async removeSelected() {
        if (this.state.favorites.length === 0) return;
        
        const selected = this.state.favorites[this.state.selectedIndex];
        
        // Confirm
        components.drawConfirmDialog(`Remove ${selected.username} from favorites?`);
        const confirmed = await input.confirm(false);
        
        if (confirmed) {
            config.removeFavorite(selected.userId);
            this.state.favorites = config.getFavorites();
            
            // Adjust selection if needed
            if (this.state.selectedIndex >= this.state.favorites.length) {
                this.state.selectedIndex = Math.max(0, this.state.favorites.length - 1);
            }
        }
        
        await this.render();
        this.setupInput();
    }

    /**
     * Show result message briefly
     */
    async showResult(success, message) {
        const { width, height } = renderer.getDimensions();
        const color = success ? renderer.color('success') : renderer.color('error');
        const icon = success ? '[OK]' : '[X]';
        
        renderer.writeAt(3, height - 5, `${color}${icon} ${message}${renderer.constructor.ANSI.RESET}`);
        await new Promise(r => setTimeout(r, 1500));
    }

    /**
     * Hide/cleanup
     */
    hide() {
        input.clearListeners();
    }
}

module.exports = FavoritesScreen;
