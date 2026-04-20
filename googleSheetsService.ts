import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

// Authentication setup
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || '', serviceAccountAuth);

export async function initSheets() {
    if (!process.env.GOOGLE_SHEET_ID) {
        throw new Error('GOOGLE_SHEET_ID is missing in .env');
    }
    await doc.loadInfo();
    console.log(`Connected to Spreadsheet: ${doc.title}`);
}
export async function fetchUsersFromSheet() {
    const sheet = doc.sheetsByTitle['Users'];
    if (!sheet) throw new Error('Sheet "Users" not found');

    const rows = await sheet.getRows();
    return rows.map(row => {
        // Log the raw value to be 100% sure what the library sees
        const rawIsApply = row.get('isApply');
        return {
            id: parseInt(row.get('ID')),
            dp: row.get('DP'),
            username: row.get('Username'),
            password: row.get('Password'),
            crn: row.get('CRN'),
            pin: row.get('PIN'),
            kitta: row.get('Kitta'),
            // Note: Based on your _rawData, 'Name' comes before 'isApply'
            name: row.get('Name'),
            // We use .trim() here because "TRUE" in strings often has trailing spaces
            isApply: rawIsApply?.toString().trim().toLowerCase() === 'true',
            applyAt: row.get('ApplyAt'),
        };
    });
}

// export async function fetchUsersFromSheet() {
//     const sheet = doc.sheetsByTitle['Users'];
//     if (!sheet) throw new Error('Sheet "Users" not found');

//     const rows = await sheet.getRows();
//     console.log('user info', rows);

//     return rows.map(row => ({
//         id: parseInt(row.get('ID')),
//         dp: row.get('DP'),
//         username: row.get('Username'),
//         password: row.get('Password'),
//         crn: row.get('CRN'),
//         pin: row.get('PIN'),
//         kitta: row.get('Kitta'),
//         applyAt: row.get('ApplyAt'),
//         name: row.get('Name'),
//         isApply: row.get('isApply')?.toLowerCase() === 'true',
//     }));
// }

export async function fetchStocksFromSheet() {
    const sheet = doc.sheetsByTitle['Stocks'];
    if (!sheet) throw new Error('Sheet "Stocks" not found');

    const rows = await sheet.getRows();
    return rows.map(row => row.get('Stock Name')).filter(Boolean);
}

export async function getControlCommand() {
    const sheet = doc.sheetsByTitle['Control'];
    if (!sheet) throw new Error('Sheet "Control" not found');

    // FIX: Load A2 through D2 to cover Command, Status, Last Run, and Message
    await sheet.loadCells('A2:D2');

    const commandCell = sheet.getCell(1, 0); // A2 (Command)
    const statusCell = sheet.getCell(1, 1);  // B2 (Status)

    return {
        command: commandCell.value?.toString().toUpperCase() || 'IDLE',
        status: statusCell.value?.toString() || '',
        updateStatus: async (newStatus: string, message?: string) => {
            statusCell.value = newStatus;

            // This now works because column C (index 2) was loaded
            const lastRunCell = sheet.getCell(1, 2); // C2
            lastRunCell.value = new Date().toLocaleString();

            if (message) {
                // This now works because column D (index 3) was loaded
                const messageCell = sheet.getCell(1, 3); // D2
                messageCell.value = message;
            }

            await sheet.saveUpdatedCells();
        },
        resetCommand: async () => {
            commandCell.value = 'IDLE';
            await sheet.saveUpdatedCells();
        }
    };
}

export async function addResultToSheet(stockName: string, userName: string, status: string) {
    const sheet = doc.sheetsByTitle['Results'];
    if (!sheet) throw new Error('Sheet "Results" not found');

    await sheet.addRow({
        'Timestamp': new Date().toLocaleString(),
        'Stock Name': stockName,
        'User Name': userName,
        'Status': status
    });
}
