import * as dotenv from 'dotenv';
import https from 'https';
import { initSheets, getControlCommand, fetchUsersFromSheet, fetchStocksFromSheet, addResultToSheet, overrideSheetData } from './googleSheetsService';
import { runCheckStatus, formatShortError } from './checkStatus';
import { sendTelegramNotification } from './notificationService';
import { ensureDesktopDisplay } from './humanUtils';

dotenv.config();
ensureDesktopDisplay();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() || '';

let isPolling = false;
let isBusy = false;
let activeTaskName = '';
let lastUpdateId = 0;

/**
 * Low-level Telegram Bot API request using IPv4 priority
 */
function telegramApi(method: string, payload: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!BOT_TOKEN) {
            return reject(new Error('TELEGRAM_BOT_TOKEN is not configured in .env'));
        }

        const postData = JSON.stringify(payload);
        const req = https.request({
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${BOT_TOKEN}/${method}`,
            method: 'POST',
            family: 4, // Force IPv4 to prevent Linux IPv6 network dropouts
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 35000
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json);
                } catch (e) {
                    resolve({ ok: false, error: `Invalid JSON from Telegram: ${body.slice(0, 100)}` });
                }
            });
        });

        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, error: 'Request timed out' });
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Sends a formatted Telegram message
 */
export async function sendTelegramMessage(text: string, replyMarkup?: any, chatId: string = AUTHORIZED_CHAT_ID): Promise<boolean> {
    const payload: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
    };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    const res = await telegramApi('sendMessage', payload);
    return res && res.ok === true;
}

/**
 * Acknowledges callback queries from button clicks to dismiss loading spinners
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text: text || 'Executing command...'
    }).catch(() => {});
}

/**
 * Interactive Command Center Inline Keyboard
 */
export function getCommandCenterKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '📋 Check IPO Status', callback_data: 'cmd_check_status' },
                { text: '💼 Scrape Portfolio', callback_data: 'cmd_portfolio' }
            ],
            [
                { text: '📈 52-Week High/Low', callback_data: 'cmd_52week' },
                { text: '🔓 Promoter Lock-in', callback_data: 'cmd_promoter' }
            ],
            [
                { text: '📊 Fundamental Data', callback_data: 'cmd_funda' },
                { text: '⚡ Technical Signals', callback_data: 'cmd_tech' }
            ],
            [
                { text: '👥 List Active Users', callback_data: 'cmd_users' },
                { text: 'ℹ️ System Status', callback_data: 'cmd_status' }
            ],
            [
                { text: '🔄 Refresh Menu', callback_data: 'cmd_menu' },
                { text: '🛑 Emergency Stop', callback_data: 'cmd_stop' }
            ]
        ]
    };
}

/**
 * Sends the interactive Command Center Menu
 */
export async function sendCommandCenterMenu(chatId: string = AUTHORIZED_CHAT_ID) {
    const msg =
        `📊 <b>MeroShare & NEPSE Command Center</b>\n\n` +
        `Direct 2-way control for Google Sheets automation.\n` +
        `Tap any option below to trigger the task:`;
    await sendTelegramMessage(msg, getCommandCenterKeyboard(), chatId);
}

/**
 * Executes a command received from Telegram (via message text or button callback)
 */
async function handleTelegramCommand(command: string, chatId: string) {
    const cmd = command.toLowerCase().replace(/^\//, '').split('@')[0].trim();
    console.log(`[Telegram Bot] Processing command: '${cmd}' from chat ${chatId}`);

    // Menu / Help
    if (cmd === 'start' || cmd === 'menu' || cmd === 'help' || cmd === 'cmd_menu') {
        await sendCommandCenterMenu(chatId);
        return;
    }

    // Status Check
    if (cmd === 'status' || cmd === 'cmd_status') {
        try {
            await initSheets();
            const control = await getControlCommand();
            const users = await fetchUsersFromSheet();
            const activeUsers = users.filter((u: any) => u.checkForThis === true).length;
            const portfolioUsers = users.filter((u: any) => u.checkPortfolio === true).length;

            const statusCard =
                `📊 <b>System & Google Sheet Status</b>\n\n` +
                `• <b>Daemon Status:</b> ${isBusy ? `🟡 <i>BUSY (${activeTaskName})</i>` : '🟢 <i>IDLE & READY</i>'}\n` +
                `• <b>Sheet Command:</b> <code>${control.command}</code>\n` +
                `• <b>Sheet Status:</b> <code>${control.status}</code>\n` +
                `• <b>IPO Checked Users (Col L=TRUE):</b> <code>${activeUsers}</code>\n` +
                `• <b>Portfolio Users (checkPortfolio=TRUE):</b> <code>${portfolioUsers}</code>\n` +
                `• <b>Server Time:</b> <i>${new Date().toLocaleTimeString()}</i>`;

            await sendTelegramMessage(statusCard, getCommandCenterKeyboard(), chatId);
        } catch (e: any) {
            await sendTelegramMessage(`❌ Failed to read Google Sheets status: <code>${e.message}</code>`, undefined, chatId);
        }
        return;
    }

    // Active Users List
    if (cmd === 'users' || cmd === 'cmd_users') {
        try {
            await initSheets();
            const users = await fetchUsersFromSheet();
            if (users.length === 0) {
                await sendTelegramMessage('ℹ️ No users found in Google Sheet.', undefined, chatId);
                return;
            }

            const lines = users.map((u: any, idx: number) => {
                const ipoTag = u.checkForThis ? '🟢 IPO' : '⚪';
                const portTag = u.checkPortfolio ? '💼 Port' : '';
                return `${idx + 1}. <b>${u.name || u.username}</b> [${ipoTag} ${portTag}]`;
            });

            const userListMsg =
                `👥 <b>Users in Google Sheet (${users.length} total)</b>\n\n` +
                lines.join('\n') + `\n\n` +
                `<i>Configure checkboxes in your Google Sheet to enable/disable specific accounts.</i>`;

            await sendTelegramMessage(userListMsg, getCommandCenterKeyboard(), chatId);
        } catch (e: any) {
            await sendTelegramMessage(`❌ Error fetching users: <code>${e.message}</code>`, undefined, chatId);
        }
        return;
    }

    // Guard: Prevent overlapping heavy scraper runs
    if (isBusy) {
        await sendTelegramMessage(
            `⏳ <b>Task Already in Progress</b>\n\n` +
            `The application is currently running: <code>${activeTaskName}</code>.\n` +
            `Please wait until it finishes before starting another task.`,
            undefined,
            chatId
        );
        return;
    }

    // 1. CHECK_STATUS (MeroShare IPO Status Check)
    if (cmd === 'check_status' || cmd === 'checkstatus' || cmd === 'cmd_check_status') {
        runTaskAsync('CHECK_STATUS', async () => {
            await sendTelegramMessage('⏳ <b>Starting MeroShare IPO Status Check...</b>\nFetching active users and stocks from Google Sheet...', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Fetching data from sheets via Telegram command...');

            const users = await fetchUsersFromSheet();
            const stocks = await fetchStocksFromSheet();
            const usersToCheck = users.filter((u: any) => u.checkForThis === true);

            if (usersToCheck.length === 0) {
                await control.updateStatus('COMPLETED', 'No users marked with TRUE in Column L.');
                await control.resetCommand();
                await sendTelegramMessage('ℹ️ <b>IPO Check Skipped:</b> No users have <code>checkForThis = TRUE</code> (Column L) in Google Sheet.', undefined, chatId);
                return;
            }

            await sendTelegramMessage(`🔍 Checking status for <b>${usersToCheck.length} user(s)</b> across <b>${stocks.length} stock(s)</b>...`, undefined, chatId);

            const summaryResults: { user: string; stock: string; status: string }[] = [];
            await runCheckStatus(usersToCheck, stocks, async (stockName, userName, status) => {
                await addResultToSheet(stockName, userName, status);
                summaryResults.push({ user: userName, stock: stockName, status });
            });

            await control.updateStatus('COMPLETED', 'Status check finished successfully.');
            await control.resetCommand();

            const resultLines = summaryResults.map(r => `• <b>${r.user}</b> (${r.stock}): <code>${r.status}</code>`).join('\n');
            await sendTelegramMessage(
                `✅ <b>IPO Status Check Completed</b>\n\n` +
                (resultLines || 'All accounts processed successfully.'),
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 2. EXTRACT_PORTFOLIO (Scrape Portfolios)
    if (cmd === 'portfolio' || cmd === 'cmd_portfolio') {
        runTaskAsync('EXTRACT_PORTFOLIO', async () => {
            await sendTelegramMessage('⏳ <b>Starting Portfolio Scraper...</b>\nReading accounts with checkPortfolio=TRUE...', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Scraping portfolio data via Telegram command...');

            const { scrapePortfolio } = require('./portfolioScraper');
            const users = await fetchUsersFromSheet();
            const validUsers = users.filter((u: any) => u.username && u.password && u.dp && u.checkPortfolio === true);

            if (validUsers.length === 0) {
                await control.updateStatus('ERROR', 'No users marked with checkPortfolio=TRUE');
                await control.resetCommand();
                await sendTelegramMessage('ℹ️ <b>Portfolio Scrape Skipped:</b> No users have <code>checkPortfolio = TRUE</code> in Google Sheet.', undefined, chatId);
                return;
            }

            await sendTelegramMessage(`💼 Scraping portfolios for <b>${validUsers.length} user(s)</b>...`, undefined, chatId);

            let successCount = 0;
            for (const validUser of validUsers) {
                try {
                    await scrapePortfolio(validUser);
                    successCount++;
                } catch (err: any) {
                    console.error(`Failed portfolio scrape for ${validUser.username}:`, err.message);
                }
            }

            await control.updateStatus('COMPLETED', `Portfolio scraped for ${successCount}/${validUsers.length} users.`);
            await control.resetCommand();

            await sendTelegramMessage(
                `✅ <b>Portfolio Scrape Completed!</b>\n` +
                `Successfully updated portfolio data for <b>${successCount} / ${validUsers.length}</b> account(s).`,
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 3. 52-WEEK HIGH / LOW
    if (cmd === '52week' || cmd === 'cmd_52week') {
        runTaskAsync('EXTRACT_52_WEEK', async () => {
            await sendTelegramMessage('⏳ <b>Starting 52-Week High/Low Scraper...</b>', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Scraping 52-Week High and Low stocks...');

            const { scrape52WeekHighLow } = require('./week52Scraper');
            const results = await scrape52WeekHighLow();

            await control.updateStatus('COMPLETED', `52-week data scraped successfully (${results.length} stocks).`);
            await control.resetCommand();

            await sendTelegramMessage(
                `✅ <b>52-Week High/Low Scraper Completed!</b>\n` +
                `Extracted and updated <b>${results.length}</b> stocks in Google Sheet tab: <code>52WeekHighLow</code>.`,
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 4. FUNDAMENTAL DATA
    if (cmd === 'funda' || cmd === 'cmd_funda') {
        runTaskAsync('EXTRACT_FUNDA_DATA', async () => {
            await sendTelegramMessage('⏳ <b>Starting Fundamental Data Scraper...</b>', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Scraping fundamental data...');

            const { fetchFundamentalData } = require('./fundaScraper');
            const { data } = await fetchFundamentalData();

            await control.updateStatus('COMPLETED', `Scraped ${data.length} rows successfully.`);
            await control.resetCommand();

            await sendTelegramMessage(
                `✅ <b>Fundamental Data Scraper Completed!</b>\n` +
                `Updated <b>${data.length}</b> companies in Google Sheet.`,
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 5. PROMOTER UNLOCK
    if (cmd === 'promoter' || cmd === 'cmd_promoter') {
        runTaskAsync('PROMOTER_UNLOCK_CHECK', async () => {
            await sendTelegramMessage('⏳ <b>Starting Promoter Unlock Scraper...</b>', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Scraping promoter unlock data...');

            const { fetchPromoterUnlockData } = require('./promoterUnlock');
            const { headers, data } = await fetchPromoterUnlockData();

            await overrideSheetData('PromoterShareUnlock', headers, data);

            await control.updateStatus('COMPLETED', `Scraped ${data.length} rows successfully.`);
            await control.resetCommand();

            await sendTelegramMessage(
                `✅ <b>Promoter Unlock Scraper Completed!</b>\n` +
                `Updated <b>${data.length}</b> records in Google Sheet tab: <code>PromoterShareUnlock</code>.`,
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 6. TECHNICAL SIGNALS
    if (cmd === 'tech' || cmd === 'techsignals' || cmd === 'cmd_tech') {
        runTaskAsync('EXTRACT_TECH_SIGNALS', async () => {
            await sendTelegramMessage('⏳ <b>Starting Technical Signals Scraper...</b>', undefined, chatId);

            await initSheets();
            const control = await getControlCommand();
            await control.updateStatus('IN_PROGRESS', 'Scraping technical signals...');

            const { scrapeTechnicalSignals } = require('./techScraper');
            await scrapeTechnicalSignals();

            await control.updateStatus('COMPLETED', 'Technical signals scraped successfully.');
            await control.resetCommand();

            await sendTelegramMessage(
                `✅ <b>Technical Signals Scraper Completed!</b>\n` +
                `Updated technical indicators in Google Sheet tab: <code>TechnicalSignals</code>.`,
                getCommandCenterKeyboard(),
                chatId
            );
        }, chatId);
        return;
    }

    // 7. STOP
    if (cmd === 'stop' || cmd === 'cmd_stop') {
        await initSheets().catch(() => {});
        const control = await getControlCommand().catch(() => null);
        if (control) {
            await control.updateStatus('STOPPED', 'Halted via Telegram command.');
            await control.resetCommand();
        }
        await sendTelegramMessage('🛑 <b>Emergency Stop Triggered</b>\nControl sheet marked as STOPPED.', undefined, chatId);
        return;
    }

    // Fallback: Unknown Command
    await sendTelegramMessage(
        `❓ <b>Unrecognized Command:</b> <code>${command}</code>\n\n` +
        `Send /menu or choose an option from the buttons below:`,
        getCommandCenterKeyboard(),
        chatId
    );
}

/**
 * Runs a background scraper task safely with busy guards and error handling
 */
function runTaskAsync(taskName: string, taskFn: () => Promise<void>, chatId: string) {
    isBusy = true;
    activeTaskName = taskName;

    (async () => {
        try {
            await taskFn();
        } catch (err: any) {
            console.error(`[Telegram Bot] Error during task '${taskName}':`, err);
            const shortErr = formatShortError(err);
            await sendTelegramMessage(
                `🚨 <b>Error Running ${taskName}</b>\n` +
                `<code>${shortErr}</code>`,
                getCommandCenterKeyboard(),
                chatId
            ).catch(() => {});

            // Update Control sheet with error status
            try {
                const control = await getControlCommand();
                await control.updateStatus('ERROR', shortErr);
                await control.resetCommand();
            } catch (_) {}
        } finally {
            isBusy = false;
            activeTaskName = '';
        }
    })();
}

/**
 * Main Long-Polling Loop: Fetches updates directly from Telegram Bot API
 */
export async function startTelegramBotListener(): Promise<void> {
    if (isPolling) return;
    isPolling = true;

    console.log('🤖 [Telegram Bot] Starting 2-way long-polling listener...');
    if (!BOT_TOKEN) {
        console.error('❌ [Telegram Bot] TELEGRAM_BOT_TOKEN missing in .env!');
        isPolling = false;
        return;
    }

    // Clear any stale webhook to enable long-polling
    await telegramApi('deleteWebhook', { drop_pending_updates: false }).catch(() => {});

    // Notify on startup
    if (AUTHORIZED_CHAT_ID) {
        await sendCommandCenterMenu(AUTHORIZED_CHAT_ID).catch(() => {});
    }

    while (isPolling) {
        try {
            const res = await telegramApi('getUpdates', {
                offset: lastUpdateId + 1,
                timeout: 25,
                allowed_updates: ['message', 'callback_query']
            });

            if (res && res.ok && Array.isArray(res.result)) {
                for (const update of res.result) {
                    lastUpdateId = Math.max(lastUpdateId, update.update_id);

                    const message = update.message;
                    const callbackQuery = update.callback_query;

                    const chatId = message ? String(message.chat.id) : (callbackQuery && callbackQuery.message ? String(callbackQuery.message.chat.id) : '');
                    const fromId = message && message.from ? String(message.from.id) : (callbackQuery && callbackQuery.from ? String(callbackQuery.from.id) : chatId);
                    const rawText = message ? (message.text || '') : (callbackQuery ? callbackQuery.data : '');

                    if (!chatId) continue;

                    // Security check: Only allow authorized chat / user ID
                    if (AUTHORIZED_CHAT_ID && chatId !== AUTHORIZED_CHAT_ID && fromId !== AUTHORIZED_CHAT_ID) {
                        console.warn(`[Telegram Bot] Ignored unauthorized message from chat: ${chatId} (user: ${fromId})`);
                        continue;
                    }

                    // Answer button callback immediately so user sees responsiveness
                    if (callbackQuery && callbackQuery.id) {
                        await answerCallbackQuery(callbackQuery.id);
                    }

                    if (rawText) {
                        await handleTelegramCommand(rawText, chatId);
                    }
                }
            } else if (res && !res.ok) {
                console.warn(`[Telegram Bot] getUpdates warning:`, res.error || res.description);
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (loopErr: any) {
            console.error(`[Telegram Bot] Error in polling loop:`, loopErr.message || loopErr);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

/**
 * Stops the polling listener
 */
export function stopTelegramBotListener() {
    isPolling = false;
    console.log('[Telegram Bot] Listener stopped.');
}

// Standalone execution support: npx ts-node telegramBotService.ts
if (require.main === module) {
    console.log('Starting standalone Telegram Bot Controller...');
    startTelegramBotListener().catch(console.error);
}
