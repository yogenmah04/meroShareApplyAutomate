/**
 * =============================================================================
 * sltpHit.js — Trading Automation System (Stage 1 & Stage 2)
 * 
 * 1. Initial Stock Filter & Duplicate Prevention (Google Apps Script)
 *    - Source Sheet: 'yogen' (Row 6 onwards)
 *    - Target Sheet: 'SLTP-stocks'
 *    - Columns: SL (Col L), TP (Col M), Data range (Cols A to M)
 *    - Frequency: Every 1 hr daily.
 *    - Logic: Filters eligible stocks (SL > 0 or TP > 0), generates Unique ID
 *      (symbol-kitta-Purchase Price-Purchase date), places it at Col A of
 *      'SLTP-stocks', and appends/syncs data without duplicate entries.
 * 
 * 2. Live Price Monitoring & Hit Detection (Google Apps Script)
 *    - Source Sheets: 'SLTP-stocks' and 'live trading'
 *    - Target Sheet: 'SL-TP-Hits'
 *    - Frequency: Every 10 min when live trading script runs during market hours (checks 'Report'!B1).
 *    - Logic: Compares SL/TP of each stock against live prices.
 *      On match, records row to 'SL-TP-Hits' with Status = FALSE for Node.js queue pickup.
 * =============================================================================
 */

const SOURCE_YOGEN_SHEET = "yogen";
const YOGEN_DATA_START_ROW = 6;
const STOCKS_FILTER_SHEET = "SLTP-stocks";
const HITS_ALERT_SHEET = "SL-TP-Hits";
const REPORT_SHEET_NAME = "Report";

// =============================================================================
// STAGE 1: Initial Stock Filter & Duplicate Prevention (Hourly)
// =============================================================================

/**
 * Stage 1: Scans 'yogen' sheet, filters eligible stocks with SL/TP,
 * generates Unique ID (symbol-kitta-purchasePrice-purchaseDate), and syncs
 * to 'SLTP-stocks' sheet without duplicates.
 */
function syncYogenToSLTPStocks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var yogenSheet = ss.getSheetByName(SOURCE_YOGEN_SHEET);

  if (!yogenSheet) {
    Logger.log("⚠️ Source sheet '" + SOURCE_YOGEN_SHEET + "' not found.");
    return { success: false, message: "Sheet '" + SOURCE_YOGEN_SHEET + "' not found" };
  }

  var lastRow = yogenSheet.getLastRow();
  if (lastRow < YOGEN_DATA_START_ROW) {
    Logger.log("ℹ️ No data rows starting from Row " + YOGEN_DATA_START_ROW + " in '" + SOURCE_YOGEN_SHEET + "'.");
    return { success: true, count: 0 };
  }

  // 1. Read 'yogen' sheet rows from Row 6 to lastRow, Cols A to M (13 columns)
  var numRows = lastRow - YOGEN_DATA_START_ROW + 1;
  var values = yogenSheet.getRange(YOGEN_DATA_START_ROW, 1, numRows, 13).getValues();

  // 2. Prepare or Get Target Sheet ('SLTP-stocks')
  var targetSheet = getOrCreateSLTPStocksSheet(ss);

  // 3. Read existing Unique IDs in 'SLTP-stocks' to prevent duplicates
  var existingMap = getExistingSLTPStocksMap(targetSheet);

  var timestamp = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd HH:mm:ss");
  var addedCount = 0;
  var updatedCount = 0;
  var rowsToAppend = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];

    // Col A (idx 0): Symbol
    var rawSymbol = row[0];
    if (!rawSymbol) continue;
    var symbol = String(rawSymbol).trim().toUpperCase();
    if (!symbol || symbol === "SYMBOL" || symbol === "TOTAL") continue;

    // Col C (idx 2): kitta
    var kitta = row[2] !== "" && row[2] !== null ? String(row[2]).trim() : "0";

    // Col F (idx 5): purchase price
    var purchasePrice = row[5] !== "" && row[5] !== null ? String(row[5]).trim() : "0";

    // Col I (idx 8): purchase date
    var purchaseDate = formatPurchaseDate(row[8]);

    // Col L (idx 11): Stop Loss (ST)
    var sl = parsePriceNum(row[11]);

    // Col M (idx 12): Take Profit (TP)
    var tp = parsePriceNum(row[12]);

    // Filter eligible stocks: Must have at least SL > 0 or TP > 0
    if (sl <= 0 && tp <= 0) {
      continue;
    }

    // Generate Unique ID: symbol-kitta-Purchase Price-Purchase date
    var uniqueId = generateUniqueStockId(symbol, kitta, purchasePrice, purchaseDate);

    // Row payload: Col A = Unique ID, Cols B to N = Cols A to M from 'yogen', Col O = Synced At
    var rowData = [
      uniqueId,
      row[0],  // Col B: Symbol
      row[1],  // Col C: Sector
      row[2],  // Col D: kitta
      row[3],  // Col E: share value
      row[4],  // Col F: total
      row[5],  // Col G: purchase price
      row[6],  // Col H: purchase total
      row[7],  // Col I: profit / loss
      purchaseDate, // Col J: purchase date (consistently formatted as YYYY-MM-DD)
      row[9],  // Col K: count days
      row[10], // Col L: profit or loss %
      row[11], // Col M: ST (Stop Loss)
      row[12], // Col N: TP (Take Profit)
      timestamp // Col O: Last Synced
    ];

    if (existingMap[uniqueId]) {
      // Row already exists in 'SLTP-stocks' -> update its values (e.g. SL, TP, share value)
      var targetRowIndex = existingMap[uniqueId];
      targetSheet.getRange(targetRowIndex, 1, 1, rowData.length).setValues([rowData]);
      updatedCount++;
    } else {
      // New eligible stock -> append to 'SLTP-stocks'
      rowsToAppend.push(rowData);
      existingMap[uniqueId] = targetSheet.getLastRow() + rowsToAppend.length;
      addedCount++;
    }
  }

  // Batch append new unique rows
  if (rowsToAppend.length > 0) {
    targetSheet.getRange(targetSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }

  Logger.log("✅ [Stage 1 Complete] 'yogen' -> 'SLTP-stocks' synced. Added: " + addedCount + ", Updated: " + updatedCount);
  return { success: true, added: addedCount, updated: updatedCount, timestamp: timestamp };
}

/**
 * Generates a clean, consistent Unique ID for each stock holding
 * Format: SYMBOL-KITTA-PURCHASEPRICE-PURCHASEDATE
 */
function generateUniqueStockId(symbol, kitta, purchasePrice, purchaseDate) {
  var cleanSym = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  var cleanKitta = String(kitta || "0").trim().replace(/,/g, "");
  var cleanPrice = String(purchasePrice || "0").trim().replace(/,/g, "");
  var cleanDate = String(purchaseDate || "NODATE").trim().replace(/[^A-Za-z0-9]/g, "-");
  return cleanSym + "-" + cleanKitta + "-" + cleanPrice + "-" + cleanDate;
}

/**
 * Formats purchase date cleanly whether it is a Date object, Excel serial number, or string
 */
function formatPurchaseDate(val) {
  if (!val) return "NODATE";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "Asia/Kathmandu", "yyyy-MM-dd");
  }

  var num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 65000) {
    try {
      var d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return Utilities.formatDate(d, "Asia/Kathmandu", "yyyy-MM-dd");
    } catch (_) {
      return String(val);
    }
  }

  var s = String(val).trim();
  if (!s) return "NODATE";

  // ISO format YYYY-MM-DD or YYYY/MM/DD
  var isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    var pad = function(n) { return String(n).padStart(2, "0"); };
    return isoMatch[1] + "-" + pad(isoMatch[2]) + "-" + pad(isoMatch[3]);
  }

  // US format MM/DD/YYYY or M/D/YY
  var usMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (usMatch) {
    var y = usMatch[3];
    if (y.length === 2) y = Number(y) > 50 ? "19" + y : "20" + y;
    var pad = function(n) { return String(n).padStart(2, "0"); };
    return y + "-" + pad(usMatch[1]) + "-" + pad(usMatch[2]);
  }

  return s.replace(/[\/\s]/g, "-");
}

/**
 * Gets or creates the 'SLTP-stocks' sheet tab with styled header
 */
function getOrCreateSLTPStocksSheet(ss) {
  var sheet = ss.getSheetByName(STOCKS_FILTER_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(STOCKS_FILTER_SHEET);

  var headers = [
    "Unique ID",
    "Symbol",
    "Sector",
    "kitta",
    "share value",
    "total",
    "purchase price",
    "purchase total",
    "profit / loss",
    "purchase date",
    "count days",
    "profit or loss %",
    "ST (Stop Loss)",
    "TP (Take Profit)",
    "Last Synced"
  ];

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground("#1E3A8A") // Dark Blue
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Maps existing Unique IDs to row numbers in 'SLTP-stocks'
 */
function getExistingSLTPStocksMap(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || "").trim();
    if (id) {
      map[id] = i + 2; // 1-based row index
    }
  }
  return map;
}

// =============================================================================
// STAGE 2: Live Price Monitoring & Hit Detection (Every 10 Min)
// =============================================================================

/**
 * Stage 2: Fetches all records from 'SLTP-stocks', compares SL/TP values
 * against live prices, and appends triggered stocks to 'SL-TP-Hits' with Status = FALSE
 * for Node.js queue pickup.
 *
 * @param {boolean} [isScheduled=false] - If true, checks Report!B1 and skips if market is closed.
 *                                        If false (manual run), proceeds and notifies user.
 */
function scanSLTPStocksAgainstLive(isScheduled) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Market Open Check: Read 'Report'!B1.
  var reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);
  var isMarketClosed = false;
  var marketStatusText = "";
  if (reportSheet) {
    marketStatusText = String(reportSheet.getRange("B1").getValue() || "").trim();
    var b1 = marketStatusText.toLowerCase();
    if (b1.indexOf("market close") !== -1 || b1.indexOf("closed") !== -1 || b1 === "close") {
      isMarketClosed = true;
    }
  }

  // Only automated scheduled triggers skip on market closed; manual runs proceed with available live data
  if (isScheduled && isMarketClosed) {
    Logger.log("ℹ️ [Stage 2 Skipped] 'Report'!B1 says '" + marketStatusText + "'. Market is closed.");
    return {
      success: true,
      scannedCount: 0,
      matchedCount: 0,
      triggeredCount: 0,
      alreadyRecordedCount: 0,
      triggeredList: [],
      reason: "Market Closed (" + marketStatusText + ")",
      marketStatus: marketStatusText
    };
  }

  if (isMarketClosed) {
    Logger.log("ℹ️ [Stage 2 Manual Run] 'Report'!B1 says '" + marketStatusText + "', evaluating with current live data.");
  }

  // 2. Read 'SLTP-stocks'
  var sltpStocksSheet = ss.getSheetByName(STOCKS_FILTER_SHEET);
  if (!sltpStocksSheet) {
    Logger.log("⚠️ Sheet '" + STOCKS_FILTER_SHEET + "' not found. Running Stage 1 sync first...");
    syncYogenToSLTPStocks();
    sltpStocksSheet = ss.getSheetByName(STOCKS_FILTER_SHEET);
    if (!sltpStocksSheet) return { success: false, error: "SLTP-stocks not found" };
  }

  var lastRow = sltpStocksSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("ℹ️ No stocks in '" + STOCKS_FILTER_SHEET + "'. Running Stage 1 sync...");
    syncYogenToSLTPStocks();
    lastRow = sltpStocksSheet.getLastRow();
    if (lastRow <= 1) {
      return {
        success: true,
        scannedCount: 0,
        matchedCount: 0,
        triggeredCount: 0,
        alreadyRecordedCount: 0,
        triggeredList: [],
        reason: "No stocks in filter",
        marketStatus: marketStatusText
      };
    }
  }

  // 3. Build Live Market Data Map
  var liveMap = getLiveTradingDataMap();
  if (Object.keys(liveMap).length === 0) {
    Logger.log("⚠️ Live trading data empty in sheet. Attempting live fetch...");
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
    Logger.log("❌ Could not obtain live trading data. Aborting SL/TP hit scan.");
    return { success: false, error: "No live data available in 'live trading' sheet tab" };
  }

  // 4. Read all stock records in 'SLTP-stocks'
  // Columns: [Unique ID, Symbol, Sector, kitta, share value, total, purchase price, purchase total, profit/loss, purchase date, count days, profit%, ST, TP, Last Synced]
  var stockData = sltpStocksSheet.getRange(2, 1, lastRow - 1, 15).getValues();

  // 5. Prepare Target Sheet ('SL-TP-Hits')
  var hitsSheet = getOrCreateSLTPHitsSheet(ss);
  var todayDate = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd");
  var timestamp = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd HH:mm:ss");
  var existingHitsUniqueIds = getExistingUniqueIdsInHitsSheet(hitsSheet);

  var newHitsToAppend = [];
  var matchedCount = 0;
  var skippedAlreadyRecorded = 0;
  var triggeredList = [];

  for (var i = 0; i < stockData.length; i++) {
    var r = stockData[i];
    var uniqueId = String(r[0] || "").trim();
    var symbol = String(r[1] || "").trim().toUpperCase(); // Col B: Symbol

    if (!uniqueId || !symbol) continue;

    // Col M (idx 12): ST (Stop Loss)
    var sl = parsePriceNum(r[12]);
    // Col N (idx 13): TP (Take Profit)
    var tp = parsePriceNum(r[13]);

    if (sl <= 0 && tp <= 0) continue;

    // Match with Live Data: if not present in live data, discard/skip
    var live = liveMap[symbol];
    if (!live) continue;
    matchedCount++;

    var isSlHit = false;
    var isTpHit = false;

    // Condition 1: SL hit day low price (Day Low <= SL)
    if (sl > 0 && live.low > 0 && live.low <= sl) {
      isSlHit = true;
    }

    // Condition 2: TP hit / crossed day high price (Day High >= TP)
    if (tp > 0 && live.high > 0 && live.high >= tp) {
      isTpHit = true;
    }

    if (!isSlHit && !isTpHit) continue;

    // Unique ID Deduplication Check:
    // If that unique id is already present in 'SL-TP-Hits', do not put it!
    if (existingHitsUniqueIds[uniqueId]) {
      skippedAlreadyRecorded++;
      Logger.log("ℹ️ [Skipped] Unique ID '" + uniqueId + "' is already present in '" + HITS_ALERT_SHEET + "'. Skipping duplicate entry.");
      continue;
    }
    existingHitsUniqueIds[uniqueId] = true; // Mark as added to prevent duplicate within same batch

    // Trigger Type & Badge
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

    // Build Hit Row for 'SL-TP-Hits'
    // Cols A to N: Original data from 'SLTP-stocks' (Unique ID + Cols A..M of yogen)
    // Col O: Trigger Event
    // Col P: Triggered At
    // Col Q: Live LTP
    // Col R: Day High
    // Col S: Day Low
    // Col T: Day % Change
    // Col U: Status (FALSE initially for Node.js queue pickup!)
    // Col V: Processed At ("" initially, to be filled by Node.js)
    var hitRow = [
      uniqueId, // Col A: Unique ID
      r[1],     // Col B: Symbol
      r[2],     // Col C: Sector
      r[3],     // Col D: kitta
      r[4],     // Col E: share value
      r[5],     // Col F: total
      r[6],     // Col G: purchase price
      r[7],     // Col H: purchase total
      r[8],     // Col I: profit / loss
      r[9],     // Col J: purchase date
      r[10],    // Col K: count days
      r[11],    // Col L: profit or loss %
      r[12],    // Col M: ST
      r[13],    // Col N: TP
      triggerBadge, // Col O: Trigger Event
      timestamp,    // Col P: Triggered At
      live.ltp,     // Col Q: Live LTP
      live.high,    // Col R: Day High
      live.low,     // Col S: Day Low
      live.pctChg,  // Col T: Day % Change
      false,        // Col U: Status (FALSE -> unnotified queue item for Node.js!)
      ""            // Col V: Processed At (filled by Node.js upon sending Telegram alert)
    ];

    newHitsToAppend.push(hitRow);
    triggeredList.push({
      uniqueId: uniqueId,
      symbol: symbol,
      badge: triggerBadge,
      type: triggerType,
      sl: sl,
      tp: tp,
      ltp: live.ltp,
      low: live.low,
      high: live.high
    });

    Logger.log("⚡ [" + triggerType + "] " + uniqueId + " (LTP: " + live.ltp + ", Low: " + live.low + ", High: " + live.high + ")");
  }

  // 6. Append new hit rows to 'SL-TP-Hits'
  if (newHitsToAppend.length > 0) {
    var startAppendRow = hitsSheet.getLastRow() + 1;
    hitsSheet.getRange(startAppendRow, 1, newHitsToAppend.length, newHitsToAppend[0].length)
      .setValues(newHitsToAppend);

    // Apply color formatting
    for (var k = 0; k < newHitsToAppend.length; k++) {
      var badge = newHitsToAppend[k][14];
      var targetR = startAppendRow + k;
      if (badge.indexOf("STOP LOSS") !== -1) {
        hitsSheet.getRange(targetR, 15).setBackground("#FFCDD2").setFontWeight("bold"); // Red
      } else if (badge.indexOf("TAKE PROFIT") !== -1) {
        hitsSheet.getRange(targetR, 15).setBackground("#C8E6C9").setFontWeight("bold"); // Green
      } else {
        hitsSheet.getRange(targetR, 15).setBackground("#FFE082").setFontWeight("bold"); // Orange
      }
    }
  }

  Logger.log("✅ [Stage 2 Complete] 'SL-TP-Hits' updated. New hits recorded: " + newHitsToAppend.length + ", Already recorded: " + skippedAlreadyRecorded);
  return {
    success: true,
    scannedCount: stockData.length,
    matchedCount: matchedCount,
    triggeredCount: newHitsToAppend.length,
    alreadyRecordedCount: skippedAlreadyRecorded,
    triggeredList: triggeredList,
    timestamp: timestamp,
    marketStatus: marketStatusText
  };
}

/**
 * Manual menu trigger for Stage 2 Scan.
 * Runs on demand without market-closed abortion and shows a UI alert with clear details.
 */
function scanSLTPStocksAgainstLiveManual() {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (_) {}

  try {
    var res = scanSLTPStocksAgainstLive(false); // Manual run: do not skip on market close
    if (!res || !res.success) {
      if (ui) ui.alert("❌ Scan Error", "Error: " + (res ? res.error : "Unknown error"), ui.ButtonSet.OK);
      return;
    }

    var msg = "📊 Stage 2 Live Scan Finished!\n\n" +
      "• Stocks Evaluated in 'SLTP-stocks': " + (res.scannedCount || 0) + "\n" +
      "• Live Stocks Matched: " + (res.matchedCount || 0) + "\n" +
      "• New Hits Added to 'SL-TP-Hits': " + (res.triggeredCount || 0) + "\n";

    if (res.triggeredList && res.triggeredList.length > 0) {
      msg += "\n⚡ New Triggers Added:\n";
      for (var i = 0; i < res.triggeredList.length; i++) {
        var t = res.triggeredList[i];
        msg += "  • " + t.symbol + ": " + t.badge + " (LTP: " + t.ltp + ", Low: " + t.low + ", High: " + t.high + ")\n";
      }
      msg += "\n📬 New hits are set to Status = FALSE.\nNode.js queue service will send Telegram alerts within 30 seconds.";
    } else if (res.alreadyRecordedCount > 0) {
      msg += "\nℹ️ " + res.alreadyRecordedCount + " stock(s) matched SL/TP conditions, but their Unique ID is ALREADY present in 'SL-TP-Hits' sheet tab.\n(Skipped to prevent duplicate entries).";
    } else {
      msg += "\nℹ️ No stop loss or take profit targets reached in current live prices.";
    }

    if (res.marketStatus) {
      msg += "\n\n(Market Status in 'Report'!B1: " + res.marketStatus + ")";
    }

    if (ui) {
      ui.alert("Stage 2: SL/TP Live Hit Scanner", msg, ui.ButtonSet.OK);
    }
  } catch (err) {
    if (ui) ui.alert("❌ Exception Occurred", err.message, ui.ButtonSet.OK);
    Logger.log("scanSLTPStocksAgainstLiveManual error: " + err.message);
  }
}

/**
 * Manual menu trigger for Stage 1 Sync.
 * Runs on demand and shows a UI alert with clear details.
 */
function syncYogenToSLTPStocksManual() {
  var ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (_) {}

  try {
    var res = syncYogenToSLTPStocks();
    if (ui) {
      ui.alert(
        "✅ Stage 1 Sync Complete!",
        "• Source: 'yogen' (Row 6+)\n" +
        "• Target: 'SLTP-stocks'\n" +
        "• Newly Added: " + (res.added || 0) + "\n" +
        "• Updated: " + (res.updated || 0) + "\n\n" +
        "Stocks with ST > 0 or TP > 0 have been synced with Unique IDs.",
        ui.ButtonSet.OK
      );
    }
  } catch (err) {
    if (ui) ui.alert("❌ Stage 1 Error", err.message, ui.ButtonSet.OK);
  }
}

/**
 * Gets or creates the 'SL-TP-Hits' sheet tab with styled header
 */
function getOrCreateSLTPHitsSheet(ss) {
  var sheet = ss.getSheetByName(HITS_ALERT_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(HITS_ALERT_SHEET);

  var headers = [
    "Unique ID",
    "Symbol",
    "Sector",
    "kitta",
    "share value",
    "total",
    "purchase price",
    "purchase total",
    "profit / loss",
    "purchase date",
    "count days",
    "profit or loss %",
    "ST (Stop Loss)",
    "TP (Take Profit)",
    "Trigger Event",
    "Triggered At",
    "Live LTP",
    "Day High",
    "Day Low",
    "Day % Change",
    "Status",
    "Processed At"
  ];

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground("#263238") // Dark Slate
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * Reads all existing Unique IDs (Column A) from 'SL-TP-Hits' sheet tab.
 * If that Unique ID is present in that sheet tab, it will be skipped.
 */
function getExistingUniqueIdsInHitsSheet(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;

  var colAValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < colAValues.length; i++) {
    var uid = String(colAValues[i][0] || "").trim();
    if (uid) {
      map[uid] = true;
    }
  }
  return map;
}

/**
 * Builds live trading data lookup map from 'live trading' sheet tab
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
    var sym = String(r[1] || "").trim().toUpperCase(); // Col B (idx 1): Symbol
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
 * Helper to parse prices cleanly removing commas and currency symbols
 */
function parsePriceNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  var cleaned = String(val).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// =============================================================================
// Automated Triggers Setup & Teardown
// =============================================================================

/**
 * Combined 10-Minute Market Job: Fetches live data and runs Stage 2 Hit Detection
 */
function run10MinLiveTradingAndScan() {
  Logger.log("[10-Min Trigger] Checking market status before live trading fetch & scan...");
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);
    if (reportSheet) {
      var b1 = String(reportSheet.getRange("B1").getValue() || "").trim().toLowerCase();
      if (b1.indexOf("market close") !== -1 || b1.indexOf("closed") !== -1 || b1 === "close") {
        Logger.log("ℹ️ [10-Min Trigger Skipped] 'Report'!B1 says '" + b1 + "'. Market is closed.");
        return;
      }
    }

    if (typeof fetchLiveTradingData === "function") {
      fetchLiveTradingData(); // Fetches live data & automatically triggers scan
    } else {
      scanSLTPStocksAgainstLive(true);
    }
  } catch (err) {
    Logger.log("[10-Min Trigger Error] " + err.message);
  }
}

/**
 * Alias for backward compatibility
 */
function runLiveFetchAndScanSLTP() {
  run10MinLiveTradingAndScan();
}

function scanStocksForSLTP() {
  syncYogenToSLTPStocks();
  return scanSLTPStocksAgainstLive();
}

/**
 * Sets up the Hourly Sync Trigger (Stage 1: yogen -> SLTP-stocks)
 */
function setupHourlySLTPSyncTrigger() {
  removeTriggerByFunctionName("syncYogenToSLTPStocks");

  ScriptApp.newTrigger("syncYogenToSLTPStocks")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("✅ Trigger configured: syncYogenToSLTPStocks will run every 1 hour.");
}

/**
 * Sets up the 10-Minute Live Hit Scanner Trigger (Stage 2: SLTP-stocks -> SL-TP-Hits)
 */
function setup10MinLiveScanTrigger() {
  removeTriggerByFunctionName("run10MinLiveTradingAndScan");
  removeTriggerByFunctionName("runLiveFetchAndScanSLTP");

  ScriptApp.newTrigger("run10MinLiveTradingAndScan")
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log("✅ Trigger configured: run10MinLiveTradingAndScan will run every 10 minutes.");
}

/**
 * Sets up both automated triggers (Hourly Sync & 10-Minute Live Scan)
 */
function setupAllTradingAutomationTriggers() {
  setupHourlySLTPSyncTrigger();
  setup10MinLiveScanTrigger();

  try {
    SpreadsheetApp.getUi().alert(
      "✅ Trading Automation Triggers Configured!\n\n" +
      "1. Hourly Sync (Every 1 hr):\n" +
      "   • Function: syncYogenToSLTPStocks\n" +
      "   • Source: 'yogen' (Row 6+) -> Target: 'SLTP-stocks'\n" +
      "   • Generates Unique ID and prevents duplicate entries\n\n" +
      "2. Live Hit Detection (Every 10 mins during market hours):\n" +
      "   • Function: run10MinLiveTradingAndScan\n" +
      "   • Compares 'SLTP-stocks' against live data\n" +
      "   • Appends hits to 'SL-TP-Hits' with Status = FALSE for Node.js queue"
    );
  } catch (_) {}
}

/**
 * Removes automated SL/TP triggers
 */
function removeAllTradingAutomationTriggers() {
  var count = 0;
  count += removeTriggerByFunctionName("syncYogenToSLTPStocks");
  count += removeTriggerByFunctionName("run10MinLiveTradingAndScan");
  count += removeTriggerByFunctionName("runLiveFetchAndScanSLTP");

  Logger.log("Removed " + count + " SL/TP automation trigger(s).");
  try {
    SpreadsheetApp.getUi().alert("⏹️ Removed " + count + " SL/TP automation trigger(s).");
  } catch (_) {}
}

function removeTriggerByFunctionName(fnName) {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fnName) {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  return count;
}