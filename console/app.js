/**
 * RankBot Console Application
 * Main entry point for the console UI
 */

const renderer = require('./ui/renderer');
const input = require('./utils/input');
const config = require('./services/config');
const api = require('./services/api');

// Import screens
const SplashScreen = require('./screens/splash');
const AuthScreen = require('./screens/auth');
const DashboardScreen = require('./screens/dashboard');
const RankScreen = require('./screens/rank');
const PromoteScreen = require('./screens/promote');
const DemoteScreen = require('./screens/demote');
const SearchScreen = require('./screens/search');
const RolesScreen = require('./screens/roles');
const LogsScreen = require('./screens/logs');
const SettingsScreen = require('./screens/settings');
const HelpScreen = require('./screens/help');
const SetupScreen = require('./screens/setup');
const FavoritesScreen = require('./screens/favorites');

class Application {
    constructor() {
        this.screens = {};
        this.currentScreen = null;
        this.screenStack = [];
    }

    /**
     * Initialize the application
     */
    async initialize() {
        // Load configuration
        config.load();

        // Set theme from config
        const savedTheme = config.getTheme();
        if (savedTheme) {
            renderer.setTheme(savedTheme);
        }

        // Initialize input handler
        input.initialize();

        // Initialize screens
        this.screens = {
            splash: new SplashScreen(this),
            auth: new AuthScreen(this),
            dashboard: new DashboardScreen(this),
            rank: new RankScreen(this),
            promote: new PromoteScreen(this),
            demote: new DemoteScreen(this),
            search: new SearchScreen(this),
            roles: new RolesScreen(this),
            logs: new LogsScreen(this),
            settings: new SettingsScreen(this),
            help: new HelpScreen(this),
            setup: new SetupScreen(this),
            favorites: new FavoritesScreen(this)
        };
    }

    /**
     * Start the application
     */
    async start() {
        try {
            await this.initialize();

            // Show splash screen
            await this.screens.splash.show();

            // Wait for any key
            await input.waitForAnyKey();

            // Always show auth screen first (handles both setup and login)
            await this.showScreen('auth');

        } catch (error) {
            this.handleFatalError(error);
        }
    }

    /**
     * Show a screen
     */
    async showScreen(screenName, params = {}) {
        // Hide current screen
        if (this.currentScreen && this.screens[this.currentScreen]) {
            const current = this.screens[this.currentScreen];
            if (current.hide) {
                current.hide();
            }
        }

        // Show new screen
        const screen = this.screens[screenName];
        if (!screen) {
            console.error(`Screen not found: ${screenName}`);
            return;
        }

        this.currentScreen = screenName;

        try {
            await screen.show(params);
        } catch (error) {
            this.handleScreenError(screenName, error);
        }
    }

    /**
     * Go back to previous screen
     */
    async goBack() {
        if (this.screenStack.length > 0) {
            const previousScreen = this.screenStack.pop();
            await this.showScreen(previousScreen);
        } else {
            await this.showScreen('dashboard');
        }
    }

    /**
     * Handle screen errors
     */
    handleScreenError(screenName, error) {
        console.error(`Error in screen ${screenName}:`, error);
        
        // Try to show dashboard as fallback
        if (screenName !== 'dashboard') {
            this.showScreen('dashboard');
        }
    }

    /**
     * Handle fatal errors
     */
    handleFatalError(error) {
        renderer.clear();
        renderer.showCursor();
        
        console.error('\n');
        console.error('='.repeat(60));
        console.error('FATAL ERROR');
        console.error('='.repeat(60));
        console.error('\n');
        console.error(error.message);
        console.error('\n');
        console.error(error.stack);
        console.error('\n');
        console.error('The application will now exit.');
        console.error('\n');
        
        process.exit(1);
    }

    /**
     * Cleanup and exit
     */
    exit() {
        input.cleanup();
        process.exit(0);
    }
}

// Create and start application
const app = new Application();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    app.handleFatalError(error);
});

process.on('unhandledRejection', (reason) => {
    app.handleFatalError(new Error(String(reason)));
});

// Start the application
app.start().catch((error) => {
    app.handleFatalError(error);
});
