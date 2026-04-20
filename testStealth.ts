import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';

chromium.use(StealthPlugin());
dotenv.config();

async function testStealth() {
    console.log('Testing Stealth Plugin...');
    const browser = await chromium.launch({ 
        headless: false, 
        args: ['--disable-blink-features=AutomationControlled'] 
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://bot.sannysoft.com/');
        console.log('Checking results at https://bot.sannysoft.com/');
        
        // Wait for results to load
        await page.waitForTimeout(5000);
        
        // Screenshot for evidence if needed
        await page.screenshot({ path: 'stealth_test.png' });
        console.log('Test complete. Check the screenshot (stealth_test.png) for results.');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
}

testStealth().catch(console.error);
