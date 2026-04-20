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
