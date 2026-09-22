import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { override52WeekData, initSheets, Week52Record } from './googleSheetsService';
import { sendTelegramNotification } from './notificationService';
import { getRandomUserAgent, launchBrowserWithViewMode, jitterSleep, ensureDesktopDisplay } from './humanUtils';

// Initialize stealth plugin and environment
chromium.use(StealthPlugin());
dotenv.config();
ensureDesktopDisplay();

/**
 * Helper to parse price and date from cells like:
 * "NPR 1,295.00\n2026-03-23 (चैत्र ९)"
 */
function parsePriceAndDate(text: string): { price: string; date: string } {
  if (!text) return { price: '', date: '' };
  
  const priceMatch = text.match(/NPR\s*([0-9,]+(?:\.[0-9]+)?)/i);
  const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
  
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  return { price, date };
}

/**
 * Extracts all rows for a given tab pane with DataTables pagination
 */
async function extractTabStocks(
  page: any,
  paneId: string,
  tabHref: string,
  category: '52 Week High' | '52 Week Low'
): Promise<Week52Record[]> {
  console.log(`[52-Week Scraper] Switching to tab: ${category} (pane: ${paneId})...`);
  
  // 1. Click tab
  const tabLocator = page.locator(`a[href="${tabHref}"]`);
  await tabLocator.click().catch(() => {});
  await jitterSleep(1500, 2000);

  const pane = page.locator(`[id="${paneId}"]`);
  await pane.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

  // 2. Select 100 entries per page if dropdown exists
  const lengthSelect = pane.locator('select[name*="length"]');
  if (await lengthSelect.isVisible().catch(() => false)) {
    console.log(`[52-Week Scraper] Setting page length to 100 for ${category}...`);
    await lengthSelect.selectOption('100').catch(async () => {
      await lengthSelect.selectOption({ index: 3 }).catch(() => {});
    });
    await jitterSleep(2000, 3000);
  }

  const records: Week52Record[] = [];
  let pageIndex = 1;

  while (true) {
    const rows = await pane.locator('tbody tr').all();
    console.log(`[52-Week Scraper] ${category} - Parsing Page ${pageIndex} (${rows.length} rows)...`);

    for (const row of rows) {
      const cells = await row.locator('td').allInnerTexts().catch(() => []);
      if (cells.length >= 5) {
        const symbol = (cells[0] || '').trim();
        if (!symbol || /no data|loading/i.test(symbol)) continue;

        const ltp = (cells[1] || '').trim().replace(/NPR\s*/i, '').replace(/,/g, '');
        
        // Col 2: 52 Week Low
        const lowInfo = parsePriceAndDate(cells[2] || '');
        // Col 3: 52 Week High
        const highInfo = parsePriceAndDate(cells[3] || '');
        // Col 4: Price Relative to 52 Week Range
        const rangePercent = (cells[4] || '').trim();

        records.push({
          category,
          symbol,
          ltp,
          highPrice: highInfo.price,
          highDate: highInfo.date,
          lowPrice: lowInfo.price,
          lowDate: lowInfo.date,
          rangePercent,
          updatedAt: new Date().toLocaleString(),
        });
      }
    }

    // 3. Check for next page button
    const nextBtn = pane.locator('.paginate_button.next');
    const isNextVisible = await nextBtn.isVisible().catch(() => false);
    const isNextDisabled = await nextBtn.evaluate((el: any) => el.classList.contains('disabled')).catch(() => true);

    if (isNextVisible && !isNextDisabled) {
      pageIndex++;
      console.log(`[52-Week Scraper] Clicking Next for ${category} (Page ${pageIndex})...`);
      await nextBtn.click();
      await jitterSleep(1500, 2500);
    } else {
      break;
    }
  }

  console.log(`[52-Week Scraper] Completed ${category}: ${records.length} total records.`);
  return records;
}

export async function scrape52WeekHighLow(): Promise<Week52Record[]> {
  console.log('Starting 52-Week High & Low Stock Scraper from Nepse Alpha...');

  const browser = await launchBrowserWithViewMode(chromium);
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: { width: 1366, height: 768 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Nepse Alpha 52-Week High/Low page...');
    await page.goto('https://nepsealpha.com/52-wks-hi-low', { waitUntil: 'networkidle', timeout: 45000 });
    console.log('Page loaded. Waiting for tab elements...');

    await page.waitForSelector('.nav-tabs a, [id="52_wks_high"]', { timeout: 25000 });
    await jitterSleep(2000, 3000);

    // 1. Scrape 52-Week High stocks
    const highStocks = await extractTabStocks(
      page,
      '52_wks_high',
      '#52_wks_high',
      '52 Week High'
    );

    // 2. Scrape 52-Week Low stocks
    const lowStocks = await extractTabStocks(
      page,
      '52_wks_low',
      '#52_wks_low',
      '52 Week Low'
    );

    const allStocks: Week52Record[] = [...highStocks, ...lowStocks];
    console.log(`[52-Week Scraper] Total stocks extracted: ${allStocks.length} (${highStocks.length} Highs, ${lowStocks.length} Lows).`);

    // 3. Save local JSON backup
    const outPath = path.resolve(__dirname, 'week52_high_low.json');
    fs.writeFileSync(outPath, JSON.stringify(allStocks, null, 2));
    console.log(`Saved 52-week stock data locally to ${outPath}`);

    // 4. Synchronize with Google Sheets
    if (allStocks.length > 0) {
      console.log('Syncing 52-week stock data to Google Sheets (tab "52WeekHighLow")...');
      try {
        await initSheets();
        await override52WeekData(allStocks);
        console.log('Successfully updated Google Sheet tab "52WeekHighLow"!');

        // 5. Send Telegram notification
        const topHighs = highStocks.slice(0, 5).map(s => `${s.symbol} (LTP: ${s.ltp})`).join(', ');
        const topLows = lowStocks.slice(0, 5).map(s => `${s.symbol} (LTP: ${s.ltp})`).join(', ');

        await sendTelegramNotification(
          `📊 <b>52-Week High & Low Stocks Updated</b>\n\n` +
          `• <b>Total Records:</b> ${allStocks.length}\n` +
          `• <b>52-Week Highs:</b> ${highStocks.length} stocks\n` +
          `• <b>52-Week Lows:</b> ${lowStocks.length} stocks\n\n` +
          `🔼 <b>Sample Highs:</b> <code>${topHighs || 'None'}</code>\n` +
          `🔽 <b>Sample Lows:</b> <code>${topLows || 'None'}</code>\n\n` +
          `✅ <i>Google Sheet tab <code>52WeekHighLow</code> has been updated.</i>`
        ).catch(() => {});

      } catch (sheetErr: any) {
        console.error('Failed to sync 52-week data to Google Sheets:', sheetErr?.message || sheetErr);
        throw sheetErr;
      }
    }

    return allStocks;

  } catch (error) {
    console.error('An error occurred during 52-week stock scraping:', error);
    throw error;
  } finally {
    console.log('Closing browser session...');
    await browser.close().catch(() => {});
  }
}

// Support direct execution via CLI
if (require.main === module) {
  scrape52WeekHighLow().catch((err) => {
    console.error('Execution failed:', err);
    process.exit(1);
  });
}
