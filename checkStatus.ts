import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
    await page.goto('https://meroshare.cdsc.com.np/');

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible' });
    await dpSelect.click();

    const dpSearchInput = page.locator('.select2-search__field');
    await dpSearchInput.waitFor({ state: 'visible' });
    await dpSearchInput.fill(user.dp);
    await page.keyboard.press('Enter');

    // Enter Username and Password
    await page.locator('input[name="username"]').fill(user.username);
    await page.locator('input[name="password"]').fill(user.password);

    // Click Login
    console.log(`[${user.name}] Logging in...`);
    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await loginButton.click();

    // Wait for login to complete
    await page.waitForTimeout(5000);
}


export async function runCheckStatus(
    users: User[], 
    stockNames: string[], 
    onResult?: (stockName: string, userName: string, status: string) => Promise<void>
) {
    const reportPath = path.resolve(__dirname, 'reportStatus.json');

    let existingReports: StockReport[] = [];
    if (fs.existsSync(reportPath)) {
        try {
            existingReports = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        } catch (e) {
            console.warn('Could not parse existing reportStatus.json, starting fresh.');
            existingReports = [];
        }
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    for (const user of users) {
        if (user.isApply === false) continue;
        
        const page = await context.newPage();
        try {
            await login(page, user);

            for (const stockName of stockNames) {
                // Click on "MY ASBA" in the sidebar first (fresh start for each stock)
                console.log(`[${user.name}] Clicking on MY ASBA sidebar for ${stockName}...`);
                const myAsbaLink = page.locator('//*[@id="sideBar"]/nav/ul/li[8]/a');
                await myAsbaLink.waitFor({ state: 'visible', timeout: 15000 });
                await myAsbaLink.click();
                await page.waitForTimeout(2000);

                // Navigate to Application Report tab
                const reportTab = page.locator('//*[@id="main"]/div/app-asba/div/div[1]/div/div/ul/li[3]/a');
                await reportTab.waitFor({ state: 'visible', timeout: 10000 });
                await reportTab.click();
                await page.waitForTimeout(3000); // Wait for list to load

                // The container for all listed stocks
                const listContainer = page.locator('div.company-list');

                // Normalize stock name for matching: replace multiple spaces with \s+ for lenient matching
                const escapedStockName = stockName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                const targetRow = listContainer.filter({ hasText: new RegExp(escapedStockName, 'i') }).first();

                const reportButton = targetRow.locator('button.btn-issue', { hasText: 'report' });

                let status = 'Not Found';
                if (await reportButton.isVisible()) {
                    try {
                        await reportButton.click();
                        console.log(`[${user.name}] Clicked Report for ${stockName}. Waiting for details...`);
                        await page.waitForTimeout(3000);

                        const statusLocator = page.locator('//*[@id="main"]/div/app-application-report/div/div[2]/div/div[3]/div/div[1]/div[7]/div');
                        await statusLocator.waitFor({ state: 'visible', timeout: 10000 });
                        const statusText = await statusLocator.innerText();
                        status = statusText.replace(/^Status\s+/i, '').trim();
                        console.log(`[${user.name}] Status for ${stockName}: ${status}`);

                        // After getting status, click back/close if a button exists
                        const closeButton = page.locator('button', { hasText: 'Close' });
                        if (await closeButton.isVisible()) {
                            await closeButton.click();
                        }
                    } catch (e) {
                        console.warn(`[${user.name}] Error fetching status for ${stockName}:`, e);
                        status = 'Error';
                    }
                } else {
                    console.warn(`[${user.name}] Stock not found in list: ${stockName}`);
                }

                // Call the result callback if provided
                if (onResult) {
                    await onResult(stockName, user.name, status);
                }

                // Update the central report data (local JSON fallback)
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
            await page.close();
        }
    }

    await browser.close();
    console.log('All status checks completed.');
}

// Logic to run directly if needed
if (require.main === module) {
    const usersPath = path.resolve(__dirname, 'users.json');
    const stocksPath = path.resolve(__dirname, 'checkStockStatus.json');
    
    if (fs.existsSync(usersPath) && fs.existsSync(stocksPath)) {
        const users: User[] = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const stockNames: string[] = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
        runCheckStatus(users, stockNames).catch(console.error);
    }
}
