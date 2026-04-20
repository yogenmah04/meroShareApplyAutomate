import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import path from 'path';
import { humanClick, humanType, jitterSleep, getRandomUserAgent } from './humanUtils';

// Initialize stealth plugin
chromium.use(StealthPlugin());

// Load environment variables from .env
dotenv.config();

export async function runAutomation(user: any) {
  const { dp, username, password, crn, pin, kitta = "10" } = user;
  console.log(`Starting automation for user: ${username}...`);

  // Launch browser with stealth args
  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--disable-blink-features=AutomationControlled'] 
  });
  
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Meroshare...');
    await page.goto('https://meroshare.cdsc.com.np/', { waitUntil: 'networkidle' });

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible' });
    await humanClick(page, dpSelect);

    await humanType(page, '.select2-search__field', dp);
    await page.keyboard.press('Enter');

    // Enter Username and Password
    await humanType(page, 'input[name="username"]', username);
    await humanType(page, 'input[name="password"]', password);

    // Click Login
    console.log('Logging in...');
    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await humanClick(page, loginButton);

    await jitterSleep(5000, 7000);

    console.log('Clicking on sidebar item (My ASBA)...');
    const targetLink = page.locator('//*[@id="sideBar"]/nav/ul/li[8]/a');
    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    await humanClick(page, targetLink);
    
    await jitterSleep(3000, 5000);

    console.log('Scanning list for "Ordinary Shares" with an "Apply" button...');
    const listContainer = page.locator('//*[@id="main"]/div/app-asba/div/div[2]/app-applicable-issue/div/div/div/div/div');
    const targetItem = listContainer.locator('> div')
      .filter({ hasText: 'Ordinary Shares' })
      .filter({ has: page.locator('button', { hasText: 'Apply' }) })
      .first();

    const applyButton = targetItem.locator('button', { hasText: 'Apply' });

    try {
      await applyButton.waitFor({ state: 'visible', timeout: 10000 });
      await humanClick(page, applyButton);
      console.log('Clicked apply button successfully.');

      await jitterSleep(3000, 5000);
      console.log('Filling out the application form...');

      // 1. Select the bank
      const selectBank = page.locator('//*[@id="selectBank"]');
      await selectBank.waitFor({ state: 'visible' });
      await selectBank.selectOption({ index: 1 });

      await jitterSleep(1500, 2500);

      // 2. Select the account number
      const accountNumber = page.locator('//*[@id="accountNumber"]');
      await accountNumber.waitFor({ state: 'visible' });
      await accountNumber.selectOption({ index: 1 });

      // 3. Fill in Applied Kitta
      const appliedKitta = page.locator('//*[@id="appliedKitta"]');
      await humanClick(page, appliedKitta);
      await appliedKitta.fill(''); 
      await humanType(page, '//*[@id="appliedKitta"]', kitta);
      await page.keyboard.press('Tab'); 

      // 4. Fill in CRN Number
      await humanType(page, '//*[@id="crnNumber"]', crn);

      // 5. Tick the disclaimer checkbox
      const disclaimer = page.locator('//*[@id="disclaimer"]');
      await disclaimer.check();

      console.log('Waiting for verification pause...');
      await jitterSleep(5000, 7000);

      // 6. Click the proceed button
      console.log('Clicking the proceed button...');
      const proceedButton = page.locator('//*[@id="main"]/div/app-issue/div/wizard/div/wizard-step[1]/form/div[2]/div/div[5]/div[2]/div/button[1]');
      await humanClick(page, proceedButton);

      await jitterSleep(2000, 4000);

      console.log('Entering transaction PIN...');
      // 7. Fill the transaction PIN
      const transactionPIN = page.locator('//*[@id="transactionPIN"]');
      await transactionPIN.waitFor({ state: 'visible' });
      await humanType(page, '//*[@id="transactionPIN"]', pin);

      await jitterSleep(1000, 2000);

      // 8. Click the final Apply button
      console.log('Clicking the final Apply button...');
      const finalApplyButton = page.locator('//*[@id="main"]/div/app-issue/div/wizard/div/wizard-step[2]/div[2]/div/form/div[2]/div/div/div/button[1]');
      await humanClick(page, finalApplyButton);
      console.log('The application has been successfully submitted!');

      await jitterSleep(5000, 7000);

    } catch (error) {
      console.log('No "Ordinary Shares" available or error during application steps.');
    }

  } catch (error) {
    console.error('An error occurred during automation:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}
