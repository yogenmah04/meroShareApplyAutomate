import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { jitterSleep, getRandomUserAgent, humanClick } from './humanUtils';

// Initialize stealth plugin
chromium.use(StealthPlugin());

export async function fetchPromoterUnlockData() {
    console.log('Launching browser for Nepse Alpha scraper...');
    const browser = await chromium.launch({ 
        headless: false, 
        args: ['--disable-blink-features=AutomationControlled'] 
    });
    
    const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to Nepse Alpha Promoter Lock-In page...');
        await page.goto('https://nepsealpha.com/promoter-lock-in', { waitUntil: 'networkidle' });

        // Click "Next 3 Months"
        const next3MonthsButton = page.locator('button:has-text("Next 3 Months")');
        await next3MonthsButton.waitFor({ state: 'visible', timeout: 15000 });
        console.log('Clicking "Next 3 Months" button...');
        await humanClick(page, next3MonthsButton);

        // Wait for table to update - this is critical as the table reloads dynamically
        console.log('Waiting for table to refresh data...');
        await jitterSleep(3000, 5000);

        // Use more stable class-based selectors instead of dynamic IDs
        const table = page.locator('div.table-responsive table.dataTable').first();
        await table.waitFor({ state: 'visible', timeout: 15000 });

        // Extract headers
        const headers = await table.locator('thead th').allInnerTexts();
        const cleanedHeaders = headers.map(h => h.trim()).filter(h => h.length > 0);
        console.log(`Detected headers: ${cleanedHeaders.join(', ')}`);

        if (cleanedHeaders.length === 0) {
            throw new Error('Failed to find table headers. The table might not have loaded correctly.');
        }

        // Extract rows
        const rowLocators = await table.locator('tbody tr').all();
        const data: string[][] = [];

        for (const row of rowLocators) {
            const cells = await row.locator('td').allInnerTexts();
            // Clean cell data (handle newlines and extra spaces)
            const cleanedCells = cells.map(c => c.trim().replace(/\n+/g, ' '));
            if (cleanedCells.length > 0 && cleanedCells[0] !== 'No data available in table') {
                data.push(cleanedCells);
            }
        }

        console.log(`Successfully extracted ${data.length} rows.`);
        return { headers: cleanedHeaders, data };

    } catch (error) {
        console.error('Error in fetchPromoterUnlockData:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Support manual run
if (require.main === module) {
    fetchPromoterUnlockData()
        .then(({ headers, data }) => {
            console.log('Headers:', headers);
            console.log('Sample Data (First row):', data[0]);
        })
        .catch(console.error);
}
