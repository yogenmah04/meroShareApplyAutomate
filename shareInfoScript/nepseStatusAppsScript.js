/**
 * =============================================================================
 * nepseStatusAppsScript.js
 * 
 * Native Google Apps Script implementation replacing the local headless 
 * Playwright nepseScraper.ts.
 * 
 * - Scrapes live market status ("Market Open" / "Market Closed") via UrlFetchApp
 * - Updates the "Report" sheet at cell B1
 * - Includes daily automated 11:01 AM trigger setup and teardown
 * =============================================================================
 */

const NEPSE_REPORT_TAB = "Report";
const NEPSE_REPORT_CELL = "B1";

/**
 * Main execution function: scrapes NEPSE status and saves it into Report!B1
 */
function scrapeNepseStatusDaily() {
  Logger.log("[NEPSE Scraper] Starting fetch at " + new Date().toISOString());
  
  var statusValue = fetchNepseMarketStatus();
  Logger.log("[NEPSE Scraper] Extracted Value: " + statusValue);
  
  saveNepseStatusToReport(statusValue);
}

/**
 * Fetches NEPSE market status with multi-source fallback
 * @return {string} "Market Open", "Market Closed", or fallback status
 */
function fetchNepseMarketStatus() {
  // Strategy 1: Sharesansar Live Trading page
  try {
    var url1 = "https://www.sharesansar.com/live-trading";
    var res1 = UrlFetchApp.fetch(url1, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (res1.getResponseCode() === 200) {
      var html1 = res1.getContentText();
      
      // Match Market Open or Market Closed button text
      var btnMatch = html1.match(/<button[^>]*class=["'][^"']*btn-(?:danger|success)[^"']*["'][^>]*>\s*(Market\s+(?:Open|Closed))\s*<\/button>/i)
                  || html1.match(/(Market\s+(?:Open|Closed))/i);
                  
      if (btnMatch && btnMatch[1]) {
        return btnMatch[1].trim();
      }
    }
  } catch (e1) {
    Logger.log("[Strategy 1 Failed] " + e1.message);
  }

  // Strategy 2: Sharesansar Today Share Price page
  try {
    var url2 = "https://www.sharesansar.com/today-share-price";
    var res2 = UrlFetchApp.fetch(url2, {
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (res2.getResponseCode() === 200) {
      var html2 = res2.getContentText();
      var match2 = html2.match(/(Market\s+(?:Open|Closed))/i);
      if (match2 && match2[1]) {
        return match2[1].trim();
      }
    }
  } catch (e2) {
    Logger.log("[Strategy 2 Failed] " + e2.message);
  }

  // Strategy 3: Time-based heuristic fallback if portal temporarily unreachable
  // NEPSE market hours are Sun - Thu between 11:00 AM and 3:00 PM Nepal Time (UTC+5:45)
  return getHeuristicMarketStatus();
}

/**
 * Calculates whether NEPSE is open based on Nepal Time (UTC+5:45)
 */
function getHeuristicMarketStatus() {
  var now = new Date();
  var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  var nepalTime = new Date(utc + (3600000 * 5.75)); // UTC + 5:45
  
  var day = nepalTime.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  var hours = nepalTime.getHours();
  var minutes = nepalTime.getMinutes();
  var timeInMinutes = hours * 60 + minutes;

  // Sunday (0) through Thursday (4), 11:00 AM (660 mins) to 3:00 PM (900 mins)
  var isTradingDay = (day >= 0 && day <= 4);
  var isTradingHours = (timeInMinutes >= 660 && timeInMinutes <= 900);

  if (isTradingDay && isTradingHours) {
    return "Market Open";
  }
  return "Market Closed";
}

/**
 * Writes the extracted value into Report!B1
 */
function saveNepseStatusToReport(value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NEPSE_REPORT_TAB);
  
  if (!sheet) {
    sheet = ss.insertSheet(NEPSE_REPORT_TAB);
    sheet.getRange("A1").setValue("Status");
    Logger.log("[NEPSE Scraper] Created missing sheet tab: " + NEPSE_REPORT_TAB);
  }

  var cell = sheet.getRange(NEPSE_REPORT_CELL);
  var prevValue = cell.getValue();
  cell.setValue(value);
  
  Logger.log("[NEPSE Scraper] Updated " + NEPSE_REPORT_TAB + "!" + NEPSE_REPORT_CELL + 
             " from '" + prevValue + "' to '" + value + "'");
             
  // Update timestamp in C1
  try {
    sheet.getRange("C1").setValue("Last Scraped: " + Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd HH:mm:ss"));
  } catch (_) {}
}

/**
 * Sets up both Morning (11:01 AM) and Afternoon (4:05 PM / 16:05) daily triggers
 * Perfectly mirrors scheduleNepseScraper() from nepseScraper.ts!
 */
function setupNepseAllTriggers() {
  removeNepseTriggers();

  // 1. Morning Trigger: ~11:01 AM (Market Open check)
  ScriptApp.newTrigger("scrapeNepseStatusDaily")
    .timeBased()
    .atHour(11)
    .nearMinute(1)
    .everyDays(1)
    .create();

  // 2. Afternoon Trigger: ~4:05 PM / 16:05 (Market Close check)
  ScriptApp.newTrigger("scrapeNepseStatusDaily")
    .timeBased()
    .atHour(16)
    .nearMinute(5)
    .everyDays(1)
    .create();

  Logger.log("✅ Dual triggers configured: scrapeNepseStatusDaily at ~11:01 AM and ~4:05 PM (16:05) daily.");

  try {
    SpreadsheetApp.getUi().alert("✅ NEPSE Dual Triggers Configured!\n\n1. Morning: ~11:01 AM (Market Open)\n2. Afternoon: ~4:05 PM (Market Close)\nTarget: Report!B1");
  } catch (e) {
    Logger.log("Running in background context (no UI prompt needed).");
  }
}

/**
 * Sets up morning daily trigger only (11:01 AM)
 */
function setupNepse1101Trigger() {
  removeNepseTriggers();

  ScriptApp.newTrigger("scrapeNepseStatusDaily")
    .timeBased()
    .atHour(11)
    .nearMinute(1)
    .everyDays(1)
    .create();

  Logger.log("✅ Trigger configured: scrapeNepseStatusDaily will run daily at ~11:01 AM.");
  
  try {
    SpreadsheetApp.getUi().alert("✅ 11:01 AM Daily Trigger Configured!\n\nFunction: scrapeNepseStatusDaily\nTarget: Report!B1\nSchedule: ~11:01 AM Daily");
  } catch (e) {
    Logger.log("Running in background context (no UI prompt needed).");
  }
}

/**
 * Sets up afternoon daily trigger only (4:05 PM / 16:05)
 */
function setupNepse1605Trigger() {
  ScriptApp.newTrigger("scrapeNepseStatusDaily")
    .timeBased()
    .atHour(16)
    .nearMinute(5)
    .everyDays(1)
    .create();

  Logger.log("✅ Trigger configured: scrapeNepseStatusDaily will run daily at ~4:05 PM (16:05).");
  
  try {
    SpreadsheetApp.getUi().alert("✅ 4:05 PM Daily Trigger Configured!\n\nFunction: scrapeNepseStatusDaily\nTarget: Report!B1\nSchedule: ~4:05 PM (16:05) Daily");
  } catch (e) {
    Logger.log("Running in background context (no UI prompt needed).");
  }
}

/**
 * Removes any existing triggers for scrapeNepseStatusDaily
 */
function removeNepseTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "scrapeNepseStatusDaily") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("Removed " + removed + " existing trigger(s) for scrapeNepseStatusDaily.");
}
