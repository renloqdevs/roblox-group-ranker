/**
 * Animations - Loading spinners, progress bars, and transition effects
 */

const renderer = require('./renderer');

class Animations {
    constructor() {
        this.activeAnimations = new Map();
        this.animationId = 0;
    }

    /**
     * Spinner configurations
     */
    static SPINNERS = {
        dots: {
            frames: ['   ', '.  ', '.. ', '...', '.. ', '.  '],
            interval: 200
        },
        line: {
            frames: ['-', '\\', '|', '/'],
            interval: 100
        },
        dots2: {
            frames: ['.  ', '.. ', '...', ' ..', '  .', '   '],
            interval: 150
        },
        arc: {
            frames: ['|', '/', '-', '\\'],
            interval: 100
        },
        circle: {
            frames: ['(o    )', '( o   )', '(  o  )', '(   o )', '(    o)', '(   o )', '(  o  )', '( o   )'],
            interval: 100
        },
        bounce: {
            frames: ['[=    ]', '[ =   ]', '[  =  ]', '[   = ]', '[    =]', '[   = ]', '[  =  ]', '[ =   ]'],
            interval: 100
        },
        pulse: {
            frames: ['.', 'o', 'O', 'o'],
            interval: 150
        },
        arrows: {
            frames: ['>', '>>', '>>>', '>>>>', '>>>>>', '>>>>', '>>>', '>>', '>'],
            interval: 120
        },
        loading: {
            frames: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[====]', '[ ===]', '[  ==]', '[   =]'],
            interval: 100
        }
    };

    /**
     * Start a spinner animation
     */
    startSpinner(x, y, type = 'line', message = '') {
        const id = ++this.animationId;
        const spinner = Animations.SPINNERS[type] || Animations.SPINNERS.line;
        let frameIndex = 0;

        const color = renderer.color('spinner');
        const textColor = renderer.color('text');

        const intervalId = setInterval(() => {
            const frame = spinner.frames[frameIndex % spinner.frames.length];
            renderer.writeAt(x, y, `${color}${frame}${renderer.constructor.ANSI.RESET} ${textColor}${message}${renderer.constructor.ANSI.RESET}`);
            frameIndex++;
        }, spinner.interval);

        this.activeAnimations.set(id, { intervalId, x, y });
        return id;
    }

    /**
     * Stop a spinner animation
     */
    stopSpinner(id, finalMessage = '', status = 'ok') {
        const animation = this.activeAnimations.get(id);
        if (animation) {
            clearInterval(animation.intervalId);
            this.activeAnimations.delete(id);

            if (finalMessage) {
                renderer.drawStatus(animation.x, animation.y, status, finalMessage);
            }
        }
    }

    /**
     * Stop all animations
     */
    stopAll() {
        for (const [id, animation] of this.activeAnimations) {
            clearInterval(animation.intervalId);
        }
        this.activeAnimations.clear();
    }

    /**
     * Animated progress bar
     */
    async progressBar(x, y, width, duration, message = '') {
        const startTime = Date.now();
        const textColor = renderer.color('text');

        return new Promise(resolve => {
            const intervalId = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / duration) * 100, 100);

                if (message) {
                    renderer.writeAt(x, y - 1, `${textColor}${message}${renderer.constructor.ANSI.RESET}`);
                }
                renderer.drawProgressBar(x, y, width, progress);

                if (progress >= 100) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 50);
        });
    }

    /**
     * Smooth progress bar update
     */
    async smoothProgress(x, y, width, fromPercent, toPercent, duration = 500) {
        const startTime = Date.now();
        const diff = toPercent - fromPercent;

        return new Promise(resolve => {
            const intervalId = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const t = Math.min(elapsed / duration, 1);
                
                // Ease out cubic
                const eased = 1 - Math.pow(1 - t, 3);
                const current = fromPercent + (diff * eased);

                renderer.drawProgressBar(x, y, width, current);

                if (t >= 1) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 16);
        });
    }

    /**
     * Typewriter effect
     */
    async typewriter(x, y, text, speed = 50) {
        const color = renderer.color('text');
        
        for (let i = 0; i <= text.length; i++) {
            renderer.writeAt(x, y, color + text.substring(0, i) + renderer.constructor.ANSI.RESET);
            await this.sleep(speed);
        }
    }

    /**
     * Fade in text (using brightness levels)
     */
    async fadeIn(x, y, text, duration = 500) {
        const steps = [
            renderer.constructor.ANSI.DIM,
            renderer.constructor.ANSI.RESET,
            renderer.constructor.ANSI.BOLD
        ];
        
        const stepDuration = duration / steps.length;

        for (const step of steps) {
            renderer.writeAt(x, y, step + text + renderer.constructor.ANSI.RESET);
            await this.sleep(stepDuration);
        }
        
        renderer.writeAt(x, y, text);
    }

    /**
     * Blink effect
     */
    async blink(x, y, text, times = 3, interval = 200) {
        for (let i = 0; i < times; i++) {
            renderer.writeAt(x, y, text);
            await this.sleep(interval);
            renderer.writeAt(x, y, ' '.repeat(renderer.stripAnsi(text).length));
            await this.sleep(interval);
        }
        renderer.writeAt(x, y, text);
    }

    /**
     * Slide in from left
     */
    async slideInLeft(x, y, text, duration = 300) {
        const plainText = renderer.stripAnsi(text);
        const steps = 10;
        const stepDuration = duration / steps;

        for (let i = 0; i <= steps; i++) {
            const currentX = x - (steps - i) * 2;
            const visibleChars = Math.floor((i / steps) * plainText.length);
            
            // Clear previous position
            if (i > 0) {
                renderer.writeAt(currentX - 2, y, '  ');
            }
            
            renderer.writeAt(Math.max(1, currentX), y, text.substring(0, visibleChars));
            await this.sleep(stepDuration);
        }
        
        renderer.writeAt(x, y, text);
    }

    /**
     * Countdown animation
     */
    async countdown(x, y, from, message = '') {
        const color = renderer.color('warning');
        const textColor = renderer.color('text');

        for (let i = from; i > 0; i--) {
            renderer.writeAt(x, y, `${color}${i}${renderer.constructor.ANSI.RESET} ${textColor}${message}${renderer.constructor.ANSI.RESET}  `);
            await this.sleep(1000);
        }
    }

    /**
     * Loading dots animation (continuous)
     */
    startLoadingDots(x, y, message = 'Loading') {
        const id = ++this.animationId;
        let dots = 0;
        const textColor = renderer.color('text');

        const intervalId = setInterval(() => {
            dots = (dots + 1) % 4;
            const dotsStr = '.'.repeat(dots) + ' '.repeat(3 - dots);
            renderer.writeAt(x, y, `${textColor}${message}${dotsStr}${renderer.constructor.ANSI.RESET}`);
        }, 400);

        this.activeAnimations.set(id, { intervalId, x, y });
        return id;
    }

    /**
     * Pulsing text
     */
    startPulse(x, y, text) {
        const id = ++this.animationId;
        let bright = true;

        const intervalId = setInterval(() => {
            const style = bright ? renderer.constructor.ANSI.BOLD : renderer.constructor.ANSI.DIM;
            renderer.writeAt(x, y, style + text + renderer.constructor.ANSI.RESET);
            bright = !bright;
        }, 500);

        this.activeAnimations.set(id, { intervalId, x, y });
        return id;
    }

    /**
     * Success checkmark animation
     */
    async successCheck(x, y) {
        const color = renderer.color('success');
        const frames = ['[ ]', '[.]', '[o]', '[O]', '[*]'];
        
        for (const frame of frames) {
            renderer.writeAt(x, y, color + frame + renderer.constructor.ANSI.RESET);
            await this.sleep(100);
        }
    }

    /**
     * Error X animation
     */
    async errorX(x, y) {
        const color = renderer.color('error');
        const frames = ['[ ]', '[.]', '[x]', '[X]', '[!]'];
        
        for (const frame of frames) {
            renderer.writeAt(x, y, color + frame + renderer.constructor.ANSI.RESET);
            await this.sleep(100);
        }
    }

    /**
     * Screen transition - wipe
     */
    async wipeTransition(direction = 'left', duration = 300) {
        const { width, height } = renderer.getDimensions();
        const steps = 20;
        const stepDuration = duration / steps;

        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const clearWidth = Math.floor(width * progress);

            for (let row = 1; row <= height; row++) {
                if (direction === 'left') {
                    renderer.writeAt(1, row, ' '.repeat(clearWidth));
                } else {
                    renderer.writeAt(width - clearWidth, row, ' '.repeat(clearWidth));
                }
            }
            await this.sleep(stepDuration);
        }
    }

    /**
     * Box expand animation
     */
    async expandBox(centerX, centerY, finalWidth, finalHeight, duration = 300) {
        const steps = 10;
        const stepDuration = duration / steps;

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentWidth = Math.floor(finalWidth * progress);
            const currentHeight = Math.floor(finalHeight * progress);

            if (currentWidth >= 3 && currentHeight >= 3) {
                const x = centerX - Math.floor(currentWidth / 2);
                const y = centerY - Math.floor(currentHeight / 2);
                renderer.drawBox(x, y, currentWidth, currentHeight);
            }

            await this.sleep(stepDuration);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new Animations();
