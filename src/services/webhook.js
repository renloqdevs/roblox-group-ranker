/**
 * Webhook Service - Send notifications to external services
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class WebhookService {
    constructor() {
        this.webhookUrl = process.env.WEBHOOK_URL || null;
        this.enabled = false;
        this.queue = [];
        this.processing = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 3;
        this.maxQueueSize = 100;
        
        // Circuit breaker properties
        this.failureCount = 0;
        this.failureThreshold = 5;
        this.circuitOpen = false;
        this.circuitResetTime = 60000; // 1 minute
    }

    /**
     * Validate a URL string
     * @param {string} urlString - URL to validate
     * @returns {boolean} True if valid HTTP/HTTPS URL
     */
    isValidUrl(urlString) {
        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Initialize the webhook service
     */
    initialize() {
        if (process.env.WEBHOOK_URL) {
            if (!this.isValidUrl(process.env.WEBHOOK_URL)) {
                console.error('\x1b[31m[WEBHOOK ERROR]\x1b[0m Invalid WEBHOOK_URL - must be a valid HTTP/HTTPS URL');
                return;
            }
            this.webhookUrl = process.env.WEBHOOK_URL;
            this.enabled = true;
            console.log('\x1b[32m[WEBHOOK]\x1b[0m Webhook notifications enabled');
        }
    }

    /**
     * Check if webhooks are enabled
     */
    isEnabled() {
        return this.enabled && this.webhookUrl;
    }

    /**
     * Send a webhook notification
     */
    async send(payload) {
        if (!this.isEnabled()) return;
        
        // Circuit breaker check
        if (this.circuitOpen) {
            console.log('\x1b[33m[WEBHOOK]\x1b[0m Circuit breaker open - skipping webhook');
            return;
        }

        // Prevent queue from growing unbounded
        if (this.queue.length >= this.maxQueueSize) {
            console.warn('\x1b[33m[WEBHOOK]\x1b[0m Queue full, dropping oldest item');
            this.queue.shift();
        }

        this.queue.push({
            payload,
            retries: 0,
            timestamp: Date.now()
        });

        this.processQueue();
    }

    /**
     * Process the webhook queue with circuit breaker support
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0 || this.circuitOpen) return;

        this.processing = true;

        while (this.queue.length > 0 && !this.circuitOpen) {
            const item = this.queue.shift();
            
            try {
                await this.sendRequest(item.payload);
                this.failureCount = 0; // Reset on success
            } catch (error) {
                console.error('\x1b[31m[WEBHOOK ERROR]\x1b[0m', error.message);
                this.failureCount++;
                
                // Check if we should open the circuit
                if (this.failureCount >= this.failureThreshold) {
                    this.circuitOpen = true;
                    console.warn('\x1b[33m[WEBHOOK]\x1b[0m Circuit breaker opened due to repeated failures');
                    setTimeout(() => {
                        this.circuitOpen = false;
                        this.failureCount = 0;
                        console.log('\x1b[32m[WEBHOOK]\x1b[0m Circuit breaker reset');
                    }, this.circuitResetTime);
                    break;
                }
                
                if (item.retries < this.maxRetries) {
                    item.retries++;
                    this.queue.push(item);
                    await this.sleep(this.retryDelay * item.retries); // Exponential backoff
                }
            }
        }

        this.processing = false;
    }

    /**
     * Send HTTP request to webhook URL
     */
    async sendRequest(payload) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.webhookUrl);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;

            const data = JSON.stringify(payload);

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'User-Agent': 'RankBot/1.0'
                },
                timeout: 10000
            };

            const req = lib.request(options, (res) => {
                // Consume response body to prevent memory leaks
                res.resume();
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Send rank change notification
     */
    async notifyRankChange(data) {
        const payload = this.formatDiscordEmbed({
            title: 'Rank Changed',
            color: 0x3498db, // Blue
            fields: [
                { name: 'User', value: data.username || `ID: ${data.userId}`, inline: true },
                { name: 'Old Rank', value: `${data.oldRankName} (${data.oldRank})`, inline: true },
                { name: 'New Rank', value: `${data.newRankName} (${data.newRank})`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send promotion notification
     */
    async notifyPromotion(data) {
        const payload = this.formatDiscordEmbed({
            title: 'User Promoted',
            color: 0x2ecc71, // Green
            fields: [
                { name: 'User', value: data.username || `ID: ${data.userId}`, inline: true },
                { name: 'From', value: `${data.oldRankName} (${data.oldRank})`, inline: true },
                { name: 'To', value: `${data.newRankName} (${data.newRank})`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send demotion notification
     */
    async notifyDemotion(data) {
        const payload = this.formatDiscordEmbed({
            title: 'User Demoted',
            color: 0xe74c3c, // Red
            fields: [
                { name: 'User', value: data.username || `ID: ${data.userId}`, inline: true },
                { name: 'From', value: `${data.oldRankName} (${data.oldRank})`, inline: true },
                { name: 'To', value: `${data.newRankName} (${data.newRank})`, inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send error notification
     */
    async notifyError(data) {
        const payload = this.formatDiscordEmbed({
            title: 'Ranking Error',
            color: 0xe74c3c, // Red
            fields: [
                { name: 'Action', value: data.action, inline: true },
                { name: 'User', value: data.username || `ID: ${data.userId}`, inline: true },
                { name: 'Error', value: data.error, inline: false }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send session unhealthy alert (cookie expired/invalid)
     */
    async notifySessionUnhealthy(data) {
        const payload = this.formatDiscordEmbed({
            title: '⚠️ SESSION CRITICAL - Cookie Invalid',
            color: 0xff0000, // Bright red
            description: 'The Roblox authentication cookie has expired or been invalidated. **Immediate action required!**',
            fields: [
                { name: 'Status', value: 'UNHEALTHY', inline: true },
                { name: 'Bot User', value: data.botUser?.username || 'Unknown', inline: true },
                { name: 'Reason', value: data.reason || 'Cookie validation failed', inline: false },
                { name: 'Action Required', value: '1. Get a fresh .ROBLOSECURITY cookie\n2. Update the ROBLOX_COOKIE environment variable\n3. Restart the bot', inline: false }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send session recovered notification
     */
    async notifySessionRecovered(data) {
        const payload = this.formatDiscordEmbed({
            title: '✅ Session Recovered',
            color: 0x2ecc71, // Green
            description: 'The Roblox session has been restored and is now healthy.',
            fields: [
                { name: 'Status', value: 'HEALTHY', inline: true },
                { name: 'Bot User', value: data.user?.UserName || 'Unknown', inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send server startup notification
     */
    async notifyServerStartup(data) {
        const payload = this.formatDiscordEmbed({
            title: '🚀 Ranking Bot Online',
            color: 0x3498db, // Blue
            description: 'The ranking bot has started successfully.',
            fields: [
                { name: 'Bot Account', value: data.botUser?.UserName || 'Unknown', inline: true },
                { name: 'Bot Rank', value: String(data.botRank || 0), inline: true },
                { name: 'Assignable Roles', value: String(data.assignableRoles || 0), inline: true },
                { name: 'Version', value: data.version || '1.2.0', inline: true }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Send server shutdown notification
     */
    async notifyServerShutdown(reason) {
        const payload = this.formatDiscordEmbed({
            title: '⏹️ Ranking Bot Offline',
            color: 0x95a5a6, // Gray
            description: 'The ranking bot is shutting down.',
            fields: [
                { name: 'Reason', value: reason || 'Manual shutdown', inline: false }
            ],
            timestamp: new Date().toISOString()
        });

        await this.send(payload);
    }

    /**
     * Format payload as Discord embed
     */
    formatDiscordEmbed(embed) {
        const embedObj = {
            title: embed.title,
            color: embed.color,
            fields: embed.fields,
            timestamp: embed.timestamp,
            footer: {
                text: 'RankBot'
            }
        };

        // Add description if provided
        if (embed.description) {
            embedObj.description = embed.description;
        }

        return { embeds: [embedObj] };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new WebhookService();
