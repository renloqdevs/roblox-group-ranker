/**
 * API Service - HTTP client for the ranking bot API
 */

const config = require('./config');

class ApiService {
    constructor() {
        this.baseUrl = '';
        this.apiKey = '';
        this.timeout = 30000; // 30 seconds
        this.connected = false;
        this.lastError = null;
        this.botInfo = null;
    }

    /**
     * Initialize the API service with credentials
     */
    initialize() {
        const credentials = config.getApiCredentials();
        this.baseUrl = credentials.url;
        this.apiKey = credentials.key;
    }

    /**
     * Set API credentials
     */
    setCredentials(url, key) {
        this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = key;
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, method = 'GET', body = null) {
        if (!this.baseUrl) {
            throw new Error('API URL not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
        };

        const options = {
            method,
            headers
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        try {
            // Use dynamic import for node-fetch
            const fetch = (await import('node-fetch')).default;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            options.signal = controller.signal;

            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            this.lastError = null;
            return data;

        } catch (error) {
            this.lastError = error.message;
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            throw error;
        }
    }

    /**
     * Test connection to API
     */
    async testConnection() {
        try {
            const result = await this.request('/health');
            
            if (result.status === 'ok') {
                this.connected = true;
                this.botInfo = result.bot;
                return {
                    success: true,
                    bot: result.bot
                };
            }
            
            return { success: false, error: 'Invalid response' };
        } catch (error) {
            this.connected = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * Get health status
     */
    async getHealth() {
        return this.request('/health');
    }

    /**
     * Get user's rank by user ID
     */
    async getUserRank(userId) {
        return this.request(`/api/rank/${userId}`);
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        return this.request(`/api/user/${encodeURIComponent(username)}`);
    }

    /**
     * Get all roles in the group
     */
    async getRoles() {
        return this.request('/api/roles');
    }

    /**
     * Set a user's rank by user ID
     */
    async setRank(userId, rank) {
        const body = { userId };
        
        if (typeof rank === 'string') {
            body.rankName = rank;
        } else {
            body.rank = rank;
        }
        
        return this.request('/api/rank', 'POST', body);
    }

    /**
     * Set a user's rank by username
     */
    async setRankByUsername(username, rank) {
        const body = { username };
        
        if (typeof rank === 'string') {
            body.rankName = rank;
        } else {
            body.rank = rank;
        }
        
        return this.request('/api/rank/username', 'POST', body);
    }

    /**
     * Promote a user by user ID
     */
    async promote(userId) {
        return this.request('/api/promote', 'POST', { userId });
    }

    /**
     * Promote a user by username
     */
    async promoteByUsername(username) {
        return this.request('/api/promote/username', 'POST', { username });
    }

    /**
     * Demote a user by user ID
     */
    async demote(userId) {
        return this.request('/api/demote', 'POST', { userId });
    }

    /**
     * Demote a user by username
     */
    async demoteByUsername(username) {
        return this.request('/api/demote/username', 'POST', { username });
    }

    /**
     * Bulk rank operation
     */
    async bulkRank(users) {
        return this.request('/api/rank/bulk', 'POST', { users });
    }

    /**
     * Get activity logs (if available)
     */
    async getLogs() {
        try {
            return await this.request('/api/logs');
        } catch {
            // Logs endpoint may not be available
            return { success: false, logs: [] };
        }
    }

    /**
     * Get group statistics (if available)
     */
    async getStats() {
        try {
            return await this.request('/api/stats');
        } catch {
            // Stats endpoint may not be available
            return { success: false };
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get bot info
     */
    getBotInfo() {
        return this.botInfo;
    }

    /**
     * Get last error
     */
    getLastError() {
        return this.lastError;
    }

    /**
     * Set timeout
     */
    setTimeout(ms) {
        this.timeout = ms;
    }

    /**
     * Lookup user (try username first, fall back to ID)
     */
    async lookupUser(identifier) {
        // Check if it's a number (user ID)
        if (/^\d+$/.test(identifier)) {
            return this.getUserRank(parseInt(identifier));
        }
        
        // Otherwise treat as username
        return this.getUserByUsername(identifier);
    }

    /**
     * Smart rank operation (handles both username and ID)
     */
    async smartSetRank(identifier, rank) {
        if (/^\d+$/.test(identifier)) {
            return this.setRank(parseInt(identifier), rank);
        }
        return this.setRankByUsername(identifier, rank);
    }

    /**
     * Smart promote operation
     */
    async smartPromote(identifier) {
        if (/^\d+$/.test(identifier)) {
            return this.promote(parseInt(identifier));
        }
        return this.promoteByUsername(identifier);
    }

    /**
     * Smart demote operation
     */
    async smartDemote(identifier) {
        if (/^\d+$/.test(identifier)) {
            return this.demote(parseInt(identifier));
        }
        return this.demoteByUsername(identifier);
    }
}

module.exports = new ApiService();
