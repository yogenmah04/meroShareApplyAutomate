import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { type Page } from 'playwright';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { humanClick, humanType, jitterSleep, getRandomUserAgent, launchBrowserWithViewMode } from './humanUtils';
import { sendTelegramNotification } from './notificationService';

// Initialize stealth plugin
chromium.use(StealthPlugin());

// Load environment variables from .env
dotenv.config();

export interface User {
    id: number;
    dp: string;
    username: string;
    password: string;
    crn?: string;
    pin?: string;
    kitta?: string;
    applyAt?: string;
    name: string;
    isApply?: boolean;
    checkForThis?: boolean;
}

export interface StatusEntry {
    name: string;
    status: string;
}

export interface StockReport {
    stockName: string;
    nameStatusList: StatusEntry[];
}

/**
 * Strips verbose stack traces, Playwright ASCII art, and call logs
 * into a concise, readable error message for Telegram notifications.
 */
export function formatShortError(err: any): string {
    if (!err) return 'Unknown error';
    const raw = typeof err === 'string' ? err : (err.message || String(err));
    // Strip playwright internal ASCII art banners and call logs
    const stripped = raw.replace(/╔═+[\s\S]*?═+╝/g, '').trim();
    const firstLine = stripped.split('\n')[0].trim();

    if (raw.includes('Missing X server') || raw.includes('Target page, context or browser has been closed')) {
        return 'Browser display error (Headed mode launched without active X11 display)';
    }
    if (raw.includes('Failed to load Meroshare page')) {
        return 'Meroshare website unreachable or white screen after retries';
    }
    if (raw.includes('Login rejected') || raw.includes('Login failed')) {
        return firstLine.slice(0, 160);
    }
    if (raw.includes('Timeout') && raw.includes('exceeded')) {
        if (raw.includes('li[8]/a') || raw.includes('sideBar')) {
            return 'Timeout waiting for My ASBA in sidebar (login may have failed or timed out)';
        }
        if (raw.includes('.select2')) {
            return 'Timeout waiting for DP selector on Meroshare login page';
        }
        if (raw.includes('app-application-report')) {
            return 'Timeout loading application report dialog';
        }
        return 'Operation timed out waiting for element or response';
    }
    if (raw.includes('net::ERR_')) {
        const match = raw.match(/net::ERR_[A-Z0-9_]+/);
        return `Network error (${match ? match[0] : 'Connection dropped'})`;
    }
    return firstLine.slice(0, 160);
}

async function login(page: Page, user: User) {
    console.log(`[${user.name}] Navigating to Meroshare...`);
    
    let pageLoaded = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto('https://meroshare.cdsc.com.np/', { waitUntil: 'networkidle' });
        try {
            const dpSelect = page.locator('.select2-selection__rendered');
            await dpSelect.waitFor({ state: 'visible', timeout: 3000 });
            pageLoaded = true;
            break;
        } catch (e) {
            console.log(`[${user.name}] White screen or failed to load. Reloading...`);
        }
    }

    if (!pageLoaded) {
        throw new Error(`[${user.name}] Failed to load Meroshare page after retries.`);
    }

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await humanClick(page, dpSelect);

    const dpSearchInput = page.locator('.select2-search__field');
    await dpSearchInput.waitFor({ state: 'visible' });
    await humanType(page, '.select2-search__field', user.dp);
    await page.keyboard.press('Enter');

    // Enter Username and Password
    await humanType(page, 'input[name="username"]', user.username);
    await humanType(page, 'input[name="password"]', user.password);

    // Click Login
    console.log(`[${user.name}] Logging in...`);
    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await humanClick(page, loginButton);

    // Wait for login to complete
    await jitterSleep(4000, 6000);

    // Check if error toast or alert appeared
    const toast = page.locator('.toast-message, .alert-danger, .toastr-message, div[role="alert"]');
    if (await toast.isVisible({ timeout: 1500 }).catch(() => false)) {
        const msg = (await toast.innerText().catch(() => '')).trim();
        if (msg) {
            throw new Error(`Login rejected by Meroshare: ${msg}`);
        }
    }

    // If password input is still visible on the page, login did not succeed
    const isPasswordStillVisible = await page.locator('input[name="password"]').isVisible().catch(() => false);
    if (isPasswordStillVisible) {
        const alertEl = page.locator('.toast-message, .alert, .error, .has-error, div[role="alert"]');
        const alertMsg = (await alertEl.first().innerText().catch(() => '')).trim();
        throw new Error(alertMsg ? `Login failed: ${alertMsg}` : `Login failed: Invalid credentials or session error for ${user.username}`);
    }
}

export async function runCheckStatus(
    users: User[],
    stockNames: string[],
    onResult?: (stockName: string, userName: string, status: string) => Promise<void>
) {
    const reportPath = path.resolve(__dirname, 'reportStatus.json');
    const concurrencyLimit = parseInt(process.env.CONCURRENCY_LIMIT || '2');
    const limit = pLimit(concurrencyLimit);

    console.log(`Starting status check with concurrency limit: ${concurrencyLimit}`);

    let existingReports: StockReport[] = [];
    if (fs.existsSync(reportPath)) {
        try {
            existingReports = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        } catch (e) {
            console.warn('Could not parse existing reportStatus.json, starting fresh.');
            existingReports = [];
        }
    }

    const browser = await launchBrowserWithViewMode(chromium);

    const tasks = users.map((user) => 
        limit(async () => {
            // Check Column L (checkForThis). If 'checkForThis' is defined (e.g. from Google Sheet), require it to be true; otherwise fallback to isApply !== false
            const shouldCheck = user.checkForThis !== undefined ? user.checkForThis : (user.isApply !== false);
            if (!shouldCheck) {
                console.log(`[SKIPPED] User ${user.name || user.username} is skipped (Column L is not TRUE).`);
                return;
            }

            const context = await browser.newContext({
                userAgent: getRandomUserAgent(),
                viewport: { width: 1280, height: 720 }
            });
            const page = await context.newPage();

            try {
                await login(page, user);

                for (const stockName of stockNames) {
                    await jitterSleep(1000, 3000); // Random pause between stocks

                    // Click on "MY ASBA" in the sidebar
                    console.log(`[${user.name}] Navigating to MY ASBA for ${stockName}...`);
                    const myAsbaLink = page.locator('//*[@id="sideBar"]/nav/ul/li[8]/a');
                    await myAsbaLink.waitFor({ state: 'visible', timeout: 15000 });
                    await humanClick(page, myAsbaLink);
                    await jitterSleep(1000, 2000);

                    // Navigate to Application Report tab
                    const reportTab = page.locator('//*[@id="main"]/div/app-asba/div/div[1]/div/div/ul/li[3]/a');
                    await reportTab.waitFor({ state: 'visible', timeout: 10000 });
                    await humanClick(page, reportTab);
                    await jitterSleep(2000, 4000); 

                    // Find and click report
                    const listContainer = page.locator('div.company-list');
                    const escapedStockName = stockName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                    const targetRow = listContainer.filter({ hasText: new RegExp(escapedStockName, 'i') }).first();
                    const reportButton = targetRow.locator('button.btn-issue', { hasText: 'report' });

                    let status = 'Not Found';
                    if (await reportButton.isVisible()) {
                        try {
                            await humanClick(page, reportButton);
                            console.log(`[${user.name}] Extracting status for ${stockName}...`);
                            await jitterSleep(2000, 4000);

                            const statusLocator = page.locator('//*[@id="main"]/div/app-application-report/div/div[2]/div/div[3]/div/div[1]/div[7]/div');
                            await statusLocator.waitFor({ state: 'visible', timeout: 10000 });
                            const statusText = await statusLocator.innerText();
                            status = statusText.replace(/^Status\s+/i, '').trim();
                            console.log(`[${user.name}] Status for ${stockName}: ${status}`);

                            const closeButton = page.locator('button', { hasText: 'Close' });
                            if (await closeButton.isVisible()) {
                                await humanClick(page, closeButton);
                            }
                        } catch (e: any) {
                            const shortErr = formatShortError(e);
                            console.warn(`[${user.name}] Error fetching status for ${stockName}:`, shortErr);
                            status = 'Error';
                            await sendTelegramNotification(
                                `⚠️ <b>IPO Status Check Error</b>\n` +
                                `User: <b>${user.name || user.username}</b> (ID: ${user.username})\n` +
                                `Stock: <b>${stockName}</b>\n` +
                                `Error: <code>${shortErr}</code>`
                            );
                        }
                    } else {
                        console.warn(`[${user.name}] Stock not found in list: ${stockName}`);
                    }

                    if (onResult) {
                        await onResult(stockName, user.name, status);
                    }

                    if (status && status !== 'Not Found' && status !== 'Error') {
                        await sendTelegramNotification(`📊 <b>IPO Allotment Status</b>\nUser: ${user.name}\nStock: ${stockName}\nStatus: ${status}`);
                    }

                    // Update existingReports
                    let stockReport = existingReports.find(r => r.stockName === stockName);
                    if (!stockReport) {
                        stockReport = { stockName, nameStatusList: [] };
                        existingReports.push(stockReport);
                    }
                    stockReport.nameStatusList = stockReport.nameStatusList.filter(e => e.name !== user.name);
                    stockReport.nameStatusList.push({ name: user.name, status });
                    fs.writeFileSync(reportPath, JSON.stringify(existingReports, null, 2));
                }
            } catch (error: any) {
                const shortErr = formatShortError(error);
                console.error(`Failed execution for user ${user.name}:`, shortErr);
                await sendTelegramNotification(
                    `❌ <b>IPO Status Check Failed</b>\n` +
                    `User: <b>${user.name || user.username}</b> (ID: ${user.username})\n` +
                    `DP: <i>${user.dp || 'N/A'}</i>\n` +
                    `Error: <code>${shortErr}</code>`
                );
                if (onResult) {
                    for (const stockName of stockNames) {
                        await onResult(stockName, user.name, 'Error').catch(() => {});
                    }
                }
            } finally {
                await context.close();
            }
        })
    );

    await Promise.all(tasks);
    await browser.close();
    console.log('All status checks completed.');
}

if (require.main === module) {
    const usersPath = path.resolve(__dirname, 'users.json');
    const stocksPath = path.resolve(__dirname, 'checkStockStatus.json');

    if (fs.existsSync(usersPath) && fs.existsSync(stocksPath)) {
        const users: User[] = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const stockNames: string[] = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
        runCheckStatus(users, stockNames).catch(console.error);
    }
}
