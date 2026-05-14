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

async function scrapeNepseAndSave() {
  console.log(`[${new Date().toLocaleString()}] Starting NEPSE scraper...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to https://www.nepalstock.com/ ...");
    await page.goto("https://www.nepalstock.com/", {
      waitUntil: "networkidle",
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
    console.log(`Extracted Value: ${extractedValue}`);

    // Save to Google Sheets
    console.log("Connecting to Google Sheets...");
    await doc.loadInfo();
    console.log(`Connected to Document: ${doc.title}`);

    const sheet = doc.sheetsByTitle["Report"];
    if (!sheet) {
      throw new Error(
        'Sheet tab "report" not found. Please create it first in the Google Sheet.',
      );
    }

    // Load the specific cell B2 (row index 1, column index 1)
    await sheet.loadCells("B1");
    const b2Cell = sheet.getCellByA1("B1");

    // Update the cell value
    b2Cell.value = extractedValue;
    await sheet.saveUpdatedCells();
    console.log(
      `Successfully saved "${extractedValue}" to 'report' sheet at B2.`,
    );
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString()}] Error during scraping or saving:`,
      error,
    );
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

export function scheduleNepseScraper() {
  // Schedule the job to run automatically every day at 11:05 AM
  const scheduleRule = "8 11 * * *";
  schedule.scheduleJob(scheduleRule, () => {
    scrapeNepseAndSave();
  });
  console.log(`NEPSE scraper scheduled to run every day at ${scheduleRule}.`);
}

// Execute standalone if this file is run directly
if (require.main === module) {
  scheduleNepseScraper();
  scrapeNepseAndSave(); // run once immediately for standalone test
}
