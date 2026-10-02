/**
 * =============================================================================
 * sltpHit.js — Automated Stop Loss (ST) & Take Profit (TP) Live Monitor
 * 
 * - Monitors portfolio in the 'yogen' sheet tab starting from Row 6
 * - Reads:
 *     Column A (index 0, Col 1): Stock Symbol
 *     Column L (index 11, Col 12): ST (Stop Loss price)
 *     Column M (index 12, Col 13): TP (Take Profit / Target price)
 * - Data range: Columns A to M (13 columns)
 * - Compares with Live Trading data:
 *     - Only matches rows where Symbol exists in Live Data (otherwise discarded)
 *     - Discards rows where both SL and TP are empty / <= 0
 *     - SL Trigger: Day Low <= ST (Stop Loss hit / breached in the day)
 *     - TP Trigger: Day High >= TP (Take Profit hit / crossed in the day)
 * - Output Sheet: 'SL_TP_Hits'
 *     - Copies the full row (Columns A to M) from 'yogen'
 *     - Appends trigger details: Event Type, Trigger Time, LTP, Day High, Day Low, % Change
 *     - Prevents duplicate rows for the same stock on the same trading day
 *     - Color-codes triggered cells in 'yogen' (Red for SL, Green for TP)
 *     - Sends instant Telegram alert notification if configured
 * =============================================================================
 */

const YOGEN_SHEET_NAME = "yogen";
const YOGEN_START_ROW = 6; // Row index 6 (1-based)
const TARGET_ALERT_SHEET = "SL_TP_Hits";

/**
 * Main function: Scans 'yogen' sheet against live market data for SL & TP triggers
 */
function scanStocksForSLTP() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var yogenSheet = ss.getSheetByName(YOGEN_SHEET_NAME);
  
  if (!yogenSheet) {
    Logger.log("⚠️ Sheet '" + YOGEN_SHEET_NAME + "' not found.");
    return { triggered: 0, error: "Sheet '" + YOGEN_SHEET_NAME + "' not found" };
  }

  var lastRow = yogenSheet.getLastRow();
  if (lastRow < YOGEN_START_ROW) {
    Logger.log("ℹ️ No data rows found starting from Row " + YOGEN_START_ROW + " in '" + YOGEN_SHEET_NAME + "'.");
    return { triggered: 0, message: "No data rows" };
  }

  // 1. Build Live Market Data Map
  var liveMap = getLiveTradingDataMap();
  if (Object.keys(liveMap).length === 0) {
    Logger.log("⚠️ Live trading data is empty. Attempting live fetch...");
    if (typeof fetchLiveTradingData === "function") {
      try {
        fetchLiveTradingData();
        liveMap = getLiveTradingDataMap();
      } catch (e) {
        Logger.log("Live fetch attempt error: " + e.message);
      }
    }
  }

  if (Object.keys(liveMap).length === 0) {
    Logger.log("❌ Could not obtain live trading data. Aborting SL/TP scan.");
    return { triggered: 0, error: "No live data available" };
  }

  // 2. Read 'yogen' sheet rows from Row 6 to LastRow, Columns A to M (13 columns)
  var numRows = lastRow - YOGEN_START_ROW + 1;
  var dataRange = yogenSheet.getRange(YOGEN_START_ROW, 1, numRows, 13);
  var values = dataRange.getValues();

  // 3. Prepare or Get Target Alert Sheet ('SL_TP_Hits')
  var alertSheet = getOrCreateAlertSheet(ss, yogenSheet);
  var existingHits = getExistingHitsToday(alertSheet);

  var triggeredCount = 0;
  var timestamp = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd HH:mm:ss");
  var todayDate = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd");
  var alertsToTelegram = [];

  // 4. Iterate rows and evaluate SL / TP conditions
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var sheetRowNumber = YOGEN_START_ROW + i;

    // Col A (index 0): Symbol
    var rawSymbol = row[0];
    if (!rawSymbol) continue;
    var symbol = String(rawSymbol).trim().toUpperCase();
    if (!symbol || symbol === "SYMBOL") continue;

    // Col L (index 11): Stop Loss (ST)
    var sl = parsePriceNum(row[11]);
    // Col M (index 12): Take Profit (TP)
    var tp = parsePriceNum(row[12]);

    // Discard row if both SL and TP are not set (> 0)
    if (sl <= 0 && tp <= 0) {
      continue;
    }

    // Match with Live Data: if not present in live data, discard
    var live = liveMap[symbol];
    if (!live) {
      continue;
    }

    var isSlHit = false;
    var isTpHit = false;

    // Condition 1: SL hit low price in that day (Day Low <= SL)
    if (sl > 0 && live.low > 0 && live.low <= sl) {
      isSlHit = true;
    }

    // Condition 2: TP hit / crossed high price in that day (Day High >= TP)
    if (tp > 0 && live.high > 0 && live.high >= tp) {
      isTpHit = true;
    }

    if (!isSlHit && !isTpHit) {
      continue;
    }

    // Determine Trigger Event Type
    var triggerType = "";
    var triggerBadge = "";
    if (isSlHit && isTpHit) {
      triggerType = "BOTH HIT";
      triggerBadge = "⚠️ SL & TP BOTH HIT";
    } else if (isSlHit) {
      triggerType = "SL HIT";
      triggerBadge = "🛑 STOP LOSS HIT (Low <= SL)";
    } else if (isTpHit) {
      triggerType = "TP HIT";
      triggerBadge = "🎯 TAKE PROFIT HIT (High >= TP)";
    }

    // Deduplication check: Avoid adding duplicate rows for the same stock + triggerType today
    var hitKey = todayDate + "_" + symbol + "_" + triggerType;
    if (existingHits[hitKey]) {
      // Already logged today
      continue;
    }
    existingHits[hitKey] = true;

    // Copy full row (Col A to M) + Extra Trigger Metadata
    var alertRow = [
      row[0],  // Col A: Symbol
      row[1],  // Col B
      row[2],  // Col C
      row[3],  // Col D
      row[4],  // Col E
      row[5],  // Col F
      row[6],  // Col G
      row[7],  // Col H
      row[8],  // Col I
      row[9],  // Col J
      row[10], // Col K
      row[11], // Col L: SL
      row[12], // Col M: TP
      triggerBadge, // Col N: Trigger Type
      timestamp,    // Col O: Triggered At
      live.ltp,     // Col P: Live LTP
      live.high,    // Col Q: Day High
      live.low,     // Col R: Day Low
      live.pctChg   // Col S: % Change
    ];

    alertSheet.appendRow(alertRow);
    triggeredCount++;

    // Format new row in alert sheet
    var newRowIdx = alertSheet.getLastRow();
    if (isSlHit && !isTpHit) {
      alertSheet.getRange(newRowIdx, 14).setBackground("#FFCDD2").setFontWeight("bold"); // Red badge
    } else if (isTpHit && !isSlHit) {
      alertSheet.getRange(newRowIdx, 14).setBackground("#C8E6C9").setFontWeight("bold"); // Green badge
    } else {
      alertSheet.getRange(newRowIdx, 14).setBackground("#FFE082").setFontWeight("bold"); // Orange badge
    }

    // Visual Highlighting on 'yogen' sheet
    try {
      if (isSlHit) {
        yogenSheet.getRange(sheetRowNumber, 12).setBackground("#FFCDD2"); // Col L (SL) Red
      }
      if (isTpHit) {
        yogenSheet.getRange(sheetRowNumber, 13).setBackground("#C8E6C9"); // Col M (TP) Green
      }
    } catch (_) {}

    // Prepare Telegram Alert Message
    alertsToTelegram.push(
      (isSlHit && isTpHit ? "⚠️" : (isSlHit ? "🛑" : "🎯")) +
      " <b>" + symbol + " " + triggerType + "</b>\n" +
      "• <b>LTP:</b> " + live.ltp + " (" + live.pctChg + "%)\n" +
      "• <b>Day Range:</b> Low " + live.low + " — High " + live.high + "\n" +
      (sl > 0 ? "• <b>Stop Loss (Col L):</b> " + sl + (isSlHit ? " 🚨 <i>HIT</i>" : "") + "\n" : "") +
      (tp > 0 ? "• <b>Take Profit (Col M):</b> " + tp + (isTpHit ? " 🎯 <i>HIT</i>" : "") + "\n" : "") +
      "• <b>Time:</b> <i>" + timestamp + "</i>"
    );

    Logger.log("⚡ [" + triggerType + "] " + symbol + " -> Low: " + live.low + ", High: " + live.high + ", SL: " + sl + ", TP: " + tp);
  }

  // 5. Send Telegram Notification if triggers fired
  if (alertsToTelegram.length > 0) {
    sendTelegramAlertsBatch(alertsToTelegram);
  }

  Logger.log("✅ [SL/TP Scan Finished] Scanned " + values.length + " rows. New triggers fired: " + triggeredCount);
  return { triggered: triggeredCount, timestamp: timestamp };
}

/**
 * Builds a fast lookup map of live stock prices from 'live trading' sheet tab
 * Returns { SYMBOL: { ltp, high, low, pctChg, open } }
 */
function getLiveTradingDataMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("live trading");
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {};

  var map = {};
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var sym = String(r[1] || "").trim().toUpperCase(); // Col B (index 1): Symbol
    if (!sym) continue;

    var ltp = parsePriceNum(r[2]);   // Col C: LTP
    var pctChg = parsePriceNum(r[4]);// Col E: % Change
    var open = parsePriceNum(r[5]);  // Col F: Open
    var high = parsePriceNum(r[6]);  // Col G: High
    var low = parsePriceNum(r[7]);   // Col H: Low

    map[sym] = {
      ltp: ltp,
      pctChg: pctChg,
      open: open,
      high: high,
      low: low
    };
  }
  return map;
}

/**
 * Gets or creates the 'SL_TP_Hits' sheet with styled header columns
 */
function getOrCreateAlertSheet(ss, yogenSheet) {
  var alertSheet = ss.getSheetByName(TARGET_ALERT_SHEET);
  if (alertSheet) return alertSheet;

  alertSheet = ss.insertSheet(TARGET_ALERT_SHEET);

  // Read header labels from 'yogen' sheet row 5 (or row 4)
  var headersAtoM = [];
  try {
    var yHeaders = yogenSheet.getRange(5, 1, 1, 13).getValues()[0];
    for (var k = 0; k < 13; k++) {
      var h = String(yHeaders[k] || "").trim();
      headersAtoM.push(h || ("Col " + String.fromCharCode(65 + k)));
    }
  } catch (_) {
    headersAtoM = ["Symbol", "Sector", "Kitta", "Share Value", "Total", "Purchase Price", "Purchase Total", "Profit/Loss", "Date", "Days", "Profit %", "SL (Col L)", "TP (Col M)"];
  }

  // Ensure headers for L and M are explicitly labeled
  if (!headersAtoM[11] || headersAtoM[11].toLowerCase().indexOf("sl") === -1) {
    headersAtoM[11] = "Stop Loss (ST)";
  }
  if (!headersAtoM[12] || headersAtoM[12].toLowerCase().indexOf("tp") === -1) {
    headersAtoM[12] = "Take Profit (TP)";
  }

  var fullHeaders = headersAtoM.concat([
    "Trigger Event",
    "Triggered At",
    "Live LTP",
    "Day High",
    "Day Low",
    "Day % Change"
  ]);

  alertSheet.getRange(1, 1, 1, fullHeaders.length)
    .setValues([fullHeaders])
    .setBackground("#263238")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  alertSheet.setFrozenRows(1);
  return alertSheet;
}

/**
 * Returns a dictionary of existing hit keys logged today to prevent duplicate spam
 */
function getExistingHitsToday(alertSheet) {
  var map = {};
  var lastRow = alertSheet.getLastRow();
  if (lastRow <= 1) return map;

  var todayDate = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd");
  var data = alertSheet.getRange(2, 1, lastRow - 1, 15).getValues();

  for (var i = 0; i < data.length; i++) {
    var sym = String(data[i][0] || "").trim().toUpperCase();
    var triggerEvent = String(data[i][13] || "").trim(); // Col N
    var trigAt = String(data[i][14] || "").trim();      // Col O: Timestamp

    if (sym && trigAt.indexOf(todayDate) !== -1) {
      var key = todayDate + "_" + sym + "_" + (triggerEvent.indexOf("BOTH") !== -1 ? "BOTH HIT" : (triggerEvent.indexOf("SL") !== -1 ? "SL HIT" : "TP HIT"));
      map[key] = true;
    }
  }
  return map;
}

/**
 * Helper to parse prices cleanly removing commas and currency symbols
 */
function parsePriceNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  var cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Sends a batch of triggered alerts to Telegram if configured
 */
function sendTelegramAlertsBatch(alertMessages) {
  try {
    if (typeof getAppStatusConfig !== "function" || typeof sendTelegramMessage !== "function") {
      return;
    }

    var config = getAppStatusConfig();
    var token = config.TELEGRAM_BOT_TOKEN;
    var chatId = config.TELEGRAM_CHAT_ID;

    if (!token || token === "YOUR_TELEGRAM_BOT_TOKEN" || !chatId || chatId === "YOUR_TELEGRAM_CHAT_ID") {
      return;
    }

    var header = "🚨 <b>NEPSE PORTFOLIO TRIGGER ALERT ('yogen')</b>\n\n";
    var combinedText = header + alertMessages.join("\n\n────────────────\n\n");

    sendTelegramMessage(combinedText, token, chatId);
    Logger.log("📱 Telegram SL/TP alert sent (" + alertMessages.length + " stock(s))");
  } catch (err) {
    Logger.log("Telegram alert send error: " + err.message);
  }
}

// =============================================================================
// Automated 10-Minute Trigger Setup & Teardown
// =============================================================================

/**
 * Scheduled Job: Fetches live data and triggers SL/TP check
 * Designed to run every 10 minutes during market hours
 */
function runLiveFetchAndScanSLTP() {
  Logger.log("[10-Min Trigger] Running live data fetch & SL/TP scan...");
  try {
    if (typeof fetchLiveTradingData === "function") {
      fetchLiveTradingData(); // Fetches live data & automatically calls scanStocksForSLTP
    } else {
      scanStocksForSLTP();
    }
  } catch (err) {
    Logger.log("[10-Min Trigger Error] " + err.message);
  }
}

/**
 * Sets up an automated trigger to run every 10 minutes
 */
function setup10MinLiveScanTrigger() {
  remove10MinLiveScanTrigger();

  ScriptApp.newTrigger("runLiveFetchAndScanSLTP")
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log("✅ Trigger configured: runLiveFetchAndScanSLTP will run every 10 minutes.");

  try {
    SpreadsheetApp.getUi().alert(
      "✅ 10-Minute Live SL/TP Trigger Configured!\n\n" +
      "• Function: runLiveFetchAndScanSLTP\n" +
      "• Schedule: Every 10 Minutes\n" +
      "• Actions: Fetches Live Trading data, scans 'yogen' sheet (Rows 6+), logs hits to 'SL_TP_Hits', alerts Telegram."
    );
  } catch (_) {}
}

/**
 * Removes the 10-minute automated trigger
 */
function remove10MinLiveScanTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runLiveFetchAndScanSLTP") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log("Removed " + count + " trigger(s) for runLiveFetchAndScanSLTP.");
}