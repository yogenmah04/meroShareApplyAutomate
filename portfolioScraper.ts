import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import { humanClick, humanType, jitterSleep, getRandomUserAgent, launchBrowserWithViewMode } from './humanUtils';
import fs from 'fs';
import path from 'path';
import { overridePortfolioData, initSheets } from './googleSheetsService';

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
    let pageLoaded = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto('https://meroshare.cdsc.com.np/', { waitUntil: 'networkidle' });
      try {
        const dpSelect = page.locator('.select2-selection__rendered');
        await dpSelect.waitFor({ state: 'visible', timeout: 5000 });
        pageLoaded = true;
        break;
      } catch (e) {
        console.log('White screen or failed to load. Reloading...');
      }
    }

    if (!pageLoaded) {
      throw new Error('Failed to load Meroshare page after retries.');
    }

    // Login sequence
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible', timeout: 15000 });
    await humanClick(page, dpSelect);

    const dpSearchInput = page.locator('.select2-search__field');
    await dpSearchInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await humanType(page, '.select2-search__field', dp);
    await page.keyboard.press('Enter');
    await jitterSleep(500, 1000);

    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await humanClick(page, loginButton);
    await jitterSleep(5000, 7000);

    // Navigate to "My Portfolio"
    console.log('Navigating to My Portfolio...');
    let portfolioLink = page.locator('#sideBar nav a').filter({ hasText: /Portfolio/i }).first();
    if (await portfolioLink.count() === 0) {
      portfolioLink = page.locator('a[href*="portfolio"]').first();
    }
    if (await portfolioLink.count() === 0) {
      portfolioLink = page.locator('//*[@id="sideBar"]/nav/ul/li[6]/a');
    }

    await portfolioLink.waitFor({ state: 'visible', timeout: 15000 });
    await humanClick(page, portfolioLink);
    await jitterSleep(3000, 5000);

    // Check if there is a Search button to load the portfolio table
    const searchButton = page.locator('button', { hasText: /Search/i }).first();
    if (await searchButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking Search button in portfolio view...');
      await humanClick(page, searchButton);
      await jitterSleep(3000, 5000);
    }

    // Scrape data
    console.log('Extracting portfolio data...');
    const holdings: any[] = [];

    // Attempt to locate table rows
    const table = page.locator('table');
    if (await table.count() > 0) {
      const headers: string[] = await page.locator('table thead th').allInnerTexts().catch(() => []);
      console.log('Portfolio table headers:', headers);

      let scripCol = headers.findIndex((h: string) => /scrip|symbol|company/i.test(h));
      let qtyCol = headers.findIndex((h: string) => /current balance|quantity|balance|unit|qty/i.test(h));

      // Defaults if headers are not found or not matched
      if (scripCol === -1) scripCol = headers.length > 2 ? 1 : 0;
      if (qtyCol === -1) qtyCol = headers.length > 2 ? 2 : 1;

      console.log(`Using column indices -> Scrip: ${scripCol}, Quantity: ${qtyCol}`);

      // Try selecting max page size if dropdown exists
      const lengthSelect = page.locator('select[name*="length"], select[name*="size"], .dataTables_length select').first();
      if (await lengthSelect.isVisible().catch(() => false)) {
        await lengthSelect.selectOption({ label: 'All' }).catch(async () => {
          await lengthSelect.selectOption({ value: '-1' }).catch(async () => {
            await lengthSelect.selectOption({ value: '100' }).catch(() => {});
          });
        });
        await jitterSleep(2000, 3000);
      }

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      for (let i = 0; i < rowCount; i++) {
        const scriptRow = rows.nth(i);
        const cells = scriptRow.locator('td');
        const cellCount = await cells.count();
        if (cellCount > Math.max(scripCol, qtyCol)) {
          const symbol = (await cells.nth(scripCol).innerText().catch(() => '')).trim();
          const quantity = (await cells.nth(qtyCol).innerText().catch(() => '')).trim();
          if (symbol && quantity && !/total|grand total/i.test(symbol)) {
            holdings.push({ symbol, quantity });
          }
        }
      }
    }

    console.log(`Extracted ${holdings.length} holdings for ${username}.`);

    // Save locally
    const reportPath = path.resolve(__dirname, `portfolio_${username}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(holdings, null, 2));
    console.log(`Saved local report to ${reportPath}`);

    // Sync to Google Sheets
    if (holdings.length > 0) {
      console.log('Syncing portfolio data to Google Sheets...');
      try {
        await initSheets();
        await overridePortfolioData(holdings);
        console.log('Successfully synced portfolio data to Google Sheets.');
      } catch (sheetErr: any) {
        console.error('Failed to sync to Google Sheets:', sheetErr?.message || sheetErr);
      }
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

// Standalone execution support
if (require.main === module) {
  (async () => {
    try {
      let usersToScrape: any[] = [];

      // 1. Try to fetch from Google Sheets
      try {
        await initSheets();
        const { fetchUsersFromSheet } = await import('./googleSheetsService');
        const sheetUsers = await fetchUsersFromSheet();
        const validUsers = sheetUsers.filter((u: any) => u.username && u.password && u.dp && u.checkPortfolio === true);
        if (validUsers.length > 0) {
          usersToScrape = validUsers;
          console.log(`Found ${usersToScrape.length} user(s) with checkPortfolio=true from Google Sheets.`);
        }
      } catch (sheetErr: any) {
        console.warn('Could not fetch users from Google Sheets:', sheetErr?.message || sheetErr);
      }

      // 2. Fallback to users.json if no sheet users found
      if (usersToScrape.length === 0) {
        const usersPath = path.resolve(__dirname, 'users.json');
        if (fs.existsSync(usersPath)) {
          const localUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
          usersToScrape = localUsers.filter((u: any) => u.username && u.password && u.dp && (u.checkPortfolio === true || u.isApply === true));
          if (usersToScrape.length === 0 && localUsers.length > 0) {
            usersToScrape = [localUsers[0]];
          }
          console.log(`Using ${usersToScrape.length} user(s) from users.json.`);
        }
      }

      if (usersToScrape.length === 0) {
        console.error('No valid user found to scrape portfolio.');
        process.exit(1);
      }

      for (const user of usersToScrape) {
        try {
          await scrapePortfolio(user);
        } catch (err: any) {
          console.error(`Error scraping portfolio for user ${user.username || user.name}:`, err?.message || err);
        }
      }
      console.log('Portfolio scraping completed.');
    } catch (err: any) {
      console.error('Portfolio scraper execution failed:', err?.message || err);
      process.exit(1);
    }
  })();
}
