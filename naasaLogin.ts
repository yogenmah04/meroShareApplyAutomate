import { chromium } from "playwright";

async function runNaasaLogin() {
  // Launch chromium browser in non-headless mode so action is visible
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to https://x.naasasecurities.com.np/login...");
    await page.goto("https://x.naasasecurities.com.np/login", {
      waitUntil: "networkidle",
    });

    console.log("Entering email...");
    await page.locator('xpath=//*[@id="username"]').fill("yugmah02@gmail.com");

    console.log("Entering password...");
    await page.locator('xpath=//*[@id="login-password"]').fill("Yogenmah1!");

    console.log("Clicking login button...");
    await page.locator('xpath=//*[@id="kc-login"]').click();

    // Wait briefly after login submit
    await page.waitForTimeout(3000);

    console.log("Clicking target link/button...");
    await page.locator('xpath=/html/body/div[1]/div[2]/ul/li[2]/a').click();

    console.log("Actions completed successfully!");
    // Keep browser open for a few seconds to verify visually
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error("An error occurred during execution:", error);
  } finally {
    await browser.close();
  }
}

runNaasaLogin();
