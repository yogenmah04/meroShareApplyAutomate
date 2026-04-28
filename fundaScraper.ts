import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { jitterSleep, getRandomUserAgent, humanClick } from './humanUtils';
import { initSheets, overrideSheetData } from './googleSheetsService';

// Initialize stealth plugin
chromium.use(StealthPlugin());

export async function fetchFundamentalData() {
    console.log('Launching browser for Fundamental Info scraper...');
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to Nepse Alpha Fundamental Info page...');
        await page.goto('https://www.nepsealpha.com/trading-signals/funda', { waitUntil: 'networkidle' });

        // 1. Select 50 from the length dropdown
        const lengthSelect = page.locator('select[name="funda-table_length"]');
        await lengthSelect.waitFor({ state: 'visible', timeout: 15000 });
        console.log('Setting table length to 1000...');
        await lengthSelect.selectOption('100');

        // Wait for table to reload after length change
        await jitterSleep(3000, 5000);

        // // 2. Click the 10th table header twice to ensure correct sorting (typically descending)
        // const tenthHeader = page.locator('table#funda-table thead tr th:nth-child(10)');
        // await tenthHeader.waitFor({ state: 'visible', timeout: 10000 });

        // console.log('Sorting by the 10th column (1st click)...');
        // await humanClick(page, tenthHeader);
        // await jitterSleep(1000, 2000); // Wait for a second as requested

        // console.log('Sorting by the 10th column (2nd click)...');
        // await humanClick(page, tenthHeader);

        // // Wait for sort to apply
        // await jitterSleep(2000, 4000);

        console.log('Extracting data from funda-table...');
        // The table structure uses separate tables for headers and body
        const headerTable = page.locator('xpath=//*[@id="funda-table_wrapper"]/div[3]/div[1]/div/table');
        await headerTable.waitFor({ state: 'visible', timeout: 10000 });

        // Extract headers
        const headers = await headerTable.locator('thead tr th').allInnerTexts();
        const cleanedHeaders = headers.map(h => h.trim()).filter(h => h.length > 0);
        console.log(`Detected headers: ${cleanedHeaders.join(', ')}`);

        if (cleanedHeaders.length === 0) {
            throw new Error('Failed to find table headers.');
        }

        const data: string[][] = [];
        let hasNextPage = true;
        let pageNum = 1;

        while (hasNextPage) {
            console.log(`Extracting data from page ${pageNum}...`);
            // Wait for rows to load in the main body table
            const bodyTable = page.locator('table#funda-table');
            await bodyTable.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });

            // Extract rows
            const rowLocators = await bodyTable.locator('tbody tr').all();
            let pageRows = 0;

            for (const row of rowLocators) {
                const cells = await row.locator('td').allInnerTexts();
                const cleanedCells = cells.map(c => c.trim().replace(/\n+/g, ' '));

                // Skip "No data available" rows
                if (cleanedCells.length > 1 || (cleanedCells.length === 1 && cleanedCells[0] !== 'No data available in table')) {
                    data.push(cleanedCells);
                    pageRows++;
                }
            }
            console.log(`Extracted ${pageRows} rows from page ${pageNum}.`);

            // Check if next button is disabled
            const nextButton = page.locator('xpath=//*[@id="funda-table_next"]');
            const isDisabled = await nextButton.evaluate(el => el.classList.contains('disabled')).catch(() => true);

            if (!isDisabled) {
                console.log('Moving to next page...');
                await humanClick(page, nextButton);
                await jitterSleep(2000, 3000); // Wait for the table data to reload
                pageNum++;
            } else {
                console.log('Reached the last page.');
                hasNextPage = false;
            }
        }

        console.log(`Successfully extracted a total of ${data.length} rows.`);

        console.log('Saving data to Google Sheets...');
        await initSheets();
        await overrideSheetData('fundamentalInfo', cleanedHeaders, data);
        console.log('Successfully saved data to Google Sheets tab "fundamentalInfo"');

        return { headers: cleanedHeaders, data };

    } catch (error) {
        console.error('Error in fetchFundamentalData:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Support manual run
if (require.main === module) {
    fetchFundamentalData()
        .then(({ headers, data }) => {
            console.log('Headers:', headers);
            console.log(`Extracted ${data.length} rows.`);
            if (data.length > 0) {
                console.log('First row sample:', data[0]);
            }
        })
        .catch(console.error);
}
