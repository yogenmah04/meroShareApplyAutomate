import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env
dotenv.config();

export async function runAutomation(user: any) {
  const { dp, username, password, crn, pin, kitta = "10" } = user;
  console.log(`Starting automation for user: ${username}...`);

  // Launch browser (set headless: false to see it run)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to Meroshare...');
    await page.goto('https://meroshare.cdsc.com.np/');

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible' });
    await dpSelect.click();

    const dpSearchInput = page.locator('.select2-search__field');
    await dpSearchInput.waitFor({ state: 'visible' });
    await dpSearchInput.fill(dp);
    await page.keyboard.press('Enter');

    // Enter Username and Password
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);

    // Click Login
    console.log('Logging in...');
    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await loginButton.click();

    // Verify Login Success (wait for dashboard to load or something specific)
    // Wait for network to be idle or wait for a specific dashboard element
    await page.waitForTimeout(5000);

    // --> ADD YOUR CUSTOM AUTOMATION STEPS HERE <--
    console.log('Clicking on sidebar item...');
    const targetLink = page.locator('//*[@id="sideBar"]/nav/ul/li[8]/a');
    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    await targetLink.click();
    console.log('Clicked sidebar item successfully.');

    // Wait for the new page / content to load (My ASBA)
    await page.waitForTimeout(3000);

    console.log('Scanning list for "Ordinary Shares" with an "Apply" button...');

    // The container that holds all the listed items
    const listContainer = page.locator('//*[@id="main"]/div/app-asba/div/div[2]/app-applicable-issue/div/div/div/div/div');

    // Filter the items to find the one containing "Ordinary Shares" and having an "Apply" button
    // It will explicitly ignore ones that have "Edit" instead of "Apply"
    const targetItem = listContainer.locator('> div')
      .filter({ hasText: 'Ordinary Shares' })
      .filter({ has: page.locator('button', { hasText: 'Apply' }) })
      .first();

    const applyButton = targetItem.locator('button', { hasText: 'Apply' });

    try {
      // click apply button of ordinary share ipo
      console.log('Waiting for the matching Apply button to become visible...');
      await applyButton.waitFor({ state: 'visible', timeout: 10000 });
      await applyButton.click();
      console.log('Clicked apply button successfully.');

      // Wait a moment for the application form to load Apply ipo share
      await page.waitForTimeout(3000);

      console.log('Filling out the application form...');

      // 1. Select the bank (assuming index 1 is the first actual bank option after placeholder)
      const selectBank = page.locator('//*[@id="selectBank"]');
      await selectBank.waitFor({ state: 'visible' });
      await selectBank.selectOption({ index: 1 });

      // Wait slightly for the account number dropdown to auto-populate based on the selected bank
      await page.waitForTimeout(1500);

      // 2. Select the account number (first actual option)
      const accountNumber = page.locator('//*[@id="accountNumber"]');
      await accountNumber.waitFor({ state: 'visible' });
      await accountNumber.selectOption({ index: 1 });

      // 3. Fill in Applied Kitta (using pressSequentially to trigger Angular's auto-calc for the Amount)
      const appliedKitta = page.locator('//*[@id="appliedKitta"]');
      await appliedKitta.click();
      await appliedKitta.fill(''); // clear it first
      await appliedKitta.pressSequentially(kitta, { delay: 100 });
      await appliedKitta.press('Tab'); // Trigger blur event to ensure calculations happen

      // 4. Fill in CRN Number
      const crnNumber = page.locator('//*[@id="crnNumber"]');
      await crnNumber.fill(crn);

      // 5. Tick the disclaimer checkbox
      const disclaimer = page.locator('//*[@id="disclaimer"]');
      await disclaimer.check();

      // Wait 5 seconds to let the user visually verify the data
      console.log('Waiting for 5 seconds to verify data...');
      await page.waitForTimeout(5000);

      // 6. Click the proceed button
      console.log('Clicking the proceed button...');
      const proceedButton = page.locator('//*[@id="main"]/div/app-issue/div/wizard/div/wizard-step[1]/form/div[2]/div/div[5]/div[2]/div/button[1]');
      await proceedButton.click();
      console.log('Successfully proceeded to the final step.');

      // Wait a moment for the PIN confirmation step to appear
      await page.waitForTimeout(2000);

      console.log('Entering transaction PIN...');
      // 7. Fill the transaction PIN
      const transactionPIN = page.locator('//*[@id="transactionPIN"]');
      await transactionPIN.waitFor({ state: 'visible' });
      await transactionPIN.pressSequentially(pin, { delay: 100 });

      // Wait an extra second before submitting just in case
      await page.waitForTimeout(1000);

      // 8. Click the final Apply button
      console.log('Clicking the final Apply button...');
      const finalApplyButton = page.locator('//*[@id="main"]/div/app-issue/div/wizard/div/wizard-step[2]/div[2]/div/form/div[2]/div/div/div/button[1]');
      await finalApplyButton.click();
      console.log('The application has been successfully submitted!');

      // Keep browser open shortly to let you see the success message!
      await page.waitForTimeout(5000);

    } catch (error) {
      console.log('No "Ordinary Shares" available with an "Apply" button. They might be closed or already applied (showing "Edit").');
    }

    console.log('Automation steps complete!');

  } catch (error) {
    console.error('An error occurred during automation:', error);
  } finally {
    console.log('Closing browser...');
    // await browser.close();
  }
}
