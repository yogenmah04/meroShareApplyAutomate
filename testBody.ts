import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomUserAgent } from './humanUtils';

chromium.use(StealthPlugin());

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({ userAgent: getRandomUserAgent() });
    const page = await context.newPage();

    await page.goto('https://www.nepsealpha.com/trading-signals/funda', { waitUntil: 'networkidle' });

    await page.waitForSelector('table#funda-table');
    
    // Check which tables exist in the wrapper
    const tables = await page.locator('#funda-table_wrapper table').all();
    for (let i = 0; i < tables.length; i++) {
        const id = await tables[i].getAttribute('id');
        const thead = await tables[i].locator('thead').count();
        const tbody = await tables[i].locator('tbody').count();
        const trs = await tables[i].locator('tbody tr').count();
        console.log(`Table ${i}: id=${id}, thead=${thead}, tbody=${tbody}, rows=${trs}`);
    }

    await browser.close();
}

run().catch(console.error);
