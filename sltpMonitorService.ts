import https from 'https';
import { doc, initSheets, callWithRetry } from './googleSheetsService';
import { pollSLTPHitsQueue } from './sltpQueueService';

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
    uniqueId: string;
    symbol: string;
    triggerType: 'SL HIT' | 'TP HIT' | 'BOTH HIT';
    triggerBadge: string;
    sl: number;
    tp: number;
    ltp: number;
    dayHigh: number;
    dayLow: number;
    pctChange: number;
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
const STOCKS_FILTER_SHEET_NAME = 'SLTP-stocks';
const HITS_ALERT_SHEET_NAME = 'SL-TP-Hits';

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
 * Generates a clean Unique ID: symbol-kitta-Purchase Price-Purchase date
 */
export function generateUniqueStockId(symbol: any, kitta: any, purchasePrice: any, purchaseDate: any): string {
    const cleanSym = String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanKitta = String(kitta || '0').trim().replace(/,/g, '');
    const cleanPrice = String(purchasePrice || '0').trim().replace(/,/g, '');
    const cleanDate = String(purchaseDate || 'NODATE').trim().replace(/[^A-Za-z0-9]/g, '-');
    return `${cleanSym}-${cleanKitta}-${cleanPrice}-${cleanDate}`;
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

// =============================================================================
// STAGE 1: Initial Stock Filter & Duplicate Prevention (yogen -> SLTP-stocks)
// =============================================================================

/**
 * Stage 1: Filters eligible stocks from 'yogen' (Row 6 onwards) with SL > 0 or TP > 0,
 * generates Unique ID, and syncs to 'SLTP-stocks' without duplicates.
 */
export async function syncYogenToSLTPStocks(): Promise<{ added: number; updated: number; total: number }> {
    await initSheets();
    const yogenSheet = doc.sheetsByTitle[YOGEN_SHEET_NAME];
    if (!yogenSheet) {
        console.error(`Sheet tab '${YOGEN_SHEET_NAME}' not found.`);
        return { added: 0, updated: 0, total: 0 };
    }

    // Get or Create 'SLTP-stocks' sheet
    let sltpStocksSheet = doc.sheetsByTitle[STOCKS_FILTER_SHEET_NAME];
    const headers = [
        'Unique ID',
        'Symbol',
        'Sector',
        'kitta',
        'share value',
        'total',
        'purchase price',
        'purchase total',
        'profit / loss',
        'purchase date',
        'count days',
        'profit or loss %',
        'ST (Stop Loss)',
        'TP (Take Profit)',
        'Last Synced'
    ];

    if (!sltpStocksSheet) {
        sltpStocksSheet = await doc.addSheet({
            title: STOCKS_FILTER_SHEET_NAME,
            headerValues: headers
        });
        console.log(`Created new sheet tab: '${STOCKS_FILTER_SHEET_NAME}'`);
    }

    const rowCount = yogenSheet.rowCount;
    if (rowCount < YOGEN_START_ROW) {
        return { added: 0, updated: 0, total: 0 };
    }

    const endRow = Math.min(rowCount, 200);
    await yogenSheet.loadCells(`A${YOGEN_START_ROW}:M${endRow}`);

    // Read existing Unique IDs in 'SLTP-stocks'
    const existingRows = await sltpStocksSheet.getRows();
    const existingMap = new Map<string, any>();
    for (const r of existingRows) {
        const uid = String(r.get('Unique ID') || '').trim();
        if (uid) existingMap.set(uid, r);
    }

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });
    let added = 0;
    let updated = 0;
    const rowsToAdd: any[] = [];

    for (let r = YOGEN_START_ROW - 1; r < endRow; r++) {
        const symVal = yogenSheet.getCell(r, 0).value;
        if (!symVal) continue;

        const symbol = String(symVal).trim().toUpperCase();
        if (!symbol || symbol === 'SYMBOL' || symbol === 'TOTAL') continue;

        const kitta = yogenSheet.getCell(r, 2).value ?? '0';
        const purchasePrice = yogenSheet.getCell(r, 5).value ?? '0';
        const purchaseDate = yogenSheet.getCell(r, 8).value ?? 'NODATE';

        const sl = parsePriceNum(yogenSheet.getCell(r, 11).value);
        const tp = parsePriceNum(yogenSheet.getCell(r, 12).value);

        // Filter: Must have SL > 0 or TP > 0
        if (sl <= 0 && tp <= 0) continue;

        const uniqueId = generateUniqueStockId(symbol, kitta, purchasePrice, purchaseDate);

        const rowData = {
            'Unique ID': uniqueId,
            'Symbol': symbol,
            'Sector': yogenSheet.getCell(r, 1).value ?? '',
            'kitta': kitta,
            'share value': yogenSheet.getCell(r, 3).value ?? '',
            'total': yogenSheet.getCell(r, 4).value ?? '',
            'purchase price': purchasePrice,
            'purchase total': yogenSheet.getCell(r, 6).value ?? '',
            'profit / loss': yogenSheet.getCell(r, 7).value ?? '',
            'purchase date': purchaseDate,
            'count days': yogenSheet.getCell(r, 9).value ?? '',
            'profit or loss %': yogenSheet.getCell(r, 10).value ?? '',
            'ST (Stop Loss)': sl,
            'TP (Take Profit)': tp,
            'Last Synced': timestamp
        };

        if (existingMap.has(uniqueId)) {
            // Update existing row
            const existingRow = existingMap.get(uniqueId);
            existingRow.set('share value', rowData['share value']);
            existingRow.set('total', rowData['total']);
            existingRow.set('profit / loss', rowData['profit / loss']);
            existingRow.set('profit or loss %', rowData['profit or loss %']);
            existingRow.set('ST (Stop Loss)', sl);
            existingRow.set('TP (Take Profit)', tp);
            existingRow.set('Last Synced', timestamp);
            await existingRow.save().catch(() => {});
            updated++;
        } else {
            // Append new row
            rowsToAdd.push(rowData);
            existingMap.set(uniqueId, rowData);
            added++;
        }
    }

    if (rowsToAdd.length > 0) {
        await sltpStocksSheet.addRows(rowsToAdd);
    }

    console.log(`✅ [Stage 1 Complete] 'SLTP-stocks' synced: ${added} added, ${updated} updated, ${existingMap.size} total.`);
    return { added, updated, total: existingMap.size };
}

// =============================================================================
// STAGE 2: Live Price Monitoring & Hit Detection (SLTP-stocks -> SL-TP-Hits)
// =============================================================================

/**
 * Stage 2: Compares 'SLTP-stocks' against live market data.
 * Records hit events into 'SL-TP-Hits' with Status = FALSE for Stage 3 queue pickup.
 */
export async function scanSLTPStocksAgainstLive(isScheduledRun = false): Promise<ScanSummary> {
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

    await initSheets();

    // 1. Ensure 'SLTP-stocks' is present and populated
    let sltpSheet = doc.sheetsByTitle[STOCKS_FILTER_SHEET_NAME];
    if (!sltpSheet) {
        console.log(`'${STOCKS_FILTER_SHEET_NAME}' not found. Running Stage 1 sync first...`);
        await syncYogenToSLTPStocks();
        sltpSheet = doc.sheetsByTitle[STOCKS_FILTER_SHEET_NAME];
        if (!sltpSheet) {
            return {
                success: false,
                scannedRows: 0,
                matchedStocks: 0,
                newTriggersCount: 0,
                triggers: [],
                timestamp,
                error: `Sheet '${STOCKS_FILTER_SHEET_NAME}' could not be initialized.`
            };
        }
    }

    const sltpRows = await sltpSheet.getRows();
    if (sltpRows.length === 0) {
        console.log(`'${STOCKS_FILTER_SHEET_NAME}' is empty. Running Stage 1 sync...`);
        await syncYogenToSLTPStocks();
    }

    const refreshedSltpRows = await sltpSheet.getRows();

    // 2. Fetch Live Market Data
    const liveMap = await getLiveMarketData();
    if (Object.keys(liveMap).length === 0) {
        return {
            success: false,
            scannedRows: 0,
            matchedStocks: 0,
            newTriggersCount: 0,
            triggers: [],
            timestamp,
            error: 'No live trading data available'
        };
    }

    // 3. Get or Create 'SL-TP-Hits' sheet
    let hitsSheet = doc.sheetsByTitle[HITS_ALERT_SHEET_NAME];
    const hitHeaders = [
        'Unique ID',
        'Symbol',
        'Sector',
        'kitta',
        'share value',
        'total',
        'purchase price',
        'purchase total',
        'profit / loss',
        'purchase date',
        'count days',
        'profit or loss %',
        'ST (Stop Loss)',
        'TP (Take Profit)',
        'Trigger Event',
        'Triggered At',
        'Live LTP',
        'Day High',
        'Day Low',
        'Day % Change',
        'Status',
        'Processed At'
    ];

    if (!hitsSheet) {
        hitsSheet = await doc.addSheet({
            title: HITS_ALERT_SHEET_NAME,
            headerValues: hitHeaders
        });
        console.log(`Created new sheet tab: '${HITS_ALERT_SHEET_NAME}'`);
    }

    // Read existing hits today to prevent duplicate rows
    const existingHitRows = await hitsSheet.getRows();
    const existingHitsToday = new Set<string>();
    for (const r of existingHitRows) {
        const uid = String(r.get('Unique ID') || '').trim();
        const trigAt = String(r.get('Triggered At') || '').trim();
        const trigEvent = String(r.get('Trigger Event') || '').trim();
        if (uid && isHitRecordedToday(trigAt, todayDateStr)) {
            const eventNorm = trigEvent.includes('BOTH') ? 'BOTH HIT' : (trigEvent.includes('STOP LOSS') ? 'SL HIT' : 'TP HIT');
            existingHitsToday.add(`${todayDateStr}_${uid}_${eventNorm}`);
        }
    }

    const newHitRows: any[] = [];
    const triggeredList: SLTPTriggerResult[] = [];
    let matchedCount = 0;

    for (const row of refreshedSltpRows) {
        const uniqueId = String(row.get('Unique ID') || '').trim();
        const symbol = String(row.get('Symbol') || '').trim().toUpperCase();
        if (!uniqueId || !symbol) continue;

        const sl = parsePriceNum(row.get('ST (Stop Loss)') || row.get('ST'));
        const tp = parsePriceNum(row.get('TP (Take Profit)') || row.get('TP'));

        if (sl <= 0 && tp <= 0) continue;

        const live = liveMap[symbol];
        if (!live) continue;
        matchedCount++;

        let isSlHit = false;
        let isTpHit = false;

        if (sl > 0 && live.low > 0 && live.low <= sl) isSlHit = true;
        if (tp > 0 && live.high > 0 && live.high >= tp) isTpHit = true;

        if (!isSlHit && !isTpHit) continue;

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

        const hitKey = `${todayDateStr}_${uniqueId}_${triggerType}`;
        if (existingHitsToday.has(hitKey)) continue;
        existingHitsToday.add(hitKey);

        const hitRow = {
            'Unique ID': uniqueId,
            'Symbol': symbol,
            'Sector': row.get('Sector') || '',
            'kitta': row.get('kitta') || '',
            'share value': row.get('share value') || '',
            'total': row.get('total') || '',
            'purchase price': row.get('purchase price') || '',
            'purchase total': row.get('purchase total') || '',
            'profit / loss': row.get('profit / loss') || '',
            'purchase date': row.get('purchase date') || '',
            'count days': row.get('count days') || '',
            'profit or loss %': row.get('profit or loss %') || '',
            'ST (Stop Loss)': sl,
            'TP (Take Profit)': tp,
            'Trigger Event': triggerBadge,
            'Triggered At': timestamp,
            'Live LTP': live.ltp,
            'Day High': live.high,
            'Day Low': live.low,
            'Day % Change': live.pctChange,
            'Status': false, // FALSE for Stage 3 queue pickup!
            'Processed At': ''
        };

        newHitRows.push(hitRow);
        triggeredList.push({
            uniqueId,
            symbol,
            triggerType,
            triggerBadge,
            sl,
            tp,
            ltp: live.ltp,
            dayHigh: live.high,
            dayLow: live.low,
            pctChange: live.pctChange,
            time: timestamp
        });

        console.log(`⚡ [Stage 2 Hit] ${uniqueId} -> LTP: ${live.ltp}, Low: ${live.low} (SL: ${sl}), High: ${live.high} (TP: ${tp})`);
    }

    if (newHitRows.length > 0) {
        await hitsSheet.addRows(newHitRows);
        console.log(`Appended ${newHitRows.length} hit row(s) to '${HITS_ALERT_SHEET_NAME}' with Status=FALSE.`);
    }

    // Immediately trigger Stage 3 Queue processing so any new hits are notified on Telegram
    await pollSLTPHitsQueue().catch(err => {
        console.error('Error during immediate Stage 3 queue flush:', err.message);
    });

    console.log(`✅ [Stage 2 Complete] Scanned ${refreshedSltpRows.length} stocks (${matchedCount} active). New hits: ${triggeredList.length}`);

    return {
        success: true,
        scannedRows: refreshedSltpRows.length,
        matchedStocks: matchedCount,
        newTriggersCount: triggeredList.length,
        triggers: triggeredList,
        timestamp
    };
}

/**
 * Backward compatibility alias for single entry point
 */
export async function scanPortfolioSLTP(isScheduledRun = false): Promise<ScanSummary> {
    await syncYogenToSLTPStocks();
    return scanSLTPStocksAgainstLive(isScheduledRun);
}

/**
 * Starts the automated 10-minute live scanner interval
 */
let sltpTimer: NodeJS.Timeout | null = null;

export function start10MinSLTPMonitor(): void {
    if (sltpTimer) return;

    console.log('⏰ [SL/TP Monitor] Starting automated 10-minute live scanner interval...');
    // Initial scan in 5 seconds
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

/**
 * Checks whether a Triggered At value corresponds to today's date
 */
function isHitRecordedToday(trigAt: string, todayIsoDateStr: string): boolean {
    if (!trigAt) return false;
    // Check ISO yyyy-MM-dd
    if (trigAt.includes(todayIsoDateStr)) return true;
    // Check M/D/YYYY or MM/DD/YYYY
    const parts = todayIsoDateStr.split('-');
    if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const y = parts[0];
        if (trigAt.includes(`${m}/${d}/${y}`) || trigAt.includes(`${parts[1]}/${parts[2]}/${y}`)) {
            return true;
        }
    }
    return false;
}

