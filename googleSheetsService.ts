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
      // Column L is the 12th column (0-indexed 11, header: 'checkForThis')
      const colLHeader = sheet.headerValues?.[11];
      const rawCheckForThis =
        (colLHeader ? row.get(colLHeader) : undefined) ??
        row.get("checkForThis") ??
        (row as any)._rawData?.[11];
      const checkStr = rawCheckForThis?.toString().trim().toLowerCase();
      const isCheckForThis = checkStr === "true" || checkStr === "ture";

      const colMHeader = sheet.headerValues?.[12];
      const rawCheckPortfolio =
        (colMHeader ? row.get(colMHeader) : undefined) ??
        row.get("checkPortfolio") ??
        (row as any)._rawData?.[12];
      const checkPortfolioStr = rawCheckPortfolio?.toString().trim().toLowerCase();
      const isCheckPortfolio = checkPortfolioStr === "true" || checkPortfolioStr === "ture";

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
        checkForThis: isCheckForThis,
        checkPortfolio: isCheckPortfolio,
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

export async function appendAutoBuySellTrade(params: {
  symbol: string;
  qty: string | number;
  price?: string | number;
  action?: string;
}): Promise<{
  success: boolean;
  rowNumber: number;
  sn: number;
  symbol: string;
  qty: string;
  price: string;
  action: string;
  time: string;
}> {
  return callWithRetry(async () => {
    const sheet = doc.sheetsByTitle["autoBuySellScript"];
    if (!sheet) throw new Error('Sheet "autoBuySellScript" not found');

    // 1. Current Date & Time formatted for Kathmandu + extra 2 minutes (now + 120,000 ms)
    const now = new Date();
    const scheduledEpoch = new Date(now.getTime() + 2 * 60 * 1000); // Kathmandu current time: now + 2 min
    const pad = (n: number) => String(n).padStart(2, '0');
    const kathmanduTime = new Date(scheduledEpoch.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
    const scheduledDateTimeStr = `${kathmanduTime.getFullYear()}-${pad(kathmanduTime.getMonth() + 1)}-${pad(kathmanduTime.getDate())} ${pad(kathmanduTime.getHours())}:${pad(kathmanduTime.getMinutes())}:${pad(kathmanduTime.getSeconds())}`;

    // Load cells up to row 200 (Columns A through F)
    // Row 0 is Row 1 ("Time", ScheduledTime, ...)
    // Row 1 is Row 2 (Headers: S.N, Symbol, qty, price, action, ...)
    // Rows 2+ are Row 3+ (Trades)
    await sheet.loadCells("A1:F200");

    // 2. Update Cell B1 with Kathmandu current time + extra 2 min
    const cellB1 = sheet.getCell(0, 1);
    cellB1.value = scheduledDateTimeStr;

    // 3. Find first empty row starting from row index 2 (Row 3)
    let targetRowIndex = -1;
    let lastSN = 0;

    for (let r = 2; r < 200; r++) {
      const symVal = sheet.getCell(r, 1).value;
      const snVal = sheet.getCell(r, 0).value;
      if (snVal !== null && snVal !== undefined && !isNaN(Number(snVal))) {
        lastSN = Math.max(lastSN, Number(snVal));
      }

      if (!symVal || String(symVal).trim() === '') {
        targetRowIndex = r;
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('No empty row available in autoBuySellScript (checked up to row 200)');
    }

    const nextSN = lastSN > 0 ? lastSN + 1 : (targetRowIndex - 1);
    const action = (params.action || 'SELL').trim().toUpperCase();
    const symbol = String(params.symbol).trim().toUpperCase();
    const qty = String(params.qty || '0').trim();
    const rawPrice = params.price !== undefined && params.price !== null ? String(params.price).trim() : '';
    // If price is blank or '0', leave it blank in Google Sheet (so dynamic market price can be used)
    const price = (rawPrice === '' || rawPrice === '0') ? '' : (Number(rawPrice) || rawPrice);

    // Populate Columns:
    // Col A (0): S.N
    // Col B (1): Symbol
    // Col C (2): qty
    // Col D (3): price (blank if empty/0)
    // Col E (4): action (SELL)
    // Col F (5): Formula =C{rowNumber}*D{rowNumber}
    const rowNumber = targetRowIndex + 1; // 1-indexed for Excel/Sheet formula

    sheet.getCell(targetRowIndex, 0).value = nextSN;
    sheet.getCell(targetRowIndex, 1).value = symbol;
    sheet.getCell(targetRowIndex, 2).value = Number(qty) || qty;
    sheet.getCell(targetRowIndex, 3).value = price;
    sheet.getCell(targetRowIndex, 4).value = action;
    sheet.getCell(targetRowIndex, 5).formula = `=C${rowNumber}*D${rowNumber}`;

    await sheet.saveUpdatedCells();

    console.log(`✅ [autoBuySellScript] Appended SELL order: Row ${rowNumber}, S.N ${nextSN}, Symbol ${symbol}, Qty ${qty}, Price ${price || 'BLANK (Market)'}, Action ${action}, Time updated: ${scheduledDateTimeStr}`);

    return {
      success: true,
      rowNumber,
      sn: nextSN,
      symbol,
      qty,
      price: price ? String(price) : '',
      action,
      time: scheduledDateTimeStr
    };
  });
}

export async function overridePortfolioData(
  holdings: { symbol: string, quantity: string }[]
) {
  return callWithRetry(async () => {
    const tabName = "Portfolio";
    const headers = ["Symbol", "Quantity"];

    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues: headers });
    } else {
      await sheet.clear();
      await sheet.setHeaderRow(headers);
    }

    const rowsToAdd = holdings.map((holding) => ({
      Symbol: holding.symbol,
      Quantity: holding.quantity
    }));

    if (rowsToAdd.length > 0) {
      await sheet.addRows(rowsToAdd);
    }
  });
}

export async function overrideTechnicalSignalsData(
  signals: { symbol: string, signal: string, rsi: string }[]
) {
  return callWithRetry(async () => {
    const tabName = "TechnicalSignals";
    const headers = ["Symbol", "Signal", "RSI"];

    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues: headers });
    } else {
      await sheet.clear();
      await sheet.setHeaderRow(headers);
    }

    const rowsToAdd = signals.map((s) => ({
      Symbol: s.symbol,
      Signal: s.signal,
      RSI: s.rsi
    }));

    if (rowsToAdd.length > 0) {
      await sheet.addRows(rowsToAdd);
    }
  });
}

export interface Week52Record {
  category: string;
  symbol: string;
  ltp: string;
  highPrice: string;
  highDate: string;
  lowPrice: string;
  lowDate: string;
  rangePercent: string;
  updatedAt?: string;
}

export async function override52WeekData(records: Week52Record[]) {
  return callWithRetry(async () => {
    const tabName = "52WeekHighLow";
    const headers = [
      "Category",
      "Symbol",
      "LTP",
      "52W High",
      "52W High Date",
      "52W Low",
      "52W Low Date",
      "Range %",
      "Updated At",
    ];

    let sheet = doc.sheetsByTitle[tabName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tabName, headerValues: headers });
    } else {
      await sheet.clear();
      await sheet.setHeaderRow(headers);
    }

    const rowsToAdd = records.map((r) => ({
      Category: r.category,
      Symbol: r.symbol,
      LTP: r.ltp,
      "52W High": r.highPrice,
      "52W High Date": r.highDate,
      "52W Low": r.lowPrice,
      "52W Low Date": r.lowDate,
      "Range %": r.rangePercent,
      "Updated At": r.updatedAt || new Date().toLocaleString(),
    }));

    if (rowsToAdd.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < rowsToAdd.length; i += chunkSize) {
        const chunk = rowsToAdd.slice(i, i + chunkSize);
        await sheet.addRows(chunk);
      }
    }
  });
}

export { doc, callWithRetry };
