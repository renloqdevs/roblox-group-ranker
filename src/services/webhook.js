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
    }

    /**
     * Initialize the webhook service
     */
    initialize() {
        if (process.env.WEBHOOK_URL) {
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

        this.queue.push({
            payload,
            retries: 0,
            timestamp: Date.now()
        });

        this.processQueue();
    }

    /**
     * Process the webhook queue
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            try {
                await this.sendRequest(item.payload);
            } catch (error) {
                console.error('\x1b[31m[WEBHOOK ERROR]\x1b[0m', error.message);
                
                if (item.retries < this.maxRetries) {
                    item.retries++;
                    this.queue.push(item);
                    await this.sleep(this.retryDelay);
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
     * Format payload as Discord embed
     */
    formatDiscordEmbed(embed) {
        return {
            embeds: [{
                title: embed.title,
                color: embed.color,
                fields: embed.fields,
                timestamp: embed.timestamp,
                footer: {
                    text: 'RankBot'
                }
            }]
        };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new WebhookService();
