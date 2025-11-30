/**
 * Themes - Color schemes for the console UI
 */

const ANSI = {
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m',
    
    FG_BLACK: '\x1b[30m',
    FG_RED: '\x1b[31m',
    FG_GREEN: '\x1b[32m',
    FG_YELLOW: '\x1b[33m',
    FG_BLUE: '\x1b[34m',
    FG_MAGENTA: '\x1b[35m',
    FG_CYAN: '\x1b[36m',
    FG_WHITE: '\x1b[37m',
    FG_GRAY: '\x1b[90m',
    FG_BRIGHT_RED: '\x1b[91m',
    FG_BRIGHT_GREEN: '\x1b[92m',
    FG_BRIGHT_YELLOW: '\x1b[93m',
    FG_BRIGHT_BLUE: '\x1b[94m',
    FG_BRIGHT_MAGENTA: '\x1b[95m',
    FG_BRIGHT_CYAN: '\x1b[96m',
    FG_BRIGHT_WHITE: '\x1b[97m',

    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m',
    BG_GRAY: '\x1b[100m'
};

const themes = {
    default: {
        name: 'Default',
        colors: {
            // Main colors
            primary: ANSI.FG_CYAN,
            secondary: ANSI.FG_BLUE,
            accent: ANSI.FG_MAGENTA,
            
            // Text colors
            text: ANSI.FG_WHITE,
            textDim: ANSI.FG_GRAY,
            textBright: ANSI.FG_BRIGHT_WHITE,
            
            // Status colors
            success: ANSI.FG_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_YELLOW,
            info: ANSI.FG_CYAN,
            
            // UI elements
            border: ANSI.FG_CYAN,
            title: ANSI.BOLD + ANSI.FG_BRIGHT_CYAN,
            subtitle: ANSI.FG_CYAN,
            background: '',
            
            // Menu
            menuItem: ANSI.FG_WHITE,
            menuSelected: ANSI.BOLD + ANSI.FG_BRIGHT_CYAN,
            menuKey: ANSI.FG_YELLOW,
            
            // Table
            tableHeader: ANSI.BOLD + ANSI.FG_CYAN,
            tableAltRow: ANSI.FG_GRAY,
            
            // Input
            input: ANSI.FG_WHITE,
            inputFocused: ANSI.FG_BRIGHT_WHITE,
            label: ANSI.FG_CYAN,
            
            // Progress
            progress: ANSI.FG_GREEN,
            progressEmpty: ANSI.FG_GRAY,
            
            // Other
            spinner: ANSI.FG_CYAN,
            checkbox: ANSI.FG_YELLOW,
            
            // Logo
            logo: ANSI.FG_CYAN,
            logoAccent: ANSI.FG_BRIGHT_CYAN
        }
    },

    dark: {
        name: 'Dark',
        colors: {
            primary: ANSI.FG_BLUE,
            secondary: ANSI.FG_MAGENTA,
            accent: ANSI.FG_CYAN,
            
            text: ANSI.FG_GRAY,
            textDim: ANSI.DIM + ANSI.FG_GRAY,
            textBright: ANSI.FG_WHITE,
            
            success: ANSI.FG_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_YELLOW,
            info: ANSI.FG_BLUE,
            
            border: ANSI.FG_GRAY,
            title: ANSI.BOLD + ANSI.FG_WHITE,
            subtitle: ANSI.FG_GRAY,
            background: '',
            
            menuItem: ANSI.FG_GRAY,
            menuSelected: ANSI.BOLD + ANSI.FG_WHITE,
            menuKey: ANSI.FG_BLUE,
            
            tableHeader: ANSI.BOLD + ANSI.FG_WHITE,
            tableAltRow: ANSI.DIM + ANSI.FG_GRAY,
            
            input: ANSI.FG_GRAY,
            inputFocused: ANSI.FG_WHITE,
            label: ANSI.FG_BLUE,
            
            progress: ANSI.FG_BLUE,
            progressEmpty: ANSI.DIM + ANSI.FG_GRAY,
            
            spinner: ANSI.FG_BLUE,
            checkbox: ANSI.FG_BLUE,
            
            logo: ANSI.FG_BLUE,
            logoAccent: ANSI.FG_BRIGHT_BLUE
        }
    },

    light: {
        name: 'Light',
        colors: {
            primary: ANSI.FG_BLUE,
            secondary: ANSI.FG_MAGENTA,
            accent: ANSI.FG_CYAN,
            
            text: ANSI.FG_BLACK,
            textDim: ANSI.FG_GRAY,
            textBright: ANSI.BOLD + ANSI.FG_BLACK,
            
            success: ANSI.FG_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_YELLOW,
            info: ANSI.FG_BLUE,
            
            border: ANSI.FG_BLUE,
            title: ANSI.BOLD + ANSI.FG_BLUE,
            subtitle: ANSI.FG_BLUE,
            background: '',
            
            menuItem: ANSI.FG_BLACK,
            menuSelected: ANSI.BOLD + ANSI.FG_BLUE,
            menuKey: ANSI.FG_MAGENTA,
            
            tableHeader: ANSI.BOLD + ANSI.FG_BLUE,
            tableAltRow: ANSI.FG_GRAY,
            
            input: ANSI.FG_BLACK,
            inputFocused: ANSI.BOLD + ANSI.FG_BLACK,
            label: ANSI.FG_BLUE,
            
            progress: ANSI.FG_BLUE,
            progressEmpty: ANSI.FG_GRAY,
            
            spinner: ANSI.FG_BLUE,
            checkbox: ANSI.FG_MAGENTA,
            
            logo: ANSI.FG_BLUE,
            logoAccent: ANSI.FG_BRIGHT_BLUE
        }
    },

    hacker: {
        name: 'Hacker',
        colors: {
            primary: ANSI.FG_GREEN,
            secondary: ANSI.FG_BRIGHT_GREEN,
            accent: ANSI.FG_GREEN,
            
            text: ANSI.FG_GREEN,
            textDim: ANSI.DIM + ANSI.FG_GREEN,
            textBright: ANSI.BOLD + ANSI.FG_BRIGHT_GREEN,
            
            success: ANSI.FG_BRIGHT_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_YELLOW,
            info: ANSI.FG_GREEN,
            
            border: ANSI.FG_GREEN,
            title: ANSI.BOLD + ANSI.FG_BRIGHT_GREEN,
            subtitle: ANSI.FG_GREEN,
            background: '',
            
            menuItem: ANSI.FG_GREEN,
            menuSelected: ANSI.BOLD + ANSI.FG_BRIGHT_GREEN,
            menuKey: ANSI.FG_BRIGHT_GREEN,
            
            tableHeader: ANSI.BOLD + ANSI.FG_BRIGHT_GREEN,
            tableAltRow: ANSI.DIM + ANSI.FG_GREEN,
            
            input: ANSI.FG_GREEN,
            inputFocused: ANSI.FG_BRIGHT_GREEN,
            label: ANSI.FG_GREEN,
            
            progress: ANSI.FG_BRIGHT_GREEN,
            progressEmpty: ANSI.DIM + ANSI.FG_GREEN,
            
            spinner: ANSI.FG_GREEN,
            checkbox: ANSI.FG_BRIGHT_GREEN,
            
            logo: ANSI.FG_GREEN,
            logoAccent: ANSI.FG_BRIGHT_GREEN
        }
    },

    ocean: {
        name: 'Ocean',
        colors: {
            primary: ANSI.FG_CYAN,
            secondary: ANSI.FG_BLUE,
            accent: ANSI.FG_BRIGHT_CYAN,
            
            text: ANSI.FG_BRIGHT_CYAN,
            textDim: ANSI.FG_CYAN,
            textBright: ANSI.BOLD + ANSI.FG_BRIGHT_WHITE,
            
            success: ANSI.FG_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_YELLOW,
            info: ANSI.FG_CYAN,
            
            border: ANSI.FG_BLUE,
            title: ANSI.BOLD + ANSI.FG_BRIGHT_CYAN,
            subtitle: ANSI.FG_CYAN,
            background: '',
            
            menuItem: ANSI.FG_CYAN,
            menuSelected: ANSI.BOLD + ANSI.FG_BRIGHT_WHITE,
            menuKey: ANSI.FG_BRIGHT_CYAN,
            
            tableHeader: ANSI.BOLD + ANSI.FG_BRIGHT_CYAN,
            tableAltRow: ANSI.FG_BLUE,
            
            input: ANSI.FG_CYAN,
            inputFocused: ANSI.FG_BRIGHT_WHITE,
            label: ANSI.FG_BRIGHT_CYAN,
            
            progress: ANSI.FG_CYAN,
            progressEmpty: ANSI.FG_BLUE,
            
            spinner: ANSI.FG_CYAN,
            checkbox: ANSI.FG_BRIGHT_CYAN,
            
            logo: ANSI.FG_CYAN,
            logoAccent: ANSI.FG_BRIGHT_CYAN
        }
    },

    sunset: {
        name: 'Sunset',
        colors: {
            primary: ANSI.FG_YELLOW,
            secondary: ANSI.FG_RED,
            accent: ANSI.FG_MAGENTA,
            
            text: ANSI.FG_BRIGHT_YELLOW,
            textDim: ANSI.FG_YELLOW,
            textBright: ANSI.BOLD + ANSI.FG_BRIGHT_WHITE,
            
            success: ANSI.FG_GREEN,
            error: ANSI.FG_RED,
            warning: ANSI.FG_BRIGHT_YELLOW,
            info: ANSI.FG_YELLOW,
            
            border: ANSI.FG_RED,
            title: ANSI.BOLD + ANSI.FG_BRIGHT_YELLOW,
            subtitle: ANSI.FG_YELLOW,
            background: '',
            
            menuItem: ANSI.FG_YELLOW,
            menuSelected: ANSI.BOLD + ANSI.FG_BRIGHT_WHITE,
            menuKey: ANSI.FG_RED,
            
            tableHeader: ANSI.BOLD + ANSI.FG_BRIGHT_YELLOW,
            tableAltRow: ANSI.FG_RED,
            
            input: ANSI.FG_YELLOW,
            inputFocused: ANSI.FG_BRIGHT_WHITE,
            label: ANSI.FG_BRIGHT_YELLOW,
            
            progress: ANSI.FG_YELLOW,
            progressEmpty: ANSI.FG_RED,
            
            spinner: ANSI.FG_YELLOW,
            checkbox: ANSI.FG_RED,
            
            logo: ANSI.FG_YELLOW,
            logoAccent: ANSI.FG_BRIGHT_YELLOW
        }
    }
};

/**
 * Get a theme by name
 */
function getTheme(name) {
    return themes[name] || themes.default;
}

/**
 * Get all available theme names
 */
function getThemeNames() {
    return Object.keys(themes);
}

/**
 * Get all themes with their display names
 */
function getAllThemes() {
    return Object.entries(themes).map(([key, theme]) => ({
        id: key,
        name: theme.name
    }));
}

module.exports = {
    themes,
    getTheme,
    getThemeNames,
    getAllThemes,
    ANSI
};
