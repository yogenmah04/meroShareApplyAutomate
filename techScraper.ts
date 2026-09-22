import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { overrideTechnicalSignalsData, initSheets } from './googleSheetsService';
import { getRandomUserAgent, launchBrowserWithViewMode, jitterSleep } from './humanUtils';

// Initialize stealth plugin
chromium.use(StealthPlugin());
dotenv.config();

export async function scrapeTechnicalSignals() {
  console.log('Starting technical signals scrape from Nepse Alpha...');

  const browser = await launchBrowserWithViewMode(chromium);
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Nepse Alpha technical signals...');
    await page.goto('https://nepsealpha.com/trading-signals/tech', { waitUntil: 'networkidle' });
    console.log('Page loaded. Waiting for signals table...');

    // Wait for the data table container
    await page.waitForSelector('table.dataTable, #funda-table', { timeout: 25000 });
    await jitterSleep(2000, 3000);

    // Extract headers from the table or its fixed header clone
    const headerLocators = page.locator('table.dataTable thead th, #funda-table thead th');
    const allHeaders: string[] = await headerLocators.allInnerTexts().catch(() => []);
    // Deduplicate or take unique headers
    const headers: string[] = allHeaders.filter((h: string, idx: number) => allHeaders.indexOf(h) === idx && h.trim().length > 0);
    console.log('Detected headers:', headers);

    let symbolCol = headers.findIndex((h: string) => /^symbol/i.test(h.trim()));
    let signalCol = headers.findIndex((h: string) => /technical summary|signal/i.test(h.trim()));
    let rsiCol = headers.findIndex((h: string) => /rsi/i.test(h.trim()));

    // Intelligent defaults if header names shift
    if (symbolCol === -1) symbolCol = 0;
    if (signalCol === -1) signalCol = 1;
    if (rsiCol === -1) rsiCol = 9;

    console.log(`Using column indices -> Symbol: ${symbolCol}, Signal: ${signalCol}, RSI: ${rsiCol}`);

    // Try selecting 100 entries per page if dropdown exists
    const lengthSelect = page.locator('select[name*="length"], select[name*="funda-table"]').first();
    if (await lengthSelect.isVisible().catch(() => false)) {
      const options = await lengthSelect.locator('option').allInnerTexts().catch(() => []);
      if (options.length > 0) {
        await lengthSelect.selectOption({ index: options.length - 1 }).catch(() => {});
        console.log('Selected maximum page entries.');
        await jitterSleep(2000, 3000);
      }
    }

    // Locate the table holding tbody rows
    const tables = await page.locator('table.dataTable, #funda-table').all();
    let targetTable = null;
    for (const tbl of tables) {
      const rowCount = await tbl.locator('tbody tr').count();
      if (rowCount > 0) {
        targetTable = tbl;
        break;
      }
    }

    if (!targetTable) {
      targetTable = page.locator('#funda-table, table.dataTable').first();
    }

    const rowLocators = await targetTable.locator('tbody tr').all();
    console.log(`Found ${rowLocators.length} rows in signals table.`);

    const signals: { symbol: string; signal: string; rsi: string }[] = [];

    for (const row of rowLocators) {
      const cells = await row.locator('td').allInnerTexts().catch(() => []);
      if (cells.length > Math.max(symbolCol, signalCol)) {
        const symbol = (cells[symbolCol] || '').trim();
        const signal = (cells[signalCol] || '').trim();
        const rsi = (cells[rsiCol] || '').trim();

        if (symbol && !/no data|total/i.test(symbol)) {
          signals.push({ symbol, signal, rsi });
        }
      }
    }

    console.log(`Extracted ${signals.length} technical signals.`);
    if (signals.length > 0) {
      console.log('Sample signal:', signals[0]);
    }

    const outPath = path.resolve(__dirname, 'technicalSignals.json');
    fs.writeFileSync(outPath, JSON.stringify(signals, null, 2));
    console.log(`Saved local signals to ${outPath}`);

    if (signals.length > 0) {
      console.log('Syncing technical signals to Google Sheets...');
      try {
        await initSheets();
        await overrideTechnicalSignalsData(signals);
        console.log('Successfully synced technical signals to Google Sheets tab "TechnicalSignals".');
      } catch (sheetErr: any) {
        console.error('Failed to sync technical signals to Google Sheets:', sheetErr?.message || sheetErr);
      }
    }

    return signals;

  } catch (error) {
    console.error('An error occurred during technical signals scraping:', error);
    throw error;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  scrapeTechnicalSignals().catch(console.error);
}
