import { doc, initSheets, callWithRetry } from './googleSheetsService';
import { sendTelegramNotification } from './notificationService';
import { registerPendingHit } from './telegramBotService';

const HITS_SHEET_NAME = 'SL-TP-Hits';

export interface UnprocessedHit {
    rowIndex: number;
    uniqueId: string;
    symbol: string;
    kitta: string;
    purchasePrice: string;
    purchaseDate: string;
    st: string;
    tp: string;
    triggerEvent: string;
    triggeredAt: string;
    liveLtp: string;
    dayHigh: string;
    dayLow: string;
    pctChange: string;
    status: any;
    processedAt: string;
}

function escapeHtml(text: any): string {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Stage 3: Queue Mechanism & Telegram Notification (Node.js Service)
 * 
 * - Polls 'SL-TP-Hits' sheet tab every 30 seconds.
 * - When a new row is picked up (where Status is NOT true):
 *     1. Sends an instant formatted Telegram notification.
 *     2. Updates that row's Status column to TRUE.
 *     3. Adds a current datetime stamp to the Processed At column.
 */
export async function pollSLTPHitsQueue(): Promise<{ processedCount: number }> {
    try {
        await initSheets();
        const sheet = doc.sheetsByTitle[HITS_SHEET_NAME];
        if (!sheet) {
            // Sheet doesn't exist yet, nothing to poll
            return { processedCount: 0 };
        }

        const rows = await sheet.getRows();
        if (rows.length === 0) {
            return { processedCount: 0 };
        }

        const unprocessedRows: any[] = [];

        for (const row of rows) {
            const rawStatus = row.get('Status');
            const isProcessed = rawStatus === true || rawStatus === 'TRUE' || rawStatus === 'true' || rawStatus === 1;

            if (!isProcessed) {
                unprocessedRows.push(row);
            }
        }

        if (unprocessedRows.length === 0) {
            return { processedCount: 0 };
        }

        console.log(`📬 [SL-TP Queue] Found ${unprocessedRows.length} unnotified hit(s) in '${HITS_SHEET_NAME}'. Processing...`);

        let processedCount = 0;
        const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' });

        for (const row of unprocessedRows) {
            const uniqueId = String(row.get('Unique ID') || row.get('Symbol') || '').trim();
            const symbol = String(row.get('Symbol') || '').trim().toUpperCase();
            const kitta = String(row.get('kitta') || '0').trim();
            const purchasePrice = String(row.get('purchase price') || '0').trim();
            const purchaseDate = String(row.get('purchase date') || '').trim();
            const st = String(row.get('ST (Stop Loss)') || row.get('ST') || '').trim();
            const tp = String(row.get('TP (Take Profit)') || row.get('TP') || '').trim();
            const triggerEvent = String(row.get('Trigger Event') || 'TRIGGER HIT').trim();
            const triggeredAt = String(row.get('Triggered At') || nowStr).trim();
            const liveLtp = String(row.get('Live LTP') || '').trim();
            const dayHigh = String(row.get('Day High') || '').trim();
            const dayLow = String(row.get('Day Low') || '').trim();
            const pctChange = String(row.get('Day % Change') || '0').trim();

            // Format Telegram Notification Message
            const isSl = triggerEvent.toLowerCase().includes('stop loss') || triggerEvent.toLowerCase().includes('sl');
            const isTp = triggerEvent.toLowerCase().includes('take profit') || triggerEvent.toLowerCase().includes('tp');
            const icon = isSl && isTp ? '⚠️' : (isSl ? '🛑' : '🎯');

            // Determine target price for SELL order
            const tradePrice = (liveLtp && parseFloat(liveLtp) > 0)
                ? liveLtp
                : ((purchasePrice && parseFloat(purchasePrice) > 0) ? purchasePrice : '0');

            // Register hit for /proceed command support
            registerPendingHit({
                symbol,
                qty: kitta,
                price: tradePrice,
                uniqueId,
                timestamp: Date.now()
            });

            const message =
                `${icon} <b>NEPSE PORTFOLIO ALERT: ${escapeHtml(triggerEvent)}</b>\n\n` +
                `• <b>Stock:</b> <b>${escapeHtml(symbol)}</b> (${escapeHtml(kitta)} kitta @ Rs. ${escapeHtml(purchasePrice)})\n` +
                `• <b>Live LTP:</b> <b>${escapeHtml(liveLtp)}</b> (${pctChange.startsWith('-') ? '' : '+'}${escapeHtml(pctChange)}%)\n` +
                `• <b>Day Range:</b> Low ${escapeHtml(dayLow)} — High ${escapeHtml(dayHigh)}\n` +
                (st && parseFloat(st) > 0 ? `• <b>Stop Loss (ST):</b> ${escapeHtml(st)}${isSl ? ' 🚨 <i>BREACHED</i>' : ''}\n` : '') +
                (tp && parseFloat(tp) > 0 ? `• <b>Take Profit (TP):</b> ${escapeHtml(tp)}${isTp ? ' 🎯 <i>CROSSED</i>' : ''}\n` : '') +
                (purchaseDate && purchaseDate !== 'NODATE' ? `• <b>Purchase Date:</b> ${escapeHtml(purchaseDate)}\n` : '') +
                `• <b>Triggered At:</b> <i>${escapeHtml(triggeredAt)}</i>\n` +
                `• <b>Unique ID:</b> <code>${escapeHtml(uniqueId)}</code>\n\n` +
                `<i>Recorded in Google Sheet tab: '${escapeHtml(HITS_SHEET_NAME)}'</i>\n\n` +
                `👇 <b>Choose option proceed:</b>\n` +
                `Tap <b>Proceed</b> to place SELL order for <b>${escapeHtml(symbol)}</b> (${escapeHtml(kitta)} kitta @ Rs. ${escapeHtml(tradePrice)}) in <code>autoBuySellScript</code>.`;

            // Inline option menu with Proceed button
            const replyMarkup = {
                inline_keyboard: [
                    [
                        {
                            text: 'Proceed',
                            callback_data: `proceed_sell:${symbol}:${kitta}:${tradePrice}`
                        },
                        {
                            text: '❌ Dismiss',
                            callback_data: `dismiss_alert:${symbol}`
                        }
                    ]
                ]
            };

            // 1. Send instant Telegram Notification with Proceed option menu
            try {
                await sendTelegramNotification(message, replyMarkup);
            } catch (notifyErr: any) {
                console.error(`[SL-TP Queue] Telegram delivery error for ${symbol}:`, notifyErr.message);
            }

            // 2. Update Status to TRUE and Processed At timestamp
            try {
                row.set('Status', true);
                row.set('Processed At', nowStr);
                await callWithRetry(async () => {
                    await row.save();
                });
                processedCount++;
                console.log(`✅ [SL-TP Queue] Notified & Marked TRUE: ${uniqueId}`);
            } catch (saveErr: any) {
                console.error(`[SL-TP Queue] Failed to update row status for ${uniqueId}:`, saveErr.message);
            }
        }

        return { processedCount };
    } catch (err: any) {
        console.error('[SL-TP Queue] Polling loop error:', err.message);
        return { processedCount: 0 };
    }
}
