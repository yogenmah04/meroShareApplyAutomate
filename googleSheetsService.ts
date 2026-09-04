import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import * as dotenv from "dotenv";
import pLimit from "p-limit";

dotenv.config();

// 1. Initialize concurrency control and environment variables
const limit = pLimit(2); // Restrict to 2 concurrent API requests
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const sheetId = process.env.GOOGLE_SHEET_ID;

if (!serviceAccountEmail || !privateKey || !sheetId) {
  throw new Error(
    "Missing Google Spreadsheet environment variables in .env file.",
  );
}

const formattedKey = privateKey.replace(/\\n/g, "\n");

const serviceAccountAuth = new JWT({
  email: serviceAccountEmail,
  key: formattedKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

// 2. Helper utility for delays
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 3. Resilient API wrapper with Exponential Backoff
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000,
): Promise<T> {
  try {
    return await limit(fn);
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const isTransient =
      error.code === "EAI_AGAIN" || // DNS resolution error
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      errorMsg.includes("500") || // Internal server error
      errorMsg.includes("502") || // Bad Gateway
      errorMsg.includes("503") || // Service Unavailable
      errorMsg.includes("504") || // Gateway Timeout
      errorMsg.includes("429") || // Rate Limit
      errorMsg.includes("Bad Gateway") ||
      errorMsg.includes("fetch failed") || // Network drops
      errorMsg.includes("socket hang up");

    if (isTransient && retries > 0) {
      console.warn(
        `[Network Warning] Transient error encountered: ${errorMsg}. Retrying in ${delay / 1000}s...`,
      );
      await wait(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function initSheets() {
  return callWithRetry(async () => {
    await doc.loadInfo();
    console.log(`Connected to Spreadsheet: ${doc.title}`);
  });
}

export async function fetchUsersFromSheet() {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["Users"];
    if (!sheet) throw new Error('Sheet "Users" not found');

    const rows = await sheet.getRows();
    return rows.map((row) => {
      const rawIsApply = row.get("isApply");
      return {
        id: parseInt(row.get("ID")),
        dp: row.get("DP"),
        username: row.get("Username"),
        password: row.get("Password"),
        crn: row.get("CRN"),
        pin: row.get("PIN"),
        kitta: row.get("Kitta"),
        name: row.get("Name"),
        isApply: rawIsApply?.toString().trim().toLowerCase() === "true",
        applyAt: row.get("ApplyAt"),
      };
    });
  });
}

export async function fetchStocksFromSheet() {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["Stocks"];
    if (!sheet) throw new Error('Sheet "Stocks" not found');

    const rows = await sheet.getRows();
    return rows.map((row) => row.get("Stock Name")).filter(Boolean);
  });
}

export async function getControlCommand() {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["Control"];
    if (!sheet) throw new Error('Sheet "Control" not found');

    await sheet.loadCells("A2:D2");
    const commandCell = sheet.getCell(1, 0); // A2 (Command)
    const statusCell = sheet.getCell(1, 1); // B2 (Status)

    return {
      command: commandCell.value?.toString().toUpperCase() || "IDLE",
      status: statusCell.value?.toString() || "",
      updateStatus: async (newStatus: string, message?: string) => {
        return callWithRetry(async () => {
          statusCell.value = newStatus;
          const lastRunCell = sheet.getCell(1, 2); // C2
          lastRunCell.value = new Date().toLocaleString();

          if (message) {
            const messageCell = sheet.getCell(1, 3); // D2
            messageCell.value = message;
          }

          await sheet.saveUpdatedCells();
        });
      },
      resetCommand: async () => {
        return callWithRetry(async () => {
          commandCell.value = "IDLE";
          await sheet.saveUpdatedCells();
        });
      },
    };
  });
}

export async function addResultToSheet(
  stockName: string,
  userName: string,
  status: string,
) {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["Results"];
    if (!sheet) throw new Error('Sheet "Results" not found');

    await sheet.addRow({
      Timestamp: new Date().toLocaleString(),
      "Stock Name": stockName,
      "User Name": userName,
      Status: status,
    });
  });
}

export async function overrideSheetData(
  tabName: string,
  headers: string[],
  data: string[][],
) {
  return callWithRetry(async () => {
    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues: headers });
    } else {
      await sheet.clear();
      await sheet.setHeaderRow(headers);
    }

    const rowsToAdd = data.map((rowData) => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = rowData[index] || "";
      });
      return obj;
    });

    if (rowsToAdd.length > 0) {
      await sheet.addRows(rowsToAdd);
    }
  });
}

export async function markUserAsIPOApplied(username: string, status: string = "IPO applied") {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["Users"];
    if (!sheet) throw new Error('Sheet "Users" not found');

    const rows = await sheet.getRows();
    const userRow = rows.find((r) => r.get("Username") === username);

    if (userRow) {
      const rowIndex = userRow.rowNumber - 1;
      await sheet.loadCells(`I${userRow.rowNumber}:K${userRow.rowNumber}`);

      const isApplyCell = sheet.getCell(rowIndex, 8); // Column I
      const statusCell = sheet.getCell(rowIndex, 10); // Column K

      isApplyCell.value = "FALSE";
      statusCell.value = status;

      await sheet.saveUpdatedCells();
    } else {
      console.warn(`User ${username} not found in the Google Sheet.`);
    }
  });
}

export async function fetchAutoBuySellData() {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["autoBuySellScript"];
    if (!sheet) throw new Error('Sheet "autoBuySellScript" not found');

    await sheet.loadCells("B3:E200"); // Assuming maximum 200 rows for trades
    const trades = [];

    for (let i = 2; i < 200; i++) { // i=2 is row 3
      const symbolCell = sheet.getCell(i, 1); // Col B
      const qtyCell = sheet.getCell(i, 2);    // Col C
      const priceCell = sheet.getCell(i, 3);  // Col D
      const actionCell = sheet.getCell(i, 4); // Col E

      const symbol = symbolCell.value?.toString().trim();
      if (!symbol) continue;

      const qty = qtyCell.value?.toString().trim();
      const price = priceCell.value?.toString().trim();
      const action = actionCell.value?.toString().trim().toUpperCase();

      if (action === "BUY" || action === "SELL") {
        trades.push({ symbol, qty: qty || "0", price: price || "0", action });
      }
    }

    return trades;
  });
}

export async function getTmsScheduleTime() {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["autoBuySellScript"];
    if (!sheet) return null;
    await sheet.loadCells("B1:B1");
    const cell = sheet.getCell(0, 1);
    const value = cell.formattedValue || cell.value;
    return value ? value.toString().trim() : null;
  });
}
