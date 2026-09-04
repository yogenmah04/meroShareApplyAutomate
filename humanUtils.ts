import { Page } from 'playwright';

/**
 * Sleeps for a random amount of time between min and max milliseconds.
 */
export async function jitterSleep(min: number = 1000, max: number = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Types text into a selector character-by-character with random delays.
 */
export async function humanType(page: Page, selector: string, text: string) {
    await page.locator(selector).focus();
    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.random() * 100 + 50 }); // 50-150ms delay per char
    }
}

/**
 * Performs a human-like click: hovers over the element before clicking.
 */
export async function humanClick(page: Page, selector: string | any) {
    const locator = typeof selector === 'string' ? page.locator(selector) : selector;
    await locator.hover();
    await jitterSleep(200, 500); // Small pause after hover
    await locator.click();
}

/**
 * Generates a random User-Agent to help avoid basic fingerprinting.
 * (Best to keep it consistent within a single session though)
 */
export function getRandomUserAgent() {
    const agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Ensures background processes (e.g., Supervisor) are bridged to the active desktop session.
 */
export function ensureDesktopDisplay() {
    const fs = require('fs');
    const path = require('path');
    const uid = process.getuid ? process.getuid() : 1000;
    const runtimeDir = `/run/user/${uid}`;

    if (!process.env.XDG_RUNTIME_DIR && fs.existsSync(runtimeDir)) {
        process.env.XDG_RUNTIME_DIR = runtimeDir;
    }
    if (!process.env.DISPLAY) {
        process.env.DISPLAY = ':0';
    }
    if (!process.env.WAYLAND_DISPLAY && fs.existsSync(path.join(runtimeDir, 'wayland-0'))) {
        process.env.WAYLAND_DISPLAY = 'wayland-0';
    }
    if (!process.env.XAUTHORITY && fs.existsSync(runtimeDir)) {
        try {
            const files = fs.readdirSync(runtimeDir);
            const authFile = files.find((f: string) => f.startsWith('.mutter-Xwaylandauth') || f.startsWith('.Xauthority'));
            if (authFile) {
                process.env.XAUTHORITY = path.join(runtimeDir, authFile);
            }
        } catch (_) {}
    }
}

/**
 * Launches Chromium in view mode (headed) by default, falling back to headless if no display is accessible.
 */
export async function launchBrowserWithViewMode(chromium: any, customOptions: any = {}) {
    ensureDesktopDisplay();

    const wantHeadless = process.env.HEADLESS === 'true';
    const baseArgs = [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(customOptions.args || []),
    ];

    if (wantHeadless) {
        return await chromium.launch({
            ...customOptions,
            headless: true,
            args: baseArgs,
        });
    }

    try {
        return await chromium.launch({
            ...customOptions,
            headless: false,
            args: baseArgs,
        });
    } catch (err: any) {
        if (err?.message?.includes('Missing X server') || err?.message?.includes('Target page, context or browser has been closed')) {
            console.warn(`[Display Warning] Could not open GUI window on screen: ${err.message}. Falling back to background headless mode.`);
            return await chromium.launch({
                ...customOptions,
                headless: true,
                args: baseArgs,
            });
        }
        throw err;
    }
}

/**
 * Launches persistent context in view mode by default, falling back to headless if no display is accessible.
 */
export async function launchPersistentContextWithViewMode(chromium: any, userDataDir: string, customOptions: any = {}) {
    ensureDesktopDisplay();

    const wantHeadless = process.env.HEADLESS === 'true';
    const baseArgs = [
        ...(customOptions.args || []),
    ];

    if (wantHeadless) {
        return await chromium.launchPersistentContext(userDataDir, {
            ...customOptions,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', ...baseArgs],
            viewport: { width: 1366, height: 768 },
        });
    }

    try {
        return await chromium.launchPersistentContext(userDataDir, {
            ...customOptions,
            headless: false,
            args: ['--start-maximized', ...baseArgs],
            viewport: null,
        });
    } catch (err: any) {
        if (err?.message?.includes('Missing X server') || err?.message?.includes('Target page, context or browser has been closed')) {
            console.warn(`[Display Warning] Could not open GUI window on screen: ${err.message}. Falling back to background headless mode.`);
            return await chromium.launchPersistentContext(userDataDir, {
                ...customOptions,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', ...baseArgs],
                viewport: { width: 1366, height: 768 },
            });
        }
        throw err;
    }
}
