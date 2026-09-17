import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import { humanClick, humanType, jitterSleep, getRandomUserAgent, launchBrowserWithViewMode } from './humanUtils';
import fs from 'fs';
import path from 'path';
import { overridePortfolioData } from './googleSheetsService';

// Initialize stealth plugin
chromium.use(StealthPlugin());
dotenv.config();

export async function scrapePortfolio(user: any) {
  const { dp, username, password } = user;
  console.log(`Starting portfolio scrape for user: ${username}...`);

  const browser = await launchBrowserWithViewMode(chromium);
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Meroshare...');
    await page.goto('https://meroshare.cdsc.com.np/', { waitUntil: 'networkidle' });

    // Login sequence
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible', timeout: 15000 });
    await humanClick(page, dpSelect);

    await humanType(page, '.select2-search__field', dp);
    await page.keyboard.press('Enter');

    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await humanClick(page, loginButton);
    await jitterSleep(5000, 7000);

    // Navigate to "My Portfolio"
    console.log('Navigating to My Portfolio...');
    const portfolioLink = page.locator('//*[@id="sideBar"]/nav/ul/li[6]/a'); // Estimated xpath for My Portfolio based on Meroshare structure
    await portfolioLink.waitFor({ state: 'visible', timeout: 15000 });
    await humanClick(page, portfolioLink);
    await jitterSleep(3000, 5000);

    // Scrape data (placeholder logic for table extraction)
    console.log('Extracting portfolio data...');
    // A more robust implementation would extract actual table rows here.
    // For demonstration, we'll save a dummy or partial extraction.
    const holdings: any[] = [];

    // Attempt to locate table rows in the portfolio view
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
        const scriptRow = rows.nth(i);
        const symbol = await scriptRow.locator('td').nth(0).innerText().catch(() => '');
        const quantity = await scriptRow.locator('td').nth(1).innerText().catch(() => '');
        if (symbol && quantity) {
            holdings.push({ symbol: symbol.trim(), quantity: quantity.trim() });
        }
    }

    console.log(`Extracted ${holdings.length} holdings for ${username}.`);

    // Save locally
    const reportPath = path.resolve(__dirname, `portfolio_${username}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(holdings, null, 2));

    // Sync to Google Sheets
    if (holdings.length > 0) {
        console.log('Syncing portfolio data to Google Sheets...');
        await overridePortfolioData(holdings);
    }

    return holdings;

  } catch (error) {
    console.error('An error occurred during portfolio scraping:', error);
    throw error;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}
