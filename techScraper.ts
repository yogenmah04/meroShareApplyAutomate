import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { overrideTechnicalSignalsData } from './googleSheetsService';

// Initialize stealth plugin
chromium.use(StealthPlugin());
dotenv.config();

export async function scrapeTechnicalSignals() {
  console.log('Starting technical signals scrape from Nepse Alpha...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    await page.goto('https://nepsealpha.com/trading-signals/tech', { waitUntil: 'networkidle' });
    console.log('Page loaded. Extracting signals...');

    // Wait for the data table to load
    await page.waitForSelector('table.table', { timeout: 15000 });

    const signals = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.table tbody tr');
        const data: any[] = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                const symbol = cells[0].textContent?.trim();
                const signal = cells[1].textContent?.trim();
                const rsi = cells[2].textContent?.trim(); // assuming column 2 is RSI
                // Note: columns might vary based on actual Nepse Alpha DOM
                if (symbol) {
                    data.push({ symbol, signal, rsi });
                }
            }
        });
        return data;
    });

    console.log(`Extracted ${signals.length} technical signals.`);

    const outPath = path.resolve(__dirname, 'technicalSignals.json');
    fs.writeFileSync(outPath, JSON.stringify(signals, null, 2));

    if (signals.length > 0) {
        console.log('Syncing technical signals to Google Sheets...');
        await overrideTechnicalSignalsData(signals);
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
