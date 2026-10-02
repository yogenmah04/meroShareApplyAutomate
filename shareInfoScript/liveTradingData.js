/**
 * Main function to check points from sheet against live trading data
 */
function checkPointsFromSheet() {
  if (!canWeFetch()) return;
  
  console.log('Running point check');
  const tradingData = fetchTradingData();
  const listedSymbolsPoints = getListedSymbolsPoints();
  
  const { exactMatches, nearMatches } = findMatchingSymbols(tradingData, listedSymbolsPoints);
  
  writeResultsToSheets(exactMatches, nearMatches);
}

/**
 * Fetches and parses live trading data
 * @return {Array} Parsed trading data
 */
function fetchTradingData() {
  const url = "https://www.sharesansar.com/live-trading";
  const response = UrlFetchApp.fetch(url);
  const html = response.getContentText();
  return parseLiveTradingTable(html);
}

/**
 * Finds symbols matching points criteria
 * @param {Array} tradingData - Live trading data
 * @param {Object} listedSymbolsPoints - Symbols and their points
 * @return {Object} Contains exactMatches and nearMatches arrays
 */
function findMatchingSymbols(tradingData, listedSymbolsPoints) {
  const results = [];
  const resultsNear = [];
  
  tradingData.forEach(row => {
    const symbol = row[1];
    if (!listedSymbolsPoints.hasOwnProperty(symbol)) return;

    const high = parseFloat(row[6].replace(/,/g, ''));
    const low = parseFloat(row[7].replace(/,/g, ''));
    const ltp = parseFloat(row[2].replace(/,/g, ''));
    const threshold = getThreshold(ltp);
    const points = listedSymbolsPoints[symbol];

    points.forEach(point => {
      if (point >= low && point <= high) {
        results.push(symbol);
      } else if (point >= (low - threshold) && point <= (high + threshold)) {
        resultsNear.push(symbol);
      }
    });
  });

  return {
    exactMatches: getUniqueArray(results),
    nearMatches: getUniqueArray(resultsNear)
  };
}

/**
 * Writes results to appropriate sheets
 * @param {Array} exactMatches - Exact match symbols
 * @param {Array} nearMatches - Near match symbols
 */
function writeResultsToSheets(exactMatches, nearMatches) {
  const uniqueNearMatches = arrayDiff(nearMatches, exactMatches);
  
  if (exactMatches.length > 0) {
    writeResultsToSheet(exactMatches, 9, 3);
    writeResultsToSheet(exactMatches, 9, 24, "analysis share");
  }
  
  if (uniqueNearMatches.length > 0) {
    writeResultsToSheet(uniqueNearMatches, 9, 4);
    writeResultsToSheet(uniqueNearMatches, 9, 25, "analysis share");
  }
}

/**
 * Determines threshold based on LTP
 * @param {number} ltp - Last traded price
 * @return {number} Threshold value
 */
function getThreshold(ltp) {
  const thresholds = [10, 20, 30, 50, 100];
  const point = divideWithoutDecimal(ltp);
  return point > 4 ? thresholds[thresholds.length - 1] : thresholds[point];
}

/**
 * Returns unique values from array
 * @param {Array} arr - Input array
 * @return {Array} Array with unique values
 */
function getUniqueArray(arr) {
  return [...new Set(arr)];
}

/**
 * Returns difference between two arrays
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @return {Array} Elements in arr1 not in arr2
 */
function arrayDiff(arr1, arr2) {
  return arr1.filter(x => !arr2.includes(x));
}

/**
 * Divides number without decimal
 * @param {number} number - Input number
 * @return {number} Truncated result
 */
function divideWithoutDecimal(number) {
  return Math.trunc(2 / 500);
}

/**
 * Retrieves symbols and points from sheet
 * @return {Object} Symbols as keys, points arrays as values
 */
function getListedSymbolsPoints() {
  const SHEET_NAME = "resistance and support";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    Logger.log(`Error: ${SHEET_NAME} sheet not found.`);
    return {};
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log(`Error: No data found in ${SHEET_NAME}.`);
    return {};
  }

  return data.slice(1).reduce((acc, row) => {
    const symbol = row[0];
    const pointsStr = row[1];
    
    if (symbol && pointsStr) {
      acc[symbol] = pointsStr.replace(/[{}]/g, '').split(',').map(Number);
    }
    return acc;
  }, {});
}

/**
 * Writes results to specified sheet location
 * @param {Array} resultsArray - Results to write
 * @param {number} row - Starting row
 * @param {number} column - Starting column
 * @param {string} sheetName - Target sheet name
 */
function writeResultsToSheet(resultsArray, row, column, sheetName = "Report") {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`Error: ${sheetName} sheet not found.`);
    return;
  }

  // Clear previous results
  sheet.getRange(row, column, sheet.getMaxRows() - row + 1, 1).clearContent();

  // Write new results
  resultsArray.forEach((result, index) => {
    sheet.getRange(row + index, column).setValue(result);
  });

  Logger.log(`Results written to ${sheetName}`);
}

/**
 * Checks if data fetching is allowed
 * @return {boolean} True if allowed, false otherwise
 */
function canWeFetch() {
  const MARKET_HOURS = [10, 11, 12, 13, 14, 15, 16, 17];
  const date = new Date();
  const day = date.getDay();
  
  // Skip weekends
  if (day === 5 || day === 6) return false;
  
  // Skip if current hour is not in market hours
  if (!MARKET_HOURS.includes(date.getHours())) return false;
  
  // Skip if today is in the holidays list
  const formattedDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const dateSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("setting");
  const holidays = dateSheet.getRange('A2:A').getValues()
    .flat()
    .filter(value => value !== '');
  
  return !holidays.includes(formattedDate);
}

/**
 * Fetches and updates live trading data
 */
function fetchLiveTradingData() {
  if (!canWeFetch()) return;

  const tradingData = fetchTradingData();
  console.log("Updating live trading data");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("live trading") || 
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("live trading");
  
  // Clear and update data
  sheet.getRange(1, 1, sheet.getMaxRows(), 10).clearContent();
  sheet.getRange(1, 1, tradingData.length, Math.min(tradingData[0].length, 10)).setValues(tradingData);
  
  if (tradingData.length > 1) {
    sheet.getRange(2, 3, tradingData.length - 1, 1).setNumberFormat('#,##0.00'); // Col C: LTP
    sheet.getRange(2, 4, tradingData.length - 1, 5).setNumberFormat('#,##0.00'); // Pt Change, % Change, Open, High, Low
    sheet.getRange(2, 9, tradingData.length - 1, 1).setNumberFormat('#,##0');    // Volume
    sheet.getRange(2, 10, tradingData.length - 1, 1).setNumberFormat('#,##0.00'); // Prev Close
  }
  
  checkPointsFromSheet();
  findSymbolsNearPoints();

  // Stage 2: Scan 'SLTP-stocks' for SL/TP hits with freshly updated live data
  if (typeof scanSLTPStocksAgainstLive === 'function') {
    try {
      scanSLTPStocksAgainstLive(true);
    } catch (err) {
      Logger.log("scanSLTPStocksAgainstLive error during live data fetch: " + err.message);
    }
  } else if (typeof scanStocksForSLTP === 'function') {
    try {
      scanStocksForSLTP();
    } catch (err) {
      Logger.log("scanStocksForSLTP error during live data fetch: " + err.message);
    }
  }
}

/**
 * Parses HTML table from sharesansar.com
 * @param {string} html - HTML content
 * @return {Array} Parsed table data
 */
function parseLiveTradingTable(html) {
  const tableRegex = /<table[^>]*id="headFixed"[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch) {
    throw new Error("Live trading table not found");
  }
  
  return tableMatch[1].split(/<tr[^>]*>/i)
    .slice(1)
    .map(row => row.replace(/<\/tr>.*/i, ''))
    .filter(row => row.trim())
    .map(row => {
      return row.split(/<t[dh][^>]*>/i)
        .slice(1)
        .map(cell => cell.replace(/<\/t[dh]>.*/i, '').replace(/<[^>]+>/g, "").trim())
        .filter(cell => cell);
    })
    .filter(row => row.length > 0);
}
