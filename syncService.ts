import { initSheets, fetchUsersFromSheet, fetchStocksFromSheet, getControlCommand, addResultToSheet } from './googleSheetsService';
import { runCheckStatus } from './checkStatus';
import { initializeScheduler } from './scheduler';
import * as dotenv from 'dotenv';

dotenv.config();

const POLLING_INTERVAL_MS = 30000; // 30 seconds

async function main() {
    console.log('Starting Google Sheets Sync Service...');
    try {
        await initSheets();
    } catch (e: any) {
        console.error('Failed to initialize Google Sheets:', e.message);
        process.exit(1);
    }

    console.log(`Polling Google Sheets every ${POLLING_INTERVAL_MS / 1000} seconds...`);

    while (true) {
        try {
            const control = await getControlCommand();
            const { command, status } = control;

            if (command === 'CHECK_STATUS' && status !== 'IN_PROGRESS') {
                console.log('Detected command: CHECK_STATUS. Starting process...');
                await control.updateStatus('IN_PROGRESS', 'Fetching data from sheets...');

                const users = await fetchUsersFromSheet();
                const stocks = await fetchStocksFromSheet();

                await control.updateStatus('IN_PROGRESS', `Running status check for ${users.length} users and ${stocks.length} stocks...`);

                await runCheckStatus(users, stocks, async (stockName, userName, status) => {
                    await addResultToSheet(stockName, userName, status);
                });

                await control.updateStatus('COMPLETED', 'Status check finished successfully.');
                await control.resetCommand();
                console.log('CHECK_STATUS process completed.');

            } else if (command === 'PROMOTER_UNLOCK_CHECK' && status !== 'IN_PROGRESS') {
                console.log('Detected command: PROMOTER_UNLOCK_CHECK. Starting scraper...');
                await control.updateStatus('IN_PROGRESS', 'Scraping data from Nepse Alpha...');

                try {
                    const { fetchPromoterUnlockData } = require('./promoterUnlock');
                    const { overrideSheetData } = require('./googleSheetsService');
                    
                    const { headers, data } = await fetchPromoterUnlockData();
                    await control.updateStatus('IN_PROGRESS', `Updating Google Sheet tab: PromoterShareUnlock...`);
                    
                    await overrideSheetData('PromoterShareUnlock', headers, data);
                    
                    await control.updateStatus('COMPLETED', `Scraped ${data.length} rows successfully.`);
                    await control.resetCommand();
                    console.log('PROMOTER_UNLOCK_CHECK process completed.');
                } catch (e: any) {
                    await control.updateStatus('ERROR', `Scraper failed: ${e.message}`);
                    await control.resetCommand();
                }

            } else if (command === 'EXTRACT_FUNDA_DATA' && status !== 'IN_PROGRESS') {
                console.log('Detected command: EXTRACT_FUNDA_DATA. Starting scraper...');
                await control.updateStatus('IN_PROGRESS', 'Scraping fundamental data from Nepse Alpha...');

                try {
                    const { fetchFundamentalData } = require('./fundaScraper');
                    
                    const { headers, data } = await fetchFundamentalData();
                    // fundaScraper internally saves the data to Google Sheets
                    
                    await control.updateStatus('COMPLETED', `Scraped ${data.length} rows successfully.`);
                    await control.resetCommand();
                    console.log('EXTRACT_FUNDA_DATA process completed.');
                } catch (e: any) {
                    await control.updateStatus('ERROR', `Scraper failed: ${e.message}`);
                    await control.resetCommand();
                }

            } else if (command === 'START_SCHEDULER' && status !== 'SCHEDULER_RUNNING') {
                console.log('Detected command: START_SCHEDULER. Starting scheduler...');
                await control.updateStatus('IN_PROGRESS', 'Fetching user data for scheduler...');
                    
                const users = await fetchUsersFromSheet();
                initializeScheduler(users);

                await control.updateStatus('SCHEDULER_RUNNING', 'Scheduler is active and waiting for IPO dates.');
                console.log('Scheduler started via Google Sheets.');

            } else if (command === 'STOP') {
                console.log('Detected command: STOP. Killing active processes (Restart required to resume).');
                await control.updateStatus('STOPPED', 'System manually stopped.');
                await control.resetCommand();
                process.exit(0);
            }

        } catch (error: any) {
            console.error('Error during polling loop:', error.message);
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }
}

main().catch(console.error);
