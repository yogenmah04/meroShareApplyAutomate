import https from 'https';
import { doc, initSheets, callWithRetry } from './googleSheetsService';
import { sendTelegramNotification } from './notificationService';

export interface LiveStockData {
    symbol: string;
    ltp: number;
    pointChange: number;
    pctChange: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    prevClose: number;
}

export interface SLTPTriggerResult {
    symbol: string;
    triggerType: 'SL HIT' | 'TP HIT' | 'BOTH HIT';
    triggerBadge: string;
    sl: number;
    tp: number;
    ltp: number;
    dayHigh: number;
    dayLow: number;
    pctChange: number;
    rowValues: any[];
    time: string;
}

export interface ScanSummary {
    success: boolean;
    scannedRows: number;
    matchedStocks: number;
    newTriggersCount: number;
    triggers: SLTPTriggerResult[];
    timestamp: string;
    error?: string;
}

const YOGEN_SHEET_NAME = 'yogen';
const YOGEN_START_ROW = 6; // 1-indexed (Row 6)
const ALERT_SHEET_NAME = 'SL_TP_Hits';

/**
 * Checks if current market is open:
 * Reads 'Report' sheet tab cell B1.
 * If 'market close' (case-insensitive) is present, then market is closed.
 * Otherwise, it is open.
 */
export async function isNepseMarketOpen(): Promise<{ isOpen: boolean; statusText: string }> {
    try {
        await initSheets();
        const reportSheet = doc.sheetsByTitle['Report'];
        if (!reportSheet) {
            console.warn("Sheet tab 'Report' not found. Defaulting to market open.");
            return { isOpen: true, statusText: 'Report tab not found' };
        }

        await reportSheet.loadCells('B1');
        const cellValue = String(reportSheet.getCellByA1('B1').value || '').trim();
        const lower = cellValue.toLowerCase();

        // If "market close" is present then closed, otherwise open
        if (lower.includes('market close') || lower.includes('closed') || lower === 'close') {
            return { isOpen: false, statusText: cellValue || 'Market Close' };
        }

        return { isOpen: true, statusText: cellValue || 'Market Open' };
    } catch (err: any) {
        console.warn(`Error reading Report!B1: ${err.message}. Defaulting to market open.`);
        return { isOpen: true, statusText: 'Error reading Report!B1' };
    }
}

/**
 * Fetches HTML from ShareSansar Live Trading table using IPv4 priority
 */
function fetchShareSansarLiveHtml(): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = https.get('https://www.sharesansar.com/live-trading', {
            family: 4,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 25000
        }, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`ShareSansar returned HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('ShareSansar request timed out'));
        });
    });
}

/**
 * Parses ShareSansar live trading HTML table into LiveStockData map
 */
function parseLiveTradingTableHtml(html: string): { map: Record<string, LiveStockData>; rawRows: any[][] } {
    const tableRegex = /<table[^>]*id="headFixed"[^>]*>([\s\S]*?)<\/table>/i;
    const match = html.match(tableRegex);
    if (!match) {
        throw new Error('Live trading table #headFixed not found in HTML response');
    }

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[] = [];
    let trMatch;
    while ((trMatch = trRegex.exec(match[1])) !== null) {
        rows.push(trMatch[1]);
    }

    const map: Record<string, LiveStockData> = {};
    const rawRows: any[][] = [];

    // Header row
    rawRows.push(['S.No', 'Symbol', 'LTP', 'Point Change', '% Change', 'Open', 'High', 'Low', 'Volume', 'Prev. Close']);

    for (let i = 1; i < rows.length; i++) {
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells: string[] = [];
        let tdMatch;
        while ((tdMatch = cellRegex.exec(rows[i])) !== null) {
            const cleanText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
            cells.push(cleanText);
        }

        if (cells.length >= 8) {
            const symbol = cells[1]?.trim().toUpperCase();
            if (!symbol || symbol === 'SYMBOL') continue;

            const ltp = parsePriceNum(cells[2]);
            const ptChange = parsePriceNum(cells[3]);
            const pctChange = parsePriceNum(cells[4]);
            const open = parsePriceNum(cells[5]);
            const high = parsePriceNum(cells[6]);
            const low = parsePriceNum(cells[7]);
            const volume = parsePriceNum(cells[8]);
            const prevClose = parsePriceNum(cells[9]);

            map[symbol] = {
                symbol,
                ltp,
                pointChange: ptChange,
                pctChange,
                open,
                high,
                low,
                volume,
                prevClose
            };

            rawRows.push([
                cells[0] || (rawRows.length).toString(),
                symbol,
                ltp,
                ptChange,
                pctChange,
                open,
                high,
                low,
                volume,
                prevClose
            ]);
        }
    }

    return { map, rawRows };
}

/**
 * Helper to parse prices removing commas and non-numeric chars
 */
function parsePriceNum(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Gets live market data: attempts live fetch first, falls back to 'live trading' sheet tab
 */
export async function getLiveMarketData(): Promise<Record<string, LiveStockData>> {
    try {
        console.log('Fetching live trading data from ShareSansar...');
        const html = await fetchShareSansarLiveHtml();
        const { map, rawRows } = parseLiveTradingTableHtml(html);

        if (Object.keys(map).length > 0) {
            console.log(`Live data fetched: ${Object.keys(map).length} stocks from ShareSansar.`);
            
            // Sync freshly fetched data to 'live trading' tab in Google Sheets in background
            syncLiveTradingSheet(rawRows).catch(err => {
                console.warn('Background sync to live trading sheet tab failed:', err.message);
            });

            return map;
        }
    } catch (fetchErr: any) {
        console.warn(`Direct ShareSansar live fetch failed (${fetchErr.message}). Falling back to 'live trading' sheet tab...`);
    }

    // Fallback: Read from Google Sheets 'live trading' sheet tab
    return readLiveTradingFromSheet();
}

/**
 * Reads live data from the 'live trading' sheet tab
 */
async function readLiveTradingFromSheet(): Promise<Record<string, LiveStockData>> {
    await initSheets();
    const sheet = doc.sheetsByTitle['live trading'];
    if (!sheet) {
        console.warn('Sheet tab "live trading" not found in Google Sheets.');
        return {};
    }

    const rows = await sheet.getRows();
    const map: Record<string, LiveStockData> = {};

    for (const r of rows) {
        const raw = (r as any)._rawData || [];
        const symbol = String(r.get('Symbol') || raw[1] || '').trim().toUpperCase();
        if (!symbol || symbol === 'SYMBOL') continue;

        const ltp = parsePriceNum(r.get('LTP') || raw[2]);
        const ptChange = parsePriceNum(r.get('Point Change') || raw[3]);
        const pctChange = parsePriceNum(r.get('% Change') || raw[4]);
        const open = parsePriceNum(r.get('Open') || raw[5]);
        const high = parsePriceNum(r.get('High') || raw[6]);
        const low = parsePriceNum(r.get('Low') || raw[7]);
        const volume = parsePriceNum(r.get('Volume') || raw[8]);
        const prevClose = parsePriceNum(r.get('Prev. Close') || raw[9]);

        map[symbol] = {
            symbol,
            ltp,
            pointChange: ptChange,
            pctChange,
            open,
            high,
            low,
            volume,
            prevClose
        };
    }

    console.log(`Loaded ${Object.keys(map).length} stocks from 'live trading' sheet tab.`);
    return map;
}

/**
 * Overrides the 'live trading' sheet tab with newly fetched data
 */
async function syncLiveTradingSheet(rawRows: any[][]): Promise<void> {
    await callWithRetry(async () => {
        await initSheets();
        let sheet = doc.sheetsByTitle['live trading'];
        if (!sheet) {
            sheet = await doc.addSheet({ title: 'live trading' });
        }

        // Prepare rows (excluding header row)
        const header = rawRows[0];
        const dataRows = rawRows.slice(1).map(r => ({
            'S.No': r[0],
            'Symbol': r[1],
            'LTP': r[2],
            'Point Change': r[3],
            '% Change': r[4],
            'Open': r[5],
            'High': r[6],
            'Low': r[7],
            'Volume': r[8],
            'Prev. Close': r[9]
        }));

        await sheet.clear();
        await sheet.setHeaderRow(header);

        const chunkSize = 100;
        for (let i = 0; i < dataRows.length; i += chunkSize) {
            const chunk = dataRows.slice(i, i + chunkSize);
            await sheet.addRows(chunk);
        }
    });
}

/**
 * Gets or creates the 'SL_TP_Hits' sheet tab with formatted headers
 */
async function getOrCreateAlertSheet(): Promise<any> {
    await initSheets();
    let alertSheet = doc.sheetsByTitle[ALERT_SHEET_NAME];
    if (alertSheet) return alertSheet;

    const headers = [
        'Symbol',
        'Sector',
        'Kitta',
        'Share Value',
        'Total',
        'Purchase Price',
        'Purchase Total',
        'Profit/Loss',
        'Date',
        'Days',
        'Profit %',
        'Stop Loss (ST)',
        'Take Profit (TP)',
        'Trigger Event',
        'Triggered At',
        'Live LTP',
        'Day High',
        'Day Low',
        'Day % Change'
    ];

    alertSheet = await doc.addSheet({
        title: ALERT_SHEET_NAME,
        headerValues: headers
    });

    console.log(`Created new sheet tab: '${ALERT_SHEET_NAME}'`);
    return alertSheet;
}

/**
 * Returns existing hit keys logged today in 'SL_TP_Hits' to prevent duplicate alerts
 */
async function getExistingHitsToday(alertSheet: any, todayDateStr: string): Promise<Record<string, boolean>> {
    const map: Record<string, boolean> = {};
    try {
        const rows = await alertSheet.getRows();
        for (const r of rows) {
            const raw = (r as any)._rawData || [];
            const sym = String(r.get('Symbol') || raw[0] || '').trim().toUpperCase();
            const triggerEvent = String(r.get('Trigger Event') || raw[13] || '').trim();
            const trigAt = String(r.get('Triggered At') || raw[14] || '').trim();

            if (sym && trigAt.includes(todayDateStr)) {
                const eventNorm = triggerEvent.includes('BOTH') ? 'BOTH HIT' : (triggerEvent.includes('SL') ? 'SL HIT' : 'TP HIT');
                const key = `${todayDateStr}_${sym}_${eventNorm}`;
                map[key] = true;
            }
        }
    } catch (_) {}
    return map;
}

/**
 * Main SL & TP Scanner Function
 * 
 * - Reads 'yogen' sheet tab starting from row index 6 (1-based)
 * - Col A: Symbol, Col L: Stop Loss (ST), Col M: Take Profit (TP)
 * - Matches against Live Market Data:
 *     - Only processes rows present in live data (otherwise discards)
 *     - Discards rows where both SL and TP are empty / <= 0
 *     - Triggers SL if Day Low <= ST
 *     - Triggers TP if Day High >= TP
 * - Logs triggered rows (Cols A to M + trigger metadata) to 'SL_TP_Hits'
 * - Sends instant Telegram notification
 */
export async function scanPortfolioSLTP(isScheduledRun = false): Promise<ScanSummary> {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
    const todayDateStr = new Date().toISOString().split('T')[0];

    // Market open guard for scheduled automated runs: check Report!B1
    if (isScheduledRun) {
        const marketStatus = await isNepseMarketOpen();
        if (!marketStatus.isOpen) {
            console.log(`[SL/TP Monitor] 'Report'!B1 says '${marketStatus.statusText}'. Market is closed at ${timestamp}. Skipping scheduled scan.`);
            return {
                success: true,
                scannedRows: 0,
                matchedStocks: 0,
                newTriggersCount: 0,
                triggers: [],
                timestamp,
                error: `Market Closed (${marketStatus.statusText})`
            };
        }
        console.log(`[SL/TP Monitor] 'Report'!B1 says '${marketStatus.statusText}'. Proceeding with live scan.`);
    }

    console.log(`🔍 [SL/TP Monitor] Starting scan for 'yogen' sheet at ${timestamp}...`);

    await initSheets();
    const yogenSheet = doc.sheetsByTitle[YOGEN_SHEET_NAME];
    if (!yogenSheet) {
        const err = `Sheet tab '${YOGEN_SHEET_NAME}' not found in Google Sheets.`;
        console.error(err);
        return {
            success: false,
            scannedRows: 0,
            matchedStocks: 0,
            newTriggersCount: 0,
            triggers: [],
            timestamp,
            error: err
        };
    }

    // 1. Fetch Live Market Data
    const liveMap = await getLiveMarketData();
    if (Object.keys(liveMap).length === 0) {
        const err = 'No live trading data could be obtained. Aborting SL/TP scan.';
        console.error(err);
        return {
            success: false,
            scannedRows: 0,
            matchedStocks: 0,
            newTriggersCount: 0,
            triggers: [],
            timestamp,
            error: err
        };
    }

    // 2. Read 'yogen' sheet: Row 6 onwards (offset 5 from start, Row 5 is header)
    // We load cells for rows 6..lastRow, cols 0..12 (Cols A to M)
    const rowCount = yogenSheet.rowCount;
    if (rowCount < YOGEN_START_ROW) {
        return {
            success: true,
            scannedRows: 0,
            matchedStocks: 0,
            newTriggersCount: 0,
            triggers: [],
            timestamp
        };
    }

    // Load cells from Row 6 (0-indexed row 5) to rowCount (capped at 200 for speed)
    const endRow = Math.min(rowCount, 200);
    await yogenSheet.loadCells(`A${YOGEN_START_ROW}:M${endRow}`);

    // 3. Prepare Target Sheet 'SL_TP_Hits'
    const alertSheet = await getOrCreateAlertSheet();
    const existingHits = await getExistingHitsToday(alertSheet, todayDateStr);

    const triggeredList: SLTPTriggerResult[] = [];
    const rowsToAppend: any[] = [];
    const telegramAlertLines: string[] = [];
    let matchedCount = 0;
    let validRowsScanned = 0;

    for (let r = YOGEN_START_ROW - 1; r < endRow; r++) {
        const rawSym = yogenSheet.getCell(r, 0).value;
        if (!rawSym) continue;

        const symbol = String(rawSym).trim().toUpperCase();
        if (!symbol || symbol === 'SYMBOL' || symbol === 'TOTAL') continue;
        validRowsScanned++;

        // Col L (index 11): Stop Loss (ST)
        const sl = parsePriceNum(yogenSheet.getCell(r, 11).value);
        // Col M (index 12): Take Profit (TP)
        const tp = parsePriceNum(yogenSheet.getCell(r, 12).value);

        // Discard row if both SL and TP are not set (> 0)
        if (sl <= 0 && tp <= 0) {
            continue;
        }

        // Discard if symbol is not present in live data
        const live = liveMap[symbol];
        if (!live) {
            continue;
        }
        matchedCount++;

        let isSlHit = false;
        let isTpHit = false;

        // Condition 1: SL hit day low (Day Low <= SL)
        if (sl > 0 && live.low > 0 && live.low <= sl) {
            isSlHit = true;
        }

        // Condition 2: TP hit / crossed day high (Day High >= TP)
        if (tp > 0 && live.high > 0 && live.high >= tp) {
            isTpHit = true;
        }

        if (!isSlHit && !isTpHit) {
            continue;
        }

        // Determine Trigger Type
        let triggerType: 'SL HIT' | 'TP HIT' | 'BOTH HIT' = 'SL HIT';
        let triggerBadge = '';
        if (isSlHit && isTpHit) {
            triggerType = 'BOTH HIT';
            triggerBadge = '⚠️ SL & TP BOTH HIT';
        } else if (isSlHit) {
            triggerType = 'SL HIT';
            triggerBadge = '🛑 STOP LOSS HIT (Low <= SL)';
        } else if (isTpHit) {
            triggerType = 'TP HIT';
            triggerBadge = '🎯 TAKE PROFIT HIT (High >= TP)';
        }

        // Deduplication check
        const hitKey = `${todayDateStr}_${symbol}_${triggerType}`;
        if (existingHits[hitKey]) {
            // Already logged today
            continue;
        }
        existingHits[hitKey] = true;

        // Read original row values (Cols A to M)
        const rowValues: any[] = [];
        for (let c = 0; c < 13; c++) {
            rowValues.push(yogenSheet.getCell(r, c).value ?? '');
        }

        // Form full alert row
        const alertRow = [
            ...rowValues,
            triggerBadge,
            timestamp,
            live.ltp,
            live.high,
            live.low,
            live.pctChange
        ];

        rowsToAppend.push(alertRow);

        const triggerItem: SLTPTriggerResult = {
            symbol,
            triggerType,
            triggerBadge,
            sl,
            tp,
            ltp: live.ltp,
            dayHigh: live.high,
            dayLow: live.low,
            pctChange: live.pctChange,
            rowValues,
            time: timestamp
        };
        triggeredList.push(triggerItem);

        // Telegram Message snippet
        telegramAlertLines.push(
            (isSlHit && isTpHit ? '⚠️' : (isSlHit ? '🛑' : '🎯')) +
            ` <b>${symbol} ${triggerType}</b>\n` +
            `• <b>LTP:</b> ${live.ltp} (${live.pctChange >= 0 ? '+' : ''}${live.pctChange}%)\n` +
            `• <b>Day Range:</b> Low ${live.low} — High ${live.high}\n` +
            (sl > 0 ? `• <b>Stop Loss (Col L):</b> ${sl}${isSlHit ? ' 🚨 <i>BREACHED</i>' : ''}\n` : '') +
            (tp > 0 ? `• <b>Take Profit (Col M):</b> ${tp}${isTpHit ? ' 🎯 <i>CROSSED</i>' : ''}\n` : '') +
            `• <b>Time:</b> <i>${timestamp}</i>`
        );

        console.log(`⚡ [${triggerType}] ${symbol} -> LTP: ${live.ltp}, Low: ${live.low} (SL: ${sl}), High: ${live.high} (TP: ${tp})`);
    }

    // 4. Append new triggered rows to 'SL_TP_Hits' sheet tab
    if (rowsToAppend.length > 0) {
        await callWithRetry(async () => {
            const rawRowsMapped = rowsToAppend.map(r => ({
                'Symbol': r[0],
                'Sector': r[1],
                'Kitta': r[2],
                'Share Value': r[3],
                'Total': r[4],
                'Purchase Price': r[5],
                'Purchase Total': r[6],
                'Profit/Loss': r[7],
                'Date': r[8],
                'Days': r[9],
                'Profit %': r[10],
                'Stop Loss (ST)': r[11],
                'Take Profit (TP)': r[12],
                'Trigger Event': r[13],
                'Triggered At': r[14],
                'Live LTP': r[15],
                'Day High': r[16],
                'Day Low': r[17],
                'Day % Change': r[18]
            }));
            await alertSheet.addRows(rawRowsMapped);
        });
        console.log(`Appended ${rowsToAppend.length} triggered row(s) to '${ALERT_SHEET_NAME}'.`);
    }

    // 5. Send Telegram notification if new triggers occurred
    if (telegramAlertLines.length > 0) {
        const header = `🚨 <b>NEPSE PORTFOLIO ALERT: SL/TP TRIGGERED ('yogen')</b>\n\n`;
        const footer = `\n\n<i>Logged to Google Sheet tab '${ALERT_SHEET_NAME}'</i>`;
        const fullMessage = header + telegramAlertLines.join('\n\n───────────────\n\n') + footer;
        await sendTelegramNotification(fullMessage).catch(err => {
            console.error('Failed to dispatch Telegram SL/TP alert:', err.message);
        });
    }

    console.log(`✅ [SL/TP Scan Finished] Scanned ${validRowsScanned} rows (${matchedCount} with active SL/TP). New triggers: ${triggeredList.length}`);

    return {
        success: true,
        scannedRows: validRowsScanned,
        matchedStocks: matchedCount,
        newTriggersCount: triggeredList.length,
        triggers: triggeredList,
        timestamp
    };
}

/**
 * Starts the automated 10-minute SL/TP Live Monitor scheduler
 */
let sltpTimer: NodeJS.Timeout | null = null;

export function start10MinSLTPMonitor(): void {
    if (sltpTimer) return;

    console.log('⏰ [SL/TP Monitor] Starting automated 10-minute live scanner interval...');
    // Run initial scan in 5 seconds
    setTimeout(() => {
        scanPortfolioSLTP(true).catch(e => console.error('[SL/TP Monitor] Initial scan error:', e.message));
    }, 5000);

    // Schedule every 10 minutes (600,000 ms)
    sltpTimer = setInterval(() => {
        scanPortfolioSLTP(true).catch(e => console.error('[SL/TP Monitor] Scheduled scan error:', e.message));
    }, 10 * 60 * 1000);
}

export function stop10MinSLTPMonitor(): void {
    if (sltpTimer) {
        clearInterval(sltpTimer);
        sltpTimer = null;
        console.log('[SL/TP Monitor] 10-minute scanner stopped.');
    }
}
