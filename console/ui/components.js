/**
 * Components - Reusable UI components for screens
 */

const renderer = require('./renderer');
const animations = require('./animations');

class Components {
    /**
     * Draw the application header
     */
    drawHeader(title, subtitle = '', rightText = '') {
        const { width } = renderer.getDimensions();
        const borderColor = renderer.color('border');
        const titleColor = renderer.color('title');
        const subtitleColor = renderer.color('subtitle');
        const textColor = renderer.color('textDim');

        // Top border
        renderer.writeAt(1, 1, borderColor + renderer.constructor.BOX.D_TOP_LEFT + renderer.constructor.BOX.D_HORIZONTAL.repeat(width - 2) + renderer.constructor.BOX.D_TOP_RIGHT + renderer.constructor.ANSI.RESET);

        // Title row
        let titleRow = borderColor + renderer.constructor.BOX.D_VERTICAL + renderer.constructor.ANSI.RESET;
        titleRow += '  ' + titleColor + title + renderer.constructor.ANSI.RESET;
        
        if (rightText) {
            const padding = width - 4 - renderer.stripAnsi(title).length - renderer.stripAnsi(rightText).length;
            titleRow += ' '.repeat(Math.max(1, padding));
            titleRow += textColor + rightText + renderer.constructor.ANSI.RESET;
        } else {
            titleRow += ' '.repeat(width - 4 - renderer.stripAnsi(title).length);
        }
        titleRow += borderColor + renderer.constructor.BOX.D_VERTICAL + renderer.constructor.ANSI.RESET;
        renderer.writeAt(1, 2, titleRow);

        // Bottom border
        renderer.writeAt(1, 3, borderColor + renderer.constructor.BOX.D_T_RIGHT + renderer.constructor.BOX.D_HORIZONTAL.repeat(width - 2) + renderer.constructor.BOX.D_T_LEFT + renderer.constructor.ANSI.RESET);

        return 3; // Returns height of header
    }

    /**
     * Draw the main application frame
     */
    drawFrame(title = 'RANKBOT CONSOLE', version = 'v1.0.9') {
        const { width, height } = renderer.getDimensions();
        
        renderer.clear();
        renderer.hideCursor();

        // Draw outer border
        renderer.drawBox(1, 1, width, height, '', true);

        // Draw header
        this.drawHeader(title, '', version);

        return { contentY: 4, contentHeight: height - 5 };
    }

    /**
     * Draw a section with title
     */
    drawSection(x, y, width, height, title = '') {
        const borderColor = renderer.color('border');
        const titleColor = renderer.color('subtitle');

        // Top border with optional title
        let topLine = renderer.constructor.BOX.TOP_LEFT;
        if (title) {
            topLine += renderer.constructor.BOX.HORIZONTAL.repeat(2);
            topLine += renderer.constructor.ANSI.RESET + titleColor + ' ' + title + ' ' + renderer.constructor.ANSI.RESET + borderColor;
            topLine += renderer.constructor.BOX.HORIZONTAL.repeat(width - 6 - title.length);
        } else {
            topLine += renderer.constructor.BOX.HORIZONTAL.repeat(width - 2);
        }
        topLine += renderer.constructor.BOX.TOP_RIGHT;
        renderer.writeAt(x, y, borderColor + topLine + renderer.constructor.ANSI.RESET);

        // Sides
        for (let i = 1; i < height - 1; i++) {
            renderer.writeAt(x, y + i, borderColor + renderer.constructor.BOX.VERTICAL + renderer.constructor.ANSI.RESET);
            renderer.writeAt(x + width - 1, y + i, borderColor + renderer.constructor.BOX.VERTICAL + renderer.constructor.ANSI.RESET);
        }

        // Bottom border
        renderer.writeAt(x, y + height - 1, borderColor + renderer.constructor.BOX.BOTTOM_LEFT + renderer.constructor.BOX.HORIZONTAL.repeat(width - 2) + renderer.constructor.BOX.BOTTOM_RIGHT + renderer.constructor.ANSI.RESET);

        return { innerX: x + 2, innerY: y + 1, innerWidth: width - 4, innerHeight: height - 2 };
    }

    /**
     * Draw a horizontal separator line
     */
    drawSeparator(x, y, width) {
        const color = renderer.color('border');
        renderer.writeAt(x, y, color + renderer.constructor.BOX.HORIZONTAL.repeat(width) + renderer.constructor.ANSI.RESET);
    }

    /**
     * Draw status bar at bottom
     */
    drawStatusBar(message, type = 'info') {
        const { width, height } = renderer.getDimensions();
        const colors = {
            info: renderer.color('info'),
            success: renderer.color('success'),
            error: renderer.color('error'),
            warning: renderer.color('warning')
        };

        const color = colors[type] || colors.info;
        const paddedMessage = renderer.pad(message, width - 4);
        
        renderer.writeAt(3, height - 1, color + paddedMessage + renderer.constructor.ANSI.RESET);
    }

    /**
     * Draw key hints at bottom
     */
    drawKeyHints(hints) {
        const { width, height } = renderer.getDimensions();
        const keyColor = renderer.color('menuKey');
        const textColor = renderer.color('textDim');

        let hintsText = hints.map(h => `${keyColor}[${h.key}]${renderer.constructor.ANSI.RESET}${textColor} ${h.action}${renderer.constructor.ANSI.RESET}`).join('  ');
        
        renderer.writeAt(3, height - 1, hintsText);
    }

    /**
     * Draw a confirmation dialog
     * @param {string} message - Primary message
     * @param {string} subMessage - Optional secondary message (for two-line dialogs)
     */
    drawConfirmDialog(message, subMessage = null) {
        const { width, height } = renderer.getDimensions();
        const dialogWidth = 55;
        const dialogHeight = subMessage ? 9 : 7;
        const x = Math.floor((width - dialogWidth) / 2);
        const y = Math.floor((height - dialogHeight) / 2);

        // Draw dialog box
        renderer.drawFilledBox(x, y, dialogWidth, dialogHeight, 'Confirm');

        // Message
        const textColor = renderer.color('text');
        const dimColor = renderer.color('textDim');
        renderer.writeAt(x + 3, y + 2, textColor + message + renderer.constructor.ANSI.RESET);

        // Sub-message if provided
        if (subMessage) {
            renderer.writeAt(x + 3, y + 3, dimColor + subMessage + renderer.constructor.ANSI.RESET);
        }

        // Buttons
        const keyColor = renderer.color('menuKey');
        const buttonY = subMessage ? y + 6 : y + 4;
        renderer.writeAt(x + 3, buttonY, `${keyColor}[Y]${renderer.constructor.ANSI.RESET} Yes     ${keyColor}[N]${renderer.constructor.ANSI.RESET} No`);
    }

    /**
     * Draw an alert dialog
     */
    drawAlert(title, message, type = 'info') {
        const { width, height } = renderer.getDimensions();
        const dialogWidth = Math.min(60, width - 10);
        const dialogHeight = 6;
        const x = Math.floor((width - dialogWidth) / 2);
        const y = Math.floor((height - dialogHeight) / 2);

        const colors = {
            info: renderer.color('info'),
            success: renderer.color('success'),
            error: renderer.color('error'),
            warning: renderer.color('warning')
        };

        // Draw dialog box
        renderer.drawFilledBox(x, y, dialogWidth, dialogHeight, title);

        // Message
        const color = colors[type] || colors.info;
        renderer.writeAt(x + 3, y + 2, color + message + renderer.constructor.ANSI.RESET);

        // Dismiss hint
        const textColor = renderer.color('textDim');
        renderer.writeAt(x + 3, y + 4, textColor + 'Press any key to continue...' + renderer.constructor.ANSI.RESET);
    }

    /**
     * Draw a user info card
     */
    drawUserCard(x, y, user) {
        const { innerX, innerY, innerWidth } = this.drawSection(x, y, 50, 8, 'User Information');

        const labelColor = renderer.color('label');
        const textColor = renderer.color('text');
        const successColor = renderer.color('success');
        const errorColor = renderer.color('error');

        const lines = [
            { label: 'Username:', value: user.username || 'Unknown' },
            { label: 'User ID:', value: String(user.userId || 'N/A') },
            { label: 'Current Rank:', value: `${user.rankName || 'None'} (${user.rank || 0})` },
            { label: 'In Group:', value: user.inGroup ? 'Yes' : 'No', color: user.inGroup ? successColor : errorColor }
        ];

        lines.forEach((line, i) => {
            const valueColor = line.color || textColor;
            renderer.writeAt(innerX, innerY + i, `${labelColor}${renderer.pad(line.label, 14)}${renderer.constructor.ANSI.RESET} ${valueColor}${line.value}${renderer.constructor.ANSI.RESET}`);
        });

        return 8;
    }

    /**
     * Draw a stat box
     */
    drawStatBox(x, y, label, value, width = 20) {
        const borderColor = renderer.color('border');
        const labelColor = renderer.color('textDim');
        const valueColor = renderer.color('textBright');

        renderer.drawBox(x, y, width, 4);
        renderer.writeCentered(y + 1, labelColor + label + renderer.constructor.ANSI.RESET, width);
        renderer.writeAt(x + 1, y + 1, labelColor + renderer.pad(label, width - 2, 'center') + renderer.constructor.ANSI.RESET);
        renderer.writeAt(x + 1, y + 2, valueColor + renderer.pad(String(value), width - 2, 'center') + renderer.constructor.ANSI.RESET);

        return 4;
    }

    /**
     * Draw a selection list
     */
    drawSelectionList(x, y, items, selectedIndex, maxVisible = 10) {
        const normalColor = renderer.color('menuItem');
        const selectedColor = renderer.color('menuSelected');
        const dimColor = renderer.color('textDim');

        // Calculate scroll offset
        const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
        const endIndex = Math.min(items.length, startIndex + maxVisible);
        const visibleItems = items.slice(startIndex, endIndex);

        // Draw scroll indicator if needed
        if (startIndex > 0) {
            renderer.writeAt(x, y, dimColor + '  ... more above ...' + renderer.constructor.ANSI.RESET);
            y++;
        }

        visibleItems.forEach((item, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex;
            const color = isSelected ? selectedColor : normalColor;
            const prefix = isSelected ? '> ' : '  ';
            const marker = item.current ? ' <- Current' : '';
            
            renderer.writeAt(x, y + i, `${color}${prefix}${item.label}${marker}${renderer.constructor.ANSI.RESET}`);
        });

        if (endIndex < items.length) {
            renderer.writeAt(x, y + visibleItems.length, dimColor + '  ... more below ...' + renderer.constructor.ANSI.RESET);
        }

        return visibleItems.length + (startIndex > 0 ? 1 : 0) + (endIndex < items.length ? 1 : 0);
    }

    /**
     * Draw activity log entries
     */
    drawLogEntries(x, y, logs, maxVisible = 5) {
        const timeColor = renderer.color('textDim');
        const actionColors = {
            'PROMOTE': renderer.color('success'),
            'DEMOTE': renderer.color('warning'),
            'RANK': renderer.color('info'),
            'ERROR': renderer.color('error')
        };

        logs.slice(0, maxVisible).forEach((log, i) => {
            const actionColor = actionColors[log.action] || renderer.color('text');
            const time = new Date(log.timestamp).toLocaleTimeString();
            
            renderer.writeAt(x, y + i, 
                `${timeColor}${time}${renderer.constructor.ANSI.RESET}  ` +
                `${actionColor}${renderer.pad(log.action, 8)}${renderer.constructor.ANSI.RESET}  ` +
                `${log.message}`
            );
        });

        return Math.min(logs.length, maxVisible);
    }

    /**
     * Draw loading overlay
     */
    async showLoading(message = 'Loading...') {
        const { width, height } = renderer.getDimensions();
        const boxWidth = 40;
        const boxHeight = 5;
        const x = Math.floor((width - boxWidth) / 2);
        const y = Math.floor((height - boxHeight) / 2);

        renderer.drawFilledBox(x, y, boxWidth, boxHeight);
        
        const spinnerId = animations.startSpinner(x + 3, y + 2, 'bounce', message);
        
        return () => {
            animations.stopSpinner(spinnerId);
        };
    }

    /**
     * Draw a navigation breadcrumb
     */
    drawBreadcrumb(x, y, path) {
        const separatorColor = renderer.color('textDim');
        const activeColor = renderer.color('text');
        const inactiveColor = renderer.color('textDim');

        let breadcrumb = '';
        path.forEach((item, i) => {
            const isLast = i === path.length - 1;
            const color = isLast ? activeColor : inactiveColor;
            breadcrumb += color + item + renderer.constructor.ANSI.RESET;
            if (!isLast) {
                breadcrumb += separatorColor + ' > ' + renderer.constructor.ANSI.RESET;
            }
        });

        renderer.writeAt(x, y, breadcrumb);
    }

    /**
     * Draw pagination info
     */
    drawPagination(x, y, currentPage, totalPages, totalItems) {
        const textColor = renderer.color('textDim');
        const keyColor = renderer.color('menuKey');

        renderer.writeAt(x, y, 
            `${textColor}Page ${currentPage} of ${totalPages} (${totalItems} items)${renderer.constructor.ANSI.RESET}  ` +
            `${keyColor}[N]${renderer.constructor.ANSI.RESET}${textColor}ext ${renderer.constructor.ANSI.RESET}` +
            `${keyColor}[P]${renderer.constructor.ANSI.RESET}${textColor}rev${renderer.constructor.ANSI.RESET}`
        );
    }

    /**
     * Draw the ASCII logo
     */
    drawLogo(x, y, small = false) {
        const logoColor = renderer.color('logo');
        const accentColor = renderer.color('logoAccent');

        const logoFull = [
            '██████╗  █████╗ ███╗   ██╗██╗  ██╗██████╗  ██████╗ ████████╗',
            '██╔══██╗██╔══██╗████╗  ██║██║ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝',
            '██████╔╝███████║██╔██╗ ██║█████╔╝ ██████╔╝██║   ██║   ██║   ',
            '██╔══██╗██╔══██║██║╚██╗██║██╔═██╗ ██╔══██╗██║   ██║   ██║   ',
            '██║  ██║██║  ██║██║ ╚████║██║  ██╗██████╔╝╚██████╔╝   ██║   ',
            '╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝   '
        ];

        const logoSmall = [
            '╦═╗╔═╗╔╗╔╦╔═╔╗ ╔═╗╔╦╗',
            '╠╦╝╠═╣║║║╠╩╗╠╩╗║ ║ ║ ',
            '╩╚═╩ ╩╝╚╝╩ ╩╚═╝╚═╝ ╩ '
        ];

        const logo = small ? logoSmall : logoFull;

        logo.forEach((line, i) => {
            renderer.writeAt(x, y + i, logoColor + line + renderer.constructor.ANSI.RESET);
        });

        return logo.length;
    }
}

module.exports = new Components();
