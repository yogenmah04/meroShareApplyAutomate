import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { type Page } from 'playwright';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { humanClick, humanType, jitterSleep, getRandomUserAgent } from './humanUtils';

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
}

export interface StatusEntry {
    name: string;
    status: string;
}

export interface StockReport {
    stockName: string;
    nameStatusList: StatusEntry[];
}

async function login(page: Page, user: User) {
    console.log(`[${user.name}] Navigating to Meroshare...`);
    await page.goto('https://meroshare.cdsc.com.np/', { waitUntil: 'networkidle' });

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible' });
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
    await jitterSleep(5000, 7000);
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

    const browser = await chromium.launch({ 
        headless: false, 
        args: ['--disable-blink-features=AutomationControlled'] 
    });

    const tasks = users.map((user) => 
        limit(async () => {
            if (user.isApply === false) return;

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
                        } catch (e) {
                            console.warn(`[${user.name}] Error fetching status for ${stockName}:`, e);
                            status = 'Error';
                        }
                    } else {
                        console.warn(`[${user.name}] Stock not found in list: ${stockName}`);
                    }

                    if (onResult) {
                        await onResult(stockName, user.name, status);
                    }

                    // Update existingReports (Note: this shared variable should be updated carefully if running many threads)
                    // For now we keep the local file sync as a fallback.
                    let stockReport = existingReports.find(r => r.stockName === stockName);
                    if (!stockReport) {
                        stockReport = { stockName, nameStatusList: [] };
                        existingReports.push(stockReport);
                    }
                    stockReport.nameStatusList = stockReport.nameStatusList.filter(e => e.name !== user.name);
                    stockReport.nameStatusList.push({ name: user.name, status });
                    fs.writeFileSync(reportPath, JSON.stringify(existingReports, null, 2));
                }
            } catch (error) {
                console.error(`Failed execution for user ${user.name}:`, error);
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
