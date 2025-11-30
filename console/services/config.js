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

            // Statistics
            stats: {
                totalRankChanges: 0,
                totalPromotions: 0,
                totalDemotions: 0,
                lastActivity: null
            }
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
     * Save configuration to file
     */
    save() {
        try {
            this.ensureConfigDir();
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
            return true;
        } catch (error) {
            console.error('Failed to save config:', error.message);
            return false;
        }
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
     * Update stats
     */
    updateStats(action) {
        this.config.stats.lastActivity = new Date().toISOString();
        
        switch (action) {
            case 'rank':
                this.config.stats.totalRankChanges++;
                break;
            case 'promote':
                this.config.stats.totalPromotions++;
                break;
            case 'demote':
                this.config.stats.totalDemotions++;
                break;
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
}

module.exports = new ConfigService();
