import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import schedule from "node-schedule";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize Google Sheets Auth
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const sheetId = process.env.GOOGLE_SHEET_ID;

if (!serviceAccountEmail || !privateKey || !sheetId) {
  throw new Error(
    "Missing Google Spreadsheet environment variables in .env file.",
  );
}

const formattedKey = privateKey.replace(/\\n/g, "\n");

const serviceAccountAuth = new JWT({
  email: serviceAccountEmail,
  key: formattedKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

// Use stealth plugin to avoid detection
chromium.use(stealth());

async function scrapeWithRetry(maxRetries = 3): Promise<string> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[${new Date().toLocaleString()}] NEPSE scraper attempt ${attempt}/${maxRetries}...`);
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-http2", // Essential: nepalstock.com resets HTTP/2 streams
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();

    try {
      console.log("Navigating to https://www.nepalstock.com/ ...");
      await page.goto("https://www.nepalstock.com/", {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      // Wait for the specific xpath element to load
      const xpath =
        "/html/body/app-root/div/main/div/app-dashboard/div[1]/div[1]/div/div[1]/div[1]/div[2]/span[2]";
      console.log("Waiting for element...");

      const element = await page.waitForSelector(`xpath=${xpath}`, {
        timeout: 30000,
      });
      const content = await element.textContent();

      if (!content) {
        throw new Error("Could not extract content from the given xpath.");
      }

      const extractedValue = content.trim();
      return extractedValue;
    } catch (err: any) {
      lastError = err;
      console.warn(`[${new Date().toLocaleString()}] Attempt ${attempt} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        const delayMs = 3000 * attempt;
        console.log(`Waiting ${delayMs / 1000}s before retry...`);
        await new Promise((res) => setTimeout(res, delayMs));
      }
    } finally {
      // Safe cleanup to prevent CDP session unhandled rejection
      try {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      } catch (_) {}
      console.log("Browser closed.");
    }
  }

  throw lastError || new Error("NEPSE scraping failed after retries.");
}

async function scrapeNepseAndSave() {
  console.log(`[${new Date().toLocaleString()}] Starting NEPSE scraper...`);

  try {
    const extractedValue = await scrapeWithRetry(3);
    console.log(`Extracted Value: ${extractedValue}`);

    // Save to Google Sheets
    console.log("Connecting to Google Sheets...");
    await doc.loadInfo();
    console.log(`Connected to Document: ${doc.title}`);

    const sheet = doc.sheetsByTitle["Report"];
    if (!sheet) {
      throw new Error(
        'Sheet tab "Report" not found. Please create it first in the Google Sheet.',
      );
    }

    // Load the specific cell B1
    await sheet.loadCells("B1");
    const b1Cell = sheet.getCellByA1("B1");

    // Update the cell value
    b1Cell.value = extractedValue;
    await sheet.saveUpdatedCells();
    console.log(
      `Successfully saved "${extractedValue}" to 'Report' sheet at B1.`,
    );
  } catch (error: any) {
    console.error(
      `[${new Date().toLocaleString()}] Error during scraping or saving:`,
      error?.message || error,
    );
  }
}

export function scheduleNepseScraper() {
  // Schedule the job to run at 11:01:00 and 16:05:00 (4:05 PM)
  const scheduleRuleMorning = "00 01 11 * * *";
  const scheduleRuleAfternoon = "0 05 16 * * *";

  schedule.scheduleJob(scheduleRuleMorning, async () => {
    try {
      await scrapeNepseAndSave();
    } catch (err: any) {
      console.error(`[${new Date().toLocaleString()}] Morning NEPSE job error:`, err?.message || err);
    }
  });

  schedule.scheduleJob(scheduleRuleAfternoon, async () => {
    try {
      await scrapeNepseAndSave();
    } catch (err: any) {
      console.error(`[${new Date().toLocaleString()}] Afternoon NEPSE job error:`, err?.message || err);
    }
  });

  console.log(
    `NEPSE scraper scheduled to run every day at ${scheduleRuleMorning} and ${scheduleRuleAfternoon}.`,
  );
}

// Execute standalone if this file is run directly
if (require.main === module) {
  scheduleNepseScraper();
  scrapeNepseAndSave().catch(console.error); // run once immediately for standalone test
}
