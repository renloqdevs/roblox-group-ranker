/**
 * Renderer - Core ANSI rendering engine for the console UI
 * Handles screen drawing, cursor control, and output buffering
 */

const themes = require('./themes');

class Renderer {
    constructor() {
        this.width = process.stdout.columns || 85;
        this.height = process.stdout.rows || 35;
        this.buffer = [];
        this.currentTheme = themes.getTheme('default');
        this.cursorVisible = true;

        // Handle terminal resize
        process.stdout.on('resize', () => {
            this.width = process.stdout.columns || 85;
            this.height = process.stdout.rows || 35;
        });
    }

    /**
     * ANSI escape codes
     */
    static ANSI = {
        // Cursor control
        CLEAR: '\x1b[2J',
        CLEAR_LINE: '\x1b[2K',
        HOME: '\x1b[H',
        HIDE_CURSOR: '\x1b[?25l',
        SHOW_CURSOR: '\x1b[?25h',
        SAVE_CURSOR: '\x1b[s',
        RESTORE_CURSOR: '\x1b[u',

        // Text formatting
        RESET: '\x1b[0m',
        BOLD: '\x1b[1m',
        DIM: '\x1b[2m',
        ITALIC: '\x1b[3m',
        UNDERLINE: '\x1b[4m',
        BLINK: '\x1b[5m',
        REVERSE: '\x1b[7m',

        // Foreground colors
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

        // Background colors
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

    /**
     * Box drawing characters
     */
    static BOX = {
        // Single line
        TOP_LEFT: '\u250c',
        TOP_RIGHT: '\u2510',
        BOTTOM_LEFT: '\u2514',
        BOTTOM_RIGHT: '\u2518',
        HORIZONTAL: '\u2500',
        VERTICAL: '\u2502',
        T_DOWN: '\u252c',
        T_UP: '\u2534',
        T_RIGHT: '\u251c',
        T_LEFT: '\u2524',
        CROSS: '\u253c',

        // Double line
        D_TOP_LEFT: '\u2554',
        D_TOP_RIGHT: '\u2557',
        D_BOTTOM_LEFT: '\u255a',
        D_BOTTOM_RIGHT: '\u255d',
        D_HORIZONTAL: '\u2550',
        D_VERTICAL: '\u2551',
        D_T_DOWN: '\u2566',
        D_T_UP: '\u2569',
        D_T_RIGHT: '\u2560',
        D_T_LEFT: '\u2563',
        D_CROSS: '\u256c',

        // Block elements
        FULL_BLOCK: '\u2588',
        LIGHT_SHADE: '\u2591',
        MEDIUM_SHADE: '\u2592',
        DARK_SHADE: '\u2593',

        // Progress bar
        PROGRESS_FULL: '\u2588',
        PROGRESS_EMPTY: '\u2591'
    };

    /**
     * Set the current theme
     */
    setTheme(themeName) {
        this.currentTheme = themes.getTheme(themeName);
    }

    /**
     * Get color from current theme
     */
    color(name) {
        return this.currentTheme.colors[name] || Renderer.ANSI.RESET;
    }

    /**
     * Move cursor to position
     */
    moveTo(x, y) {
        return `\x1b[${y};${x}H`;
    }

    /**
     * Clear the screen
     */
    clear() {
        process.stdout.write(Renderer.ANSI.CLEAR + Renderer.ANSI.HOME);
    }

    /**
     * Hide the cursor
     */
    hideCursor() {
        process.stdout.write(Renderer.ANSI.HIDE_CURSOR);
        this.cursorVisible = false;
    }

    /**
     * Show the cursor
     */
    showCursor() {
        process.stdout.write(Renderer.ANSI.SHOW_CURSOR);
        this.cursorVisible = true;
    }

    /**
     * Write text at position
     */
    writeAt(x, y, text) {
        process.stdout.write(this.moveTo(x, y) + text);
    }

    /**
     * Write centered text at y position
     */
    writeCentered(y, text, width = this.width) {
        const plainText = this.stripAnsi(text);
        const x = Math.floor((width - plainText.length) / 2) + 1;
        this.writeAt(x, y, text);
    }

    /**
     * Strip ANSI codes from text for length calculation
     */
    stripAnsi(text) {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    /**
     * Pad text to width
     */
    pad(text, width, align = 'left', padChar = ' ') {
        const plainLength = this.stripAnsi(text);
        const padding = width - plainLength.length;
        
        if (padding <= 0) return text.substring(0, width);
        
        if (align === 'center') {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return padChar.repeat(leftPad) + text + padChar.repeat(rightPad);
        } else if (align === 'right') {
            return padChar.repeat(padding) + text;
        } else {
            return text + padChar.repeat(padding);
        }
    }

    /**
     * Truncate text with ellipsis
     */
    truncate(text, maxLength) {
        const plain = this.stripAnsi(text);
        if (plain.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Apply color to text
     */
    colorize(text, colorName) {
        return this.color(colorName) + text + Renderer.ANSI.RESET;
    }

    /**
     * Create a horizontal line
     */
    horizontalLine(width, char = Renderer.BOX.HORIZONTAL) {
        return char.repeat(width);
    }

    /**
     * Create a double horizontal line
     */
    doubleHorizontalLine(width) {
        return Renderer.BOX.D_HORIZONTAL.repeat(width);
    }

    /**
     * Draw a box
     */
    drawBox(x, y, width, height, title = '', double = false) {
        const box = double ? {
            tl: Renderer.BOX.D_TOP_LEFT,
            tr: Renderer.BOX.D_TOP_RIGHT,
            bl: Renderer.BOX.D_BOTTOM_LEFT,
            br: Renderer.BOX.D_BOTTOM_RIGHT,
            h: Renderer.BOX.D_HORIZONTAL,
            v: Renderer.BOX.D_VERTICAL
        } : {
            tl: Renderer.BOX.TOP_LEFT,
            tr: Renderer.BOX.TOP_RIGHT,
            bl: Renderer.BOX.BOTTOM_LEFT,
            br: Renderer.BOX.BOTTOM_RIGHT,
            h: Renderer.BOX.HORIZONTAL,
            v: Renderer.BOX.VERTICAL
        };

        const color = this.color('border');
        const titleColor = this.color('title');

        // Top border
        let top = box.tl + box.h.repeat(width - 2) + box.tr;
        if (title) {
            const titleText = ` ${title} `;
            const titlePos = 2;
            top = box.tl + box.h.repeat(titlePos) + titleColor + titleText + Renderer.ANSI.RESET + color + box.h.repeat(width - 4 - titleText.length) + box.tr;
        }
        this.writeAt(x, y, color + top + Renderer.ANSI.RESET);

        // Sides
        for (let i = 1; i < height - 1; i++) {
            this.writeAt(x, y + i, color + box.v + Renderer.ANSI.RESET);
            this.writeAt(x + width - 1, y + i, color + box.v + Renderer.ANSI.RESET);
        }

        // Bottom border
        this.writeAt(x, y + height - 1, color + box.bl + box.h.repeat(width - 2) + box.br + Renderer.ANSI.RESET);
    }

    /**
     * Draw a filled box
     */
    drawFilledBox(x, y, width, height, title = '', double = true) {
        this.drawBox(x, y, width, height, title, double);
        
        const bgColor = this.color('background');
        for (let i = 1; i < height - 1; i++) {
            this.writeAt(x + 1, y + i, bgColor + ' '.repeat(width - 2) + Renderer.ANSI.RESET);
        }
    }

    /**
     * Draw a progress bar
     */
    drawProgressBar(x, y, width, progress, showPercent = true) {
        const barWidth = showPercent ? width - 6 : width;
        const filled = Math.floor(barWidth * (progress / 100));
        const empty = barWidth - filled;

        const progressColor = this.color('progress');
        const emptyColor = this.color('progressEmpty');
        const textColor = this.color('text');

        let bar = progressColor + Renderer.BOX.PROGRESS_FULL.repeat(filled) + Renderer.ANSI.RESET;
        bar += emptyColor + Renderer.BOX.PROGRESS_EMPTY.repeat(empty) + Renderer.ANSI.RESET;

        if (showPercent) {
            bar += textColor + ` ${Math.floor(progress).toString().padStart(3)}%` + Renderer.ANSI.RESET;
        }

        this.writeAt(x, y, '[' + bar + ']');
    }

    /**
     * Draw a spinner frame
     */
    getSpinnerFrame(frameIndex) {
        const frames = ['/', '-', '\\', '|'];
        return frames[frameIndex % frames.length];
    }

    /**
     * Draw a table
     */
    drawTable(x, y, headers, rows, columnWidths) {
        const borderColor = this.color('border');
        const headerColor = this.color('tableHeader');
        const textColor = this.color('text');
        const altRowColor = this.color('tableAltRow');

        let currentY = y;

        // Calculate total width
        const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + columnWidths.length + 1;

        // Top border
        let topBorder = Renderer.BOX.TOP_LEFT;
        columnWidths.forEach((w, i) => {
            topBorder += Renderer.BOX.HORIZONTAL.repeat(w);
            topBorder += i < columnWidths.length - 1 ? Renderer.BOX.T_DOWN : Renderer.BOX.TOP_RIGHT;
        });
        this.writeAt(x, currentY++, borderColor + topBorder + Renderer.ANSI.RESET);

        // Header row
        let headerRow = Renderer.BOX.VERTICAL;
        headers.forEach((h, i) => {
            headerRow += headerColor + this.pad(h, columnWidths[i], 'center') + Renderer.ANSI.RESET + borderColor + Renderer.BOX.VERTICAL;
        });
        this.writeAt(x, currentY++, borderColor + headerRow + Renderer.ANSI.RESET);

        // Header separator
        let sepBorder = Renderer.BOX.T_RIGHT;
        columnWidths.forEach((w, i) => {
            sepBorder += Renderer.BOX.HORIZONTAL.repeat(w);
            sepBorder += i < columnWidths.length - 1 ? Renderer.BOX.CROSS : Renderer.BOX.T_LEFT;
        });
        this.writeAt(x, currentY++, borderColor + sepBorder + Renderer.ANSI.RESET);

        // Data rows
        rows.forEach((row, rowIndex) => {
            const rowColor = rowIndex % 2 === 1 ? altRowColor : textColor;
            let dataRow = Renderer.BOX.VERTICAL;
            row.forEach((cell, i) => {
                dataRow += rowColor + this.pad(String(cell), columnWidths[i]) + Renderer.ANSI.RESET + borderColor + Renderer.BOX.VERTICAL;
            });
            this.writeAt(x, currentY++, borderColor + dataRow + Renderer.ANSI.RESET);
        });

        // Bottom border
        let bottomBorder = Renderer.BOX.BOTTOM_LEFT;
        columnWidths.forEach((w, i) => {
            bottomBorder += Renderer.BOX.HORIZONTAL.repeat(w);
            bottomBorder += i < columnWidths.length - 1 ? Renderer.BOX.T_UP : Renderer.BOX.BOTTOM_RIGHT;
        });
        this.writeAt(x, currentY++, borderColor + bottomBorder + Renderer.ANSI.RESET);

        return currentY - y;
    }

    /**
     * Draw a menu
     */
    drawMenu(x, y, items, selectedIndex = -1) {
        const normalColor = this.color('menuItem');
        const selectedColor = this.color('menuSelected');
        const keyColor = this.color('menuKey');

        items.forEach((item, i) => {
            const isSelected = i === selectedIndex;
            const color = isSelected ? selectedColor : normalColor;
            
            let text = '';
            if (item.key) {
                text = `${keyColor}[${item.key}]${Renderer.ANSI.RESET} ${color}${item.label}${Renderer.ANSI.RESET}`;
            } else {
                text = `${color}${item.label}${Renderer.ANSI.RESET}`;
            }

            if (isSelected) {
                text = `${selectedColor}> ${this.stripAnsi(text)}${Renderer.ANSI.RESET}`;
            }

            this.writeAt(x, y + i, text);
        });

        return items.length;
    }

    /**
     * Draw a status indicator
     */
    drawStatus(x, y, status, message) {
        const statusColors = {
            'ok': this.color('success'),
            'error': this.color('error'),
            'warning': this.color('warning'),
            'info': this.color('info')
        };

        const statusSymbols = {
            'ok': '[OK]',
            'error': '[!!]',
            'warning': '[??]',
            'info': '[ii]'
        };

        const color = statusColors[status] || this.color('text');
        const symbol = statusSymbols[status] || '[--]';

        this.writeAt(x, y, `${color}${symbol}${Renderer.ANSI.RESET} ${message}`);
    }

    /**
     * Draw an input field
     */
    drawInput(x, y, label, value, width, focused = false) {
        const labelColor = this.color('label');
        const inputColor = focused ? this.color('inputFocused') : this.color('input');
        const borderColor = this.color('border');

        this.writeAt(x, y, `${labelColor}${label}${Renderer.ANSI.RESET}`);
        
        const inputWidth = width - label.length - 1;
        const displayValue = value.length > inputWidth - 2 ? value.slice(-(inputWidth - 2)) : value;
        const padding = ' '.repeat(inputWidth - 2 - displayValue.length);
        
        this.writeAt(x + label.length + 1, y, 
            `${borderColor}[${Renderer.ANSI.RESET}${inputColor}${displayValue}${padding}${Renderer.ANSI.RESET}${borderColor}]${Renderer.ANSI.RESET}`
        );

        if (focused) {
            return { cursorX: x + label.length + 2 + displayValue.length, cursorY: y };
        }
        return null;
    }

    /**
     * Draw a checkbox
     */
    drawCheckbox(x, y, label, checked, focused = false) {
        const checkColor = this.color('checkbox');
        const labelColor = focused ? this.color('menuSelected') : this.color('text');
        const checkMark = checked ? '*' : ' ';

        this.writeAt(x, y, `${checkColor}[${checkMark}]${Renderer.ANSI.RESET} ${labelColor}${label}${Renderer.ANSI.RESET}`);
    }

    /**
     * Draw a radio button
     */
    drawRadio(x, y, label, selected, focused = false) {
        const radioColor = this.color('checkbox');
        const labelColor = focused ? this.color('menuSelected') : this.color('text');
        const marker = selected ? '*' : ' ';

        this.writeAt(x, y, `${radioColor}(${marker})${Renderer.ANSI.RESET} ${labelColor}${label}${Renderer.ANSI.RESET}`);
    }

    /**
     * Flash the screen (for notifications)
     */
    async flash(color = Renderer.ANSI.BG_WHITE, duration = 100) {
        process.stdout.write(color);
        await this.sleep(duration);
        process.stdout.write(Renderer.ANSI.RESET);
        this.clear();
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /**
     * Format duration
     */
    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    }

    /**
     * Get terminal dimensions
     */
    getDimensions() {
        return { width: this.width, height: this.height };
    }
}

module.exports = new Renderer();
