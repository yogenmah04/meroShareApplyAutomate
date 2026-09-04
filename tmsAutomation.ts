import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import path from "path";
import * as dotenv from "dotenv";
import { initSheets, fetchAutoBuySellData } from "./googleSheetsService";
import { launchPersistentContextWithViewMode } from "./humanUtils";

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

async function fetchExistingTrades(page: any) {
  console.log("🔍 Fetching existing open trades from the Daily Order Book...");
  const existingTrades: string[] = [];
  
  try {
    const selectLocator = page.locator('//*[@id="nav-open-info"]/kendo-grid/kendo-pager/kendo-pager-page-sizes/select');
    await selectLocator.waitFor({ state: "visible", timeout: 5000 });
    // Attempt to set to 50 by value or label. Usually the values are "10", "20", "50"
    await selectLocator.selectOption({ value: "50" }).catch(() => selectLocator.selectOption({ label: "50" }));
    await delay(2000);
  } catch(e) {
    console.log("Could not set items per page to 50 (maybe dropdown not present).");
  }

  const gridLocator = page.locator('//*[@id="nav-open-info"]/kendo-grid/div');
  const rows = gridLocator.locator('tr');
  const rowCount = await rows.count();
  
  for (let i = 0; i < rowCount; i++) {
      const text = await rows.nth(i).innerText();
      // Store text in uppercase for case-insensitive matching, removing commas
      existingTrades.push(text.toUpperCase().replace(/,/g, ''));
  }
  
  return existingTrades;
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

    let finalPrice = price;
    // The Google Sheet might send "0" when the cell is blank. We treat 0 as an empty price.
    if (!finalPrice || finalPrice.toString().trim() === "" || finalPrice.toString().trim() === "0" || parseFloat(finalPrice) === 0) {
      try {
        if (action === "SELL") {
          const highPriceLocator = page.locator("xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[3]/div[1]/div[3]");
          const highPriceText = await highPriceLocator.innerText();
          const highPriceValue = parseFloat(highPriceText.replace(/[^0-9.]/g, ''));
          if (!isNaN(highPriceValue)) {
            finalPrice = (highPriceValue - 0.5).toString();
          }
        } else if (action === "BUY") {
          const lowPriceLocator = page.locator("xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[3]/div[1]/div[2]");
          const lowPriceText = await lowPriceLocator.innerText();
          const lowPriceValue = parseFloat(lowPriceText.replace(/[^0-9.]/g, ''));
          if (!isNaN(lowPriceValue)) {
            finalPrice = (lowPriceValue + 0.5).toString();
          }
        }
        console.log(`Fetched dynamic price for ${symbol}: ${finalPrice}`);
      } catch (err) {
        console.log(`⚠️ Could not fetch dynamic price for ${symbol}, using default/empty.`);
      }
    }

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
    await humanType(page, priceInput, finalPrice);

    // 4. Final Click
    await delay(1000);
    const submitBtn =
      "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[3]/div[2]/button[1]";
    await humanClick(page, submitBtn);

    console.log(`✅ ${action} order submitted.`);

    // 5. Clear fields and reset toggle
    try {
      await delay(1500); // Give it a moment for any success toast to appear

      // Clear the inputs explicitly
      const symbolInput = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[2]/input";
      const qtyInput = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[3]/input";
      const priceInput = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[3]/form/div[2]/div[4]/input";

      // We use clearInput or direct fill. fill('') is safer and doesn't require clicking.
      await page.locator(symbolInput).fill('', { timeout: 2000 });
      await page.locator(qtyInput).fill('', { timeout: 2000 });
      await page.locator(priceInput).fill('', { timeout: 2000 });
      console.log(`🧹 Cleared symbol, qty, and price fields.`);

      // Reset toggle
      const resetToggle = "xpath=/html/body/app-root/tms/main/div/div/app-member-client-order-entry/div/div/div[1]/div[2]/app-three-state-toggle/div/div/label[2]";
      // Use force: true because a success toast message might be overlaying the top of the screen blocking the click.
      await page.locator(resetToggle).click({ force: true, timeout: 3000 });
      console.log(`🔄 Reset toggle to neutral.`);

    } catch (cleanupErr) {
      console.log(`⚠️ Note: Timeout while clearing fields or resetting toggle (toast might be blocking). Proceeding to next row.`);
    }

  } catch (err) {
    console.error(`❌ Trade Execution Error for ${symbol}:`, err);
  }
}

async function runAutomation() {
  await initSheets();
  const trades = await fetchAutoBuySellData();

  if (trades.length === 0) {
    console.log("No trades found with BUY/SELL actions in autoBuySellScript sheet.");
    return;
  }

  console.log(`Found ${trades.length} valid trades (BUY/SELL) from Google Sheet:`);
  trades.forEach((trade, index) => {
    console.log(` [${index + 1}] Action: ${trade.action} | Symbol: ${trade.symbol} | Qty: ${trade.qty} | Price: ${trade.price === "0" ? "Dynamic" : trade.price}`);
  });

  const userDataDir = path.join(__dirname, "tms_user_data");
  const context = await launchPersistentContextWithViewMode(chromium, userDataDir);

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

  // 2. Navigation to Daily Order Book (Open Trades)
  await humanClick(
    page,
    "xpath=/html/body/app-root/tms/app-menubar/aside/nav/ul/li[10]/a",
  );
  await delay(800);
  await humanClick(
    page,
    "xpath=/html/body/app-root/tms/app-menubar/aside/nav/ul/li[10]/ul/li[2]/a",
  );
  await delay(2000);

  const existingTrades = await fetchExistingTrades(page);
  console.log(`📊 Found ${existingTrades.length} open trades in the daily order book.`);

  // Now navigate to Order Entry page
  await humanClick(
    page,
    "xpath=/html/body/app-root/tms/app-menubar/aside/nav/ul/li[10]/ul/li[1]/a",
  );
  await delay(2000);

  for (const trade of trades) {
    // Check if trade already exists
    const tradeMatch = existingTrades.find(rowText => {
        return rowText.includes(trade.symbol.toUpperCase()) &&
               rowText.includes(trade.qty.replace(/,/g, '')) &&
               rowText.includes(trade.price.replace(/,/g, '')) &&
               rowText.includes(trade.action.toUpperCase());
    });

    if (tradeMatch) {
        console.log(`⏩ Skipping ${trade.action} for ${trade.symbol} (${trade.qty} @ ${trade.price}) as it already exists in the open trades list.`);
        continue;
    }

    await executeSingleTrade(page, trade.action as "BUY" | "SELL", trade.symbol, trade.qty, trade.price);
    await delay(2000);
  }

  console.log("🎉 All trades processed.");
}

runAutomation().catch(console.error);
