/**
 * Config Service - Persistent configuration storage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

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
            maxSearchHistory: 50,

            // Security settings (password stored as hash, never plaintext)
            // Password is stored in ~/.rankbot/config.json (user home, NOT project files)
            security: {
                passwordHash: null,      // Scrypt-derived key (never store plaintext)
                passwordSalt: null,      // Random salt for password hashing
                failedAttempts: 0,       // Track failed login attempts
                lockedUntil: null,       // Lockout timestamp if too many failures
                lastLoginTime: null,     // Timestamp of last successful login
                sessionTimeout: 3600000  // Session timeout in ms (default: 1 hour)
            },

            // Last action for undo functionality
            lastAction: null
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
        // Save first, then clear pendingSave to avoid race condition
        // where a new save request during _doSave() would be lost
        const result = this._doSave();
        this.pendingSave = false;
        return result;
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

    // ============================================
    // PASSWORD / SECURITY MANAGEMENT
    // ============================================

    /**
     * Hash a password using scrypt (secure key derivation)
     * @param {string} password - Plain text password
     * @param {string} salt - Salt for hashing (generate new if not provided)
     * @returns {Object} { hash, salt }
     */
    hashPassword(password, salt = null) {
        // Generate salt if not provided
        if (!salt) {
            salt = crypto.randomBytes(32).toString('hex');
        }
        
        // Use scrypt for secure password hashing
        // N=16384, r=8, p=1 are recommended parameters
        const hash = crypto.scryptSync(password, salt, 64, {
            N: 16384,
            r: 8,
            p: 1
        }).toString('hex');
        
        return { hash, salt };
    }

    /**
     * Check if a password has been set up
     * @returns {boolean}
     */
    isPasswordConfigured() {
        return !!(this.config.security?.passwordHash && this.config.security?.passwordSalt);
    }

    /**
     * Set up a new password
     * @param {string} password - Plain text password (will be hashed)
     */
    setPassword(password) {
        const { hash, salt } = this.hashPassword(password);
        
        if (!this.config.security) {
            this.config.security = {};
        }
        
        this.config.security.passwordHash = hash;
        this.config.security.passwordSalt = salt;
        this.config.security.authEnabled = true;
        this.config.security.failedAttempts = 0;
        this.config.security.lockedUntil = null;
        
        this.saveImmediate(); // Critical security operation
    }

    /**
     * Verify a password against stored hash
     * @param {string} password - Plain text password to verify
     * @returns {boolean} True if password matches
     */
    verifyPassword(password) {
        // Check for lockout first
        if (this.isLockedOut()) {
            return false;
        }
        
        let isValid = false;
        
        if (this.config.security?.passwordHash && this.config.security?.passwordSalt) {
            // Check against stored hash
            const { hash } = this.hashPassword(password, this.config.security.passwordSalt);
            
            // Use timing-safe comparison to prevent timing attacks
            try {
                isValid = crypto.timingSafeEqual(
                    Buffer.from(hash),
                    Buffer.from(this.config.security.passwordHash)
                );
            } catch {
                isValid = false;
            }
        }
        
        // Track failed attempts
        if (!isValid) {
            this.recordFailedAttempt();
        } else {
            this.clearFailedAttempts();
        }
        
        return isValid;
    }

    /**
     * Record a failed login attempt
     */
    recordFailedAttempt() {
        if (!this.config.security) {
            this.config.security = {};
        }
        
        this.config.security.failedAttempts = (this.config.security.failedAttempts || 0) + 1;
        
        // Lock out after 5 failed attempts for 5 minutes
        if (this.config.security.failedAttempts >= 5) {
            this.config.security.lockedUntil = Date.now() + (5 * 60 * 1000);
        }
        
        this.save();
    }

    /**
     * Clear failed attempts after successful login
     */
    clearFailedAttempts() {
        if (this.config.security) {
            this.config.security.failedAttempts = 0;
            this.config.security.lockedUntil = null;
            this.save();
        }
    }

    /**
     * Check if account is locked out due to failed attempts
     * @returns {boolean}
     */
    isLockedOut() {
        if (!this.config.security?.lockedUntil) {
            return false;
        }
        
        if (Date.now() > this.config.security.lockedUntil) {
            // Lockout expired
            this.config.security.lockedUntil = null;
            this.config.security.failedAttempts = 0;
            this.save();
            return false;
        }
        
        return true;
    }

    /**
     * Get remaining lockout time in seconds
     * @returns {number} Seconds remaining, or 0 if not locked
     */
    getLockoutRemaining() {
        if (!this.config.security?.lockedUntil) {
            return 0;
        }
        
        const remaining = Math.ceil((this.config.security.lockedUntil - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Remove password protection
     */
    removePassword() {
        if (this.config.security) {
            this.config.security.passwordHash = null;
            this.config.security.passwordSalt = null;
            this.config.security.failedAttempts = 0;
            this.config.security.lockedUntil = null;
            this.saveImmediate();
        }
    }

    /**
     * Change password (requires current password verification)
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {boolean} True if password was changed
     */
    changePassword(currentPassword, newPassword) {
        if (!this.verifyPassword(currentPassword)) {
            return false;
        }
        
        this.setPassword(newPassword);
        return true;
    }

    /**
     * Get security status for display
     * @returns {Object} Security status info
     */
    getSecurityStatus() {
        return {
            passwordSet: this.isPasswordConfigured(),
            isLockedOut: this.isLockedOut(),
            lockoutRemaining: this.getLockoutRemaining(),
            failedAttempts: this.config.security?.failedAttempts || 0
        };
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Record successful login time
     */
    recordLogin() {
        if (!this.config.security) {
            this.config.security = {};
        }
        this.config.security.lastLoginTime = Date.now();
        this.saveImmediate();
    }

    /**
     * Check if current session is still valid
     * @returns {boolean} True if session is valid, false if expired
     */
    isSessionValid() {
        const lastLogin = this.config.security?.lastLoginTime;
        const timeout = this.config.security?.sessionTimeout || 3600000; // Default 1 hour
        
        if (!lastLogin) {
            return false;
        }
        
        const elapsed = Date.now() - lastLogin;
        return elapsed < timeout;
    }

    /**
     * Get remaining session time in seconds
     * @returns {number} Seconds remaining, or 0 if expired
     */
    getSessionRemaining() {
        const lastLogin = this.config.security?.lastLoginTime;
        const timeout = this.config.security?.sessionTimeout || 3600000;
        
        if (!lastLogin) {
            return 0;
        }
        
        const remaining = timeout - (Date.now() - lastLogin);
        return remaining > 0 ? Math.floor(remaining / 1000) : 0;
    }

    /**
     * Set session timeout duration
     * @param {number} ms - Timeout in milliseconds
     */
    setSessionTimeout(ms) {
        if (!this.config.security) {
            this.config.security = {};
        }
        this.config.security.sessionTimeout = ms;
        this.save();
    }

    /**
     * Get session timeout duration in milliseconds
     * @returns {number}
     */
    getSessionTimeout() {
        return this.config.security?.sessionTimeout || 3600000;
    }

    /**
     * Invalidate current session (force re-login)
     */
    invalidateSession() {
        if (this.config.security) {
            this.config.security.lastLoginTime = null;
            this.saveImmediate();
        }
    }

    // ============================================
    // UNDO FUNCTIONALITY
    // ============================================

    /**
     * Store the last action for potential undo
     * @param {Object} action - Action details
     * @param {string} action.type - 'rank', 'promote', 'demote'
     * @param {number} action.userId - User ID
     * @param {string} action.username - Username
     * @param {number} action.oldRank - Previous rank number
     * @param {string} action.oldRankName - Previous rank name
     * @param {number} action.newRank - New rank number
     * @param {string} action.newRankName - New rank name
     */
    setLastAction(action) {
        this.config.lastAction = {
            ...action,
            timestamp: Date.now()
        };
        this.save();
    }

    /**
     * Get the last action (if any and not expired)
     * Actions expire after 5 minutes
     * @returns {Object|null} Last action or null if none/expired
     */
    getLastAction() {
        const action = this.config.lastAction;
        if (!action) {
            return null;
        }
        
        // Actions expire after 5 minutes
        const expiry = 5 * 60 * 1000;
        if (Date.now() - action.timestamp > expiry) {
            this.clearLastAction();
            return null;
        }
        
        return action;
    }

    /**
     * Clear the last action (after undo or expiry)
     */
    clearLastAction() {
        this.config.lastAction = null;
        this.save();
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.getLastAction() !== null;
    }
}

module.exports = new ConfigService();
