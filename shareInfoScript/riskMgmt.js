/**
 * NEPSE Risk Management Toolkit (Refactored)
 * Usage: Extensions > Apps Script > Paste this code
 * Sheet Assumptions:
 *   - 'Data' sheet: Historical price data (symbol in col A, date in col B, close in col C)
 *   - 'Alerts' sheet: Columns A = symbol, B = current price, C = stop loss, D = take profit
 */

/**
 * Calculates Value at Risk (VaR) for a series of returns.
 * @param {Array} returnsRange - 2D array of historical returns.
 * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%).
 * @return {number} VaR value.
 */
function calculateVaR(returnsRange, confidenceLevel) {
  const returns = flattenToNumbers(returnsRange);
  if (returns.length < 2) throw new Error("Not enough data for VaR calculation.");

  const avg = mean(returns);
  const stdDev = stdev(returns);

  // Z-score for common confidence levels (negative for left tail)
  const zScores = {0.90: -1.282, 0.95: -1.645, 0.99: -2.326};
  const zScore = zScores[confidenceLevel] || -1.645; // Default to 95%
  return avg + zScore * stdDev;
}

/**
 * Calculates Beta coefficient of a stock relative to NEPSE index.
 * @param {string} stockSymbol - NEPSE stock symbol (e.g., "ADBL").
 * @param {number} lookbackDays - Number of days to look back (default 90).
 * @return {number} Beta value.
 */
function calculateBeta(stockSymbol, lookbackDays = 90) {
  const marketSymbol = "NEPSE:NM";
  const marketPrices = getHistoricalPrices(marketSymbol, lookbackDays);
  const stockPrices = getHistoricalPrices(stockSymbol, lookbackDays);

  if (stockPrices.length !== marketPrices.length) throw new Error("Mismatched data lengths.");

  const stockReturns = calculateReturns(stockPrices);
  const marketReturns = calculateReturns(marketPrices);

  return covariance(stockReturns, marketReturns) / variance(marketReturns);
}

/**
 * Fetches the last N closing prices for a symbol from the 'Data' sheet.
 * @param {string} symbol - Stock symbol.
 * @param {number} days - Number of days to fetch.
 * @return {Array<number>} Closing prices.
 */
function getHistoricalPrices(symbol, days) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Data');
  const data = sheet.getDataRange().getValues();
  // Filter for symbol, sort by date descending, get closing price (col C)
  return data
    .filter(row => String(row[0]).trim() === symbol)
    .sort((a, b) => new Date(b[1]) - new Date(a[1]))
    .slice(0, days)
    .map(row => Number(row[2]))
    .reverse(); // Oldest to newest
}

/**
 * Calculates daily returns from a price array.
 * @param {Array<number>} prices - Array of closing prices.
 * @return {Array<number>} Returns as decimals.
 */
function calculateReturns(prices) {
  return prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
}

/**
 * Checks price alerts in the 'Alerts' sheet and updates status.
 */
function checkPriceAlerts() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Alerts');
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

  data.forEach((row, i) => {
    const [symbol, currentPrice, stopLoss, takeProfit] = row;
    if (!symbol || isNaN(currentPrice)) return;

    let status = "Hold";
    if (currentPrice <= stopLoss) status = "SELL: Stop Loss Triggered";
    else if (currentPrice >= takeProfit) status = "CONSIDER: Take Profit";

    sheet.getRange(i + 2, 5).setValue(status);
  });
}

// --- Utility Functions ---

function flattenToNumbers(arr) {
  return arr.flat().map(Number).filter(n => !isNaN(n));
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1));
}

function covariance(a, b) {
  const meanA = mean(a), meanB = mean(b);
  return a.reduce((sum, x, i) => sum + (x - meanA) * (b[i] - meanB), 0) / (a.length - 1);
}

function variance(arr) {
  const m = mean(arr);
  return arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1);
}
