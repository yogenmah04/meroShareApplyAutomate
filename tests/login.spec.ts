import { test, expect } from '@playwright/test';

// Replace these with your actual credentials or use environment variables
const DP = process.env.DP || 'Your DP Name or ID';
const USERNAME = process.env.USERNAME || 'Your Username';
const PASSWORD = process.env.PASSWORD || 'Your Password';

test('Meroshare Login and Credential Attempt', async ({ page }) => {
  // Navigate to Meroshare login page
  await page.goto('https://meroshare.cdsc.com.np/');

  // Wait for the DP dropdown to be visible and click it to open the list
  const dpSelect = page.locator('.select2-selection__rendered');
  await dpSelect.waitFor({ state: 'visible' });
  await dpSelect.click();

  // Type the DP into the search field and press enter
  const dpSearchInput = page.locator('.select2-search__field');
  await dpSearchInput.waitFor({ state: 'visible' });
  await dpSearchInput.fill(DP);
  await page.keyboard.press('Enter');

  // Fill in the Username
  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.fill(USERNAME);

  // Fill in the Password
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(PASSWORD);

  // Click the Login button
  const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
  await loginButton.click();

  // Add an assertion to verify login was successful.
  // We can wait for a specific element that only appears after login, e.g., the dashboard title.
  // Warning: Depending on what page it lands or if an error message appears, this might need adjusting.
  
  // As an example, verify that we do not see an error message,
  // or that we are redirected to the dashboard.
  // await expect(page).toHaveURL(/.*dashboard/);
  
  // For demonstration, let's wait a few seconds to visually see the result
  await page.waitForTimeout(10000);
});
