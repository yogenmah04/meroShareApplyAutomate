import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import path from "path";
import * as dotenv from "dotenv";
import { initSheets, fetchAutoBuySellData } from "./googleSheetsService";

dotenv.config();
chromium.use(stealth());

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function humanType(page: any, selector: string, text: string) {
  const element = page.locator(selector);
  await element.waitFor({ state: "visible" });
  await element.click();
  await delay(Math.floor(Math.random() * 400) + 200);
  await page.type(selector, text, {
    delay: Math.floor(Math.random() * 100) + 50,
  });
}

async function clearInput(page: any, selector: string) {
  const element = page.locator(selector);
  await element.waitFor({ state: "visible" });
  await element.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await delay(300);
}

async function humanClick(page: any, selector: string) {
  const element = page.locator(selector);
  await element.waitFor({ state: "visible" });
  await element.scrollIntoViewIfNeeded();
  await delay(Math.floor(Math.random() * 600) + 300);
  await element.click({ delay: Math.floor(Math.random() * 150) + 50 });
}

async function executeSingleTrade(
  page: any,
  action: "BUY" | "SELL",
  symbol: string,
  qty: string,
  price: string,
) {
  try {
    // 3. Trade Entry
    console.log(`📝 Preparing ${action} order for ${symbol}...`);

    // Symbol Input
    const symbolInput =
      "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[2]/input";
    await clearInput(page, symbolInput);
    await humanType(page, symbolInput, symbol);
    await delay(500);
    await page.keyboard.press("Enter");
    await delay(1500);

    // Toggle Selection logic
    if (action === "BUY") {
      const buyToggle =
        "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[1]/div[2]/app-three-state-toggle/div/div/label[3]";
      await humanClick(page, buyToggle);
    } else {
      const sellToggle =
        "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[1]/div[2]/app-three-state-toggle/div/div/label[1]";
      await humanClick(page, sellToggle);
    }

    // Qty and Price
    const qtyInput = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[3]/input";
    await clearInput(page, qtyInput);
    await humanType(page, qtyInput, qty);

    const priceInput = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[4]/input";
    await clearInput(page, priceInput);
    await humanType(page, priceInput, price);

    // 4. Final Click
    await delay(1000);
    const submitBtn =
      "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[3]/div[2]/button[1]";
    await humanClick(page, submitBtn);

    console.log(`✅ ${action} order submitted.`);
  } catch (err) {
    console.error(`❌ Trade Execution Error for ${symbol}:`, err);
  }
}

async function runAutomation() {
  await initSheets();
  const trades = await fetchAutoBuySellData();

  if (trades.length === 0) {
    console.log("No trades found in autoBuySellScript sheet.");
    return;
  }

  console.log(`Found ${trades.length} trades to execute.`);

  const userDataDir = path.join(__dirname, "tms_user_data");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto("https://tms52.nepsetms.com.np/tms/client/dashboard");

  // 1. Session / Login Handling
  if (page.url().includes("login")) {
    await page.fill(
      "xpath=/html/body/app-root/app-login/div/div/div[2]/form/div[1]/input",
      process.env.TMS_USER || "",
    );
    await page.fill("#password-field", process.env.TMS_PASS || "");
    console.log("👉 Please solve CAPTCHA/OTP manually...");
    await page.waitForSelector(".dashboard-wrapper", { timeout: 0 });
  }

  // 2. Navigation
  await humanClick(
    page,
    "xpath=/html/body/app-root/tms/app-menubar/aside/nav/ul/li[10]/a",
  );
  await delay(800);
  await humanClick(
    page,
    "xpath=/html/body/app-root/tms/app-menubar/aside/nav/ul/li[10]/ul/li[1]/a",
  );
  await delay(1000);

  for (const trade of trades) {
    await executeSingleTrade(page, trade.action as "BUY" | "SELL", trade.symbol, trade.qty, trade.price);
    await delay(2000);
  }

  console.log("🎉 All trades processed.");
}

runAutomation().catch(console.error);
