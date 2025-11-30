/**
 * Splash Screen - Startup animation and loading
 */

const renderer = require('../ui/renderer');
const animations = require('../ui/animations');
const components = require('../ui/components');
const api = require('../services/api');
const config = require('../services/config');

class SplashScreen {
    constructor(app) {
        this.app = app;
    }

    /**
     * Show the splash screen with animations
     */
    async show() {
        const { width, height } = renderer.getDimensions();
        
        renderer.clear();
        renderer.hideCursor();

        // Draw outer border
        const borderColor = renderer.color('border');
        renderer.drawBox(1, 1, width, height, '', true);

        // Center position for logo
        const logoLines = [
            '██████╗  █████╗ ███╗   ██╗██╗  ██╗██████╗  ██████╗ ████████╗',
            '██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝',
            '██████╔╝███████║██╔██╗ ██║█████╔╝ ██████╔╝██║   ██║   ██║   ',
            '██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ██╔══██╗██║   ██║   ██║   ',
            '██║  ██║██║  ██║██║ ╚████║██║  ██╗██████╔╝╚██████╔╝   ██║   ',
            '╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝   '
        ];

        const logoWidth = logoLines[0].length;
        const logoX = Math.floor((width - logoWidth) / 2);
        const logoY = Math.floor((height - 20) / 2);

        // Animate logo appearance
        const logoColor = renderer.color('logo');
        for (let i = 0; i < logoLines.length; i++) {
            await animations.sleep(80);
            renderer.writeAt(logoX, logoY + i, logoColor + logoLines[i] + renderer.constructor.ANSI.RESET);
        }

        // Title and version
        const titleColor = renderer.color('title');
        const textColor = renderer.color('textDim');
        
        await animations.sleep(200);
        renderer.writeCentered(logoY + 8, titleColor + 'Roblox Group Ranking Bot' + renderer.constructor.ANSI.RESET, width);
        
        await animations.sleep(100);
        renderer.writeCentered(logoY + 9, textColor + 'Version 1.0.9' + renderer.constructor.ANSI.RESET, width);

        // Progress bar position
        const progressY = logoY + 12;
        const progressWidth = 50;
        const progressX = Math.floor((width - progressWidth) / 2);

        // Loading stages
        const stages = [
            { progress: 20, message: 'Loading configuration...' },
            { progress: 40, message: 'Initializing services...' },
            { progress: 60, message: 'Connecting to API...' },
            { progress: 80, message: 'Fetching bot information...' },
            { progress: 100, message: 'Ready!' }
        ];

        let currentProgress = 0;

        for (const stage of stages) {
            // Show message
            renderer.writeCentered(progressY + 2, textColor + renderer.pad(stage.message, 40, 'center') + renderer.constructor.ANSI.RESET, width);
            
            // Animate progress
            await animations.smoothProgress(progressX, progressY, progressWidth, currentProgress, stage.progress, 300);
            currentProgress = stage.progress;

            // Actually perform the stage action
            if (stage.progress === 20) {
                config.load();
            } else if (stage.progress === 40) {
                api.initialize();
            } else if (stage.progress === 60) {
                if (config.isConfigured()) {
                    const result = await api.testConnection();
                    if (!result.success) {
                        // Connection failed - will handle in dashboard
                        renderer.writeCentered(progressY + 3, renderer.color('warning') + 'API connection failed - check settings' + renderer.constructor.ANSI.RESET, width);
                        await animations.sleep(1000);
                    }
                }
            } else if (stage.progress === 80) {
                // Cache roles if connected
                if (api.isConnected()) {
                    try {
                        const roles = await api.getRoles();
                        if (roles.success) {
                            config.cacheRoles(roles.roles);
                        }
                    } catch (e) {
                        // Ignore role fetch errors
                    }
                }
            }
        }

        // Final animation
        await animations.sleep(300);
        
        const successColor = renderer.color('success');
        renderer.writeCentered(progressY + 2, successColor + renderer.pad('Initialization complete!', 40, 'center') + renderer.constructor.ANSI.RESET, width);
        
        // Press any key prompt
        await animations.sleep(500);
        renderer.writeCentered(progressY + 5, textColor + 'Press any key to continue...' + renderer.constructor.ANSI.RESET, width);

        return true;
    }

    /**
     * Quick splash (no animations)
     */
    async showQuick() {
        const { width, height } = renderer.getDimensions();
        
        renderer.clear();
        renderer.hideCursor();

        // Simple loading message
        renderer.drawBox(1, 1, width, height, '', true);
        
        const centerY = Math.floor(height / 2);
        renderer.writeCentered(centerY, renderer.color('title') + 'RANKBOT CONSOLE' + renderer.constructor.ANSI.RESET, width);
        renderer.writeCentered(centerY + 2, renderer.color('textDim') + 'Loading...' + renderer.constructor.ANSI.RESET, width);

        // Load config and test connection
        config.load();
        api.initialize();
        
        if (config.isConfigured()) {
            await api.testConnection();
        }

        return true;
    }
}

module.exports = SplashScreen;
