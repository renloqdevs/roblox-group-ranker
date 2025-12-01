/**
 * PM2 Ecosystem Configuration
 * 
 * Production deployment configuration for the Roblox Ranking Bot
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --env development
 * 
 * Management:
 *   pm2 status                    - Check status
 *   pm2 logs rankbot-api         - View logs
 *   pm2 restart rankbot-api      - Restart
 *   pm2 reload rankbot-api       - Zero-downtime reload
 *   pm2 monit                    - Real-time monitoring
 * 
 * Cluster mode (scale horizontally):
 *   pm2 scale rankbot-api 4      - Scale to 4 instances
 */

module.exports = {
    apps: [
        {
            // Application name for PM2
            name: 'rankbot-api',
            
            // Entry point
            script: 'src/index.js',
            
            // Working directory
            cwd: './',
            
            // Cluster mode - fork for single instance, cluster for multi-core
            // Note: Use 'fork' mode since we have WebSocket/stateful operations
            exec_mode: 'fork',
            
            // Number of instances (only for cluster mode)
            // instances: 'max', // Use all CPU cores
            instances: 1,
            
            // Restart behavior
            autorestart: true,
            watch: false, // Disable in production
            max_memory_restart: '500M', // Restart if memory exceeds 500MB
            
            // Restart delays and limits
            min_uptime: '10s', // Minimum uptime to be considered started
            max_restarts: 10, // Max restarts within restart_delay window
            restart_delay: 4000, // Delay between restarts (4 seconds)
            
            // Exponential backoff restart delay
            exp_backoff_restart_delay: 100, // Initial delay, doubles each restart
            
            // Log configuration
            log_file: './logs/combined.log',
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true, // Merge logs from all instances
            
            // Log rotation (requires pm2-logrotate module)
            // pm2 install pm2-logrotate
            // pm2 set pm2-logrotate:max_size 10M
            // pm2 set pm2-logrotate:retain 7
            
            // Environment variables (default/development)
            env: {
                NODE_ENV: 'development',
                PORT: 3000,
                LOG_LEVEL: 'debug',
                LOG_TIMESTAMPS: 'true',
                SESSION_HEALTH_INTERVAL: 60000 // 1 minute
            },
            
            // Production environment
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
                LOG_LEVEL: 'info',
                LOG_TIMESTAMPS: 'true',
                SESSION_HEALTH_INTERVAL: 30000, // 30 seconds - more frequent in production
                ENABLE_HSTS: 'true'
            },
            
            // Staging environment
            env_staging: {
                NODE_ENV: 'staging',
                PORT: 3001,
                LOG_LEVEL: 'debug',
                LOG_TIMESTAMPS: 'true',
                SESSION_HEALTH_INTERVAL: 60000
            },
            
            // Graceful shutdown
            kill_timeout: 10000, // 10 seconds to gracefully shutdown
            wait_ready: true, // Wait for process.send('ready')
            listen_timeout: 10000, // Time to wait for app to listen
            
            // Source map support for better error traces
            source_map_support: true,
            
            // Node.js arguments
            node_args: [
                '--max-old-space-size=512' // Limit memory to 512MB
            ],
            
            // Post-update hooks (for pm2 deploy)
            post_update: [
                'npm install',
                'pm2 reload ecosystem.config.js --env production'
            ]
        },
        
        // Optional: Console UI (if you want to run it separately)
        {
            name: 'rankbot-console',
            script: 'console/app.js',
            cwd: './',
            exec_mode: 'fork',
            instances: 1,
            autorestart: false, // Console is interactive, don't auto-restart
            watch: false,
            
            env: {
                NODE_ENV: 'development'
            },
            
            // Only start manually
            // pm2 start ecosystem.config.js --only rankbot-console
        }
    ],
    
    // Deployment configuration (optional)
    // Use: pm2 deploy ecosystem.config.js production setup
    //      pm2 deploy ecosystem.config.js production
    deploy: {
        production: {
            // SSH user
            user: 'deploy',
            
            // Remote host
            host: ['your-server.com'],
            
            // SSH options
            ssh_options: 'StrictHostKeyChecking=no',
            
            // Git repository
            ref: 'origin/main',
            repo: 'git@github.com:renloqdevs/roblox-group-ranker.git',
            
            // Deployment path on remote server
            path: '/var/www/rankbot',
            
            // Commands to run after deployment
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            
            // Environment variables for deployment
            env: {
                NODE_ENV: 'production'
            }
        },
        
        staging: {
            user: 'deploy',
            host: ['staging-server.com'],
            ref: 'origin/develop',
            repo: 'git@github.com:renloqdevs/roblox-group-ranker.git',
            path: '/var/www/rankbot-staging',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
            env: {
                NODE_ENV: 'staging'
            }
        }
    }
};
