/**
 * Config Service - Persistent configuration storage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigService {
    constructor() {
        // Store config in user's home directory
        this.configDir = path.join(os.homedir(), '.rankbot');
        this.configFile = path.join(this.configDir, 'config.json');
        this.config = this.getDefaultConfig();
        this.loaded = false;
        
        // Debounce saves to prevent excessive I/O
        this.saveTimeout = null;
        this.pendingSave = false;
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            // API connection
            apiUrl: '',
            apiKey: '',

            // Bot info (cached)
            botUsername: '',
            botUserId: null,
            groupName: '',
            groupId: null,

            // User preferences
            preferences: {
                confirmBeforeRank: true,
                showAnimations: true,
                soundNotifications: false,
                autoRefresh: true,
                autoRefreshInterval: 30000, // 30 seconds
                theme: 'default',
                pageSize: 10
            },

            // Activity log
            activityLog: [],
            maxLogEntries: 100,

            // Cache
            rolesCache: null,
            rolesCacheTime: null,
            cacheExpiry: 300000, // 5 minutes

            // First run flag
            firstRun: true,
            setupComplete: false,
            demoMode: false, // True if user skipped setup to explore

            // Statistics
            stats: {
                totalRankChanges: 0,
                totalPromotions: 0,
                totalDemotions: 0,
                lastActivity: null
            },

            // Favorites - frequently ranked users
            favorites: [],
            maxFavorites: 20,

            // Command/search history
            searchHistory: [],
            maxSearchHistory: 50
        };
    }

    /**
     * Ensure config directory exists
     */
    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    /**
     * Load configuration from file
     */
    load() {
        try {
            this.ensureConfigDir();
            
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                const loaded = JSON.parse(data);
                
                // Merge with defaults to ensure new properties exist
                this.config = this.mergeDeep(this.getDefaultConfig(), loaded);
            }
            
            this.loaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load config:', error.message);
            return false;
        }
    }

    /**
     * Save configuration to file (debounced)
     */
    save() {
        // Debounce saves to prevent excessive I/O
        if (this.saveTimeout) {
            this.pendingSave = true;
            return true;
        }
        
        this.saveTimeout = setTimeout(() => {
            this._doSave();
            this.saveTimeout = null;
            if (this.pendingSave) {
                this.pendingSave = false;
                this.save();
            }
        }, 500);
        
        return true;
    }

    /**
     * Perform the actual save operation
     */
    _doSave() {
        try {
            this.ensureConfigDir();
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), {
                mode: 0o600  // Read/write for owner only (security)
            });
            return true;
        } catch (error) {
            console.error('Failed to save config:', error.message);
            return false;
        }
    }

    /**
     * Force immediate save (for critical operations)
     */
    saveImmediate() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.pendingSave = false;
        return this._doSave();
    }

    /**
     * Deep merge objects
     */
    mergeDeep(target, source) {
        const output = Object.assign({}, target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.mergeDeep(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }

    /**
     * Check if value is object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Get a config value
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value === null || value === undefined) return defaultValue;
            value = value[k];
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set a config value
     */
    set(key, value) {
        const keys = key.split('.');
        let obj = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        
        obj[keys[keys.length - 1]] = value;
        this.save();
    }

    /**
     * Check if first run
     */
    isFirstRun() {
        return this.config.firstRun || !this.config.setupComplete;
    }

    /**
     * Mark setup as complete
     */
    completeSetup() {
        this.config.firstRun = false;
        this.config.setupComplete = true;
        this.save();
    }

    /**
     * Check if API is configured
     */
    isConfigured() {
        return Boolean(this.config.apiUrl && this.config.apiKey);
    }

    /**
     * Check if in demo mode (skipped setup)
     */
    isInDemoMode() {
        return this.config.demoMode === true && !this.isConfigured();
    }

    /**
     * Enable demo mode (skip setup)
     */
    enableDemoMode() {
        this.config.demoMode = true;
        this.config.firstRun = false;
        this.save();
    }

    /**
     * Exit demo mode (user wants to configure)
     */
    exitDemoMode() {
        this.config.demoMode = false;
        this.config.firstRun = true;
        this.config.setupComplete = false;
        this.save();
    }

    /**
     * Check if features should work (configured and not in demo mode)
     */
    areFeaturesEnabled() {
        return this.isConfigured() && !this.isInDemoMode();
    }

    /**
     * Set API credentials
     */
    setApiCredentials(url, key) {
        this.config.apiUrl = url;
        this.config.apiKey = key;
        this.save();
    }

    /**
     * Get API credentials
     */
    getApiCredentials() {
        return {
            url: this.config.apiUrl,
            key: this.config.apiKey
        };
    }

    /**
     * Set bot info
     */
    setBotInfo(info) {
        this.config.botUsername = info.username || '';
        this.config.botUserId = info.userId || null;
        this.config.groupName = info.groupName || '';
        this.config.groupId = info.groupId || null;
        this.save();
    }

    /**
     * Get bot info
     */
    getBotInfo() {
        return {
            username: this.config.botUsername,
            userId: this.config.botUserId,
            groupName: this.config.groupName,
            groupId: this.config.groupId
        };
    }

    /**
     * Get preference
     */
    getPreference(key) {
        return this.config.preferences[key];
    }

    /**
     * Set preference
     */
    setPreference(key, value) {
        this.config.preferences[key] = value;
        this.save();
    }

    /**
     * Get all preferences
     */
    getPreferences() {
        return { ...this.config.preferences };
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        this.config.preferences.theme = theme;
        this.save();
    }

    /**
     * Get theme
     */
    getTheme() {
        return this.config.preferences.theme;
    }

    /**
     * Add activity log entry
     */
    addLogEntry(entry) {
        this.config.activityLog.unshift({
            ...entry,
            timestamp: new Date().toISOString()
        });

        // Trim log to max entries
        if (this.config.activityLog.length > this.config.maxLogEntries) {
            this.config.activityLog = this.config.activityLog.slice(0, this.config.maxLogEntries);
        }

        this.save();
    }

    /**
     * Get activity log
     */
    getActivityLog(limit = null) {
        if (limit) {
            return this.config.activityLog.slice(0, limit);
        }
        return [...this.config.activityLog];
    }

    /**
     * Clear activity log
     */
    clearActivityLog() {
        this.config.activityLog = [];
        this.save();
    }

    /**
     * Update stats (simplified with lookup table)
     */
    updateStats(action) {
        this.config.stats.lastActivity = new Date().toISOString();
        
        const statMap = {
            'rank': 'totalRankChanges',
            'promote': 'totalPromotions',
            'demote': 'totalDemotions'
        };
        
        const statKey = statMap[action];
        if (statKey) {
            this.config.stats[statKey]++;
        }
        
        this.save();
    }

    /**
     * Get stats
     */
    getStats() {
        return { ...this.config.stats };
    }

    /**
     * Cache roles
     */
    cacheRoles(roles) {
        this.config.rolesCache = roles;
        this.config.rolesCacheTime = Date.now();
        this.save();
    }

    /**
     * Get cached roles
     */
    getCachedRoles() {
        if (!this.config.rolesCache) return null;
        
        const age = Date.now() - this.config.rolesCacheTime;
        if (age > this.config.cacheExpiry) {
            this.config.rolesCache = null;
            this.config.rolesCacheTime = null;
            return null;
        }
        
        return this.config.rolesCache;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.config.rolesCache = null;
        this.config.rolesCacheTime = null;
        this.save();
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.config = this.getDefaultConfig();
        this.save();
    }

    /**
     * Export config (without sensitive data)
     */
    export() {
        const exported = { ...this.config };
        exported.apiKey = '***';
        return exported;
    }

    /**
     * Get config file path
     */
    getConfigPath() {
        return this.configFile;
    }

    // ============================================
    // FAVORITES MANAGEMENT
    // ============================================

    /**
     * Add a user to favorites
     */
    addFavorite(user) {
        // Check if already in favorites
        const existing = this.config.favorites.findIndex(f => f.userId === user.userId);
        if (existing !== -1) {
            // Update existing and move to top
            this.config.favorites.splice(existing, 1);
        }

        // Add to top of favorites
        this.config.favorites.unshift({
            userId: user.userId,
            username: user.username,
            lastRank: user.rank,
            lastRankName: user.rankName,
            addedAt: new Date().toISOString(),
            useCount: (existing !== -1 ? this.config.favorites[existing]?.useCount || 0 : 0) + 1
        });

        // Trim to max
        if (this.config.favorites.length > this.config.maxFavorites) {
            this.config.favorites = this.config.favorites.slice(0, this.config.maxFavorites);
        }

        this.save();
    }

    /**
     * Remove a user from favorites
     */
    removeFavorite(userId) {
        this.config.favorites = this.config.favorites.filter(f => f.userId !== userId);
        this.save();
    }

    /**
     * Get all favorites
     */
    getFavorites() {
        return [...this.config.favorites];
    }

    /**
     * Check if user is a favorite
     */
    isFavorite(userId) {
        return this.config.favorites.some(f => f.userId === userId);
    }

    /**
     * Increment favorite use count
     */
    incrementFavoriteUse(userId) {
        const fav = this.config.favorites.find(f => f.userId === userId);
        if (fav) {
            fav.useCount = (fav.useCount || 0) + 1;
            fav.lastUsed = new Date().toISOString();
            this.save();
        }
    }

    // ============================================
    // SEARCH HISTORY MANAGEMENT
    // ============================================

    /**
     * Add to search history
     */
    addSearchHistory(query) {
        // Remove if already exists
        this.config.searchHistory = this.config.searchHistory.filter(q => q !== query);
        
        // Add to front
        this.config.searchHistory.unshift(query);
        
        // Trim to max
        if (this.config.searchHistory.length > this.config.maxSearchHistory) {
            this.config.searchHistory = this.config.searchHistory.slice(0, this.config.maxSearchHistory);
        }
        
        this.save();
    }

    /**
     * Get search history
     */
    getSearchHistory(limit = 10) {
        return this.config.searchHistory.slice(0, limit);
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        this.config.searchHistory = [];
        this.save();
    }

    /**
     * Get search suggestions based on partial input
     */
    getSearchSuggestions(partial, limit = 5) {
        if (!partial) return [];
        const lower = partial.toLowerCase();
        
        // Combine favorites and history
        const suggestions = [];
        
        // Add matching favorites first
        for (const fav of this.config.favorites) {
            if (fav.username.toLowerCase().startsWith(lower)) {
                suggestions.push({
                    type: 'favorite',
                    value: fav.username,
                    userId: fav.userId,
                    rank: fav.lastRankName
                });
            }
        }
        
        // Add matching history
        for (const query of this.config.searchHistory) {
            if (query.toLowerCase().startsWith(lower) && 
                !suggestions.some(s => s.value.toLowerCase() === query.toLowerCase())) {
                suggestions.push({
                    type: 'history',
                    value: query
                });
            }
        }
        
        return suggestions.slice(0, limit);
    }
}

module.exports = new ConfigService();
