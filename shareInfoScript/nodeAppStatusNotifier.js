/**
 * =============================================================================
 * nodeAppStatusNotifier.js
 * 
 * - Pings the local Node.js application (via configured URL / tunnel / local endpoint)
 * - Checks whether the application is running or offline
 * - Sends formatted Telegram notifications directly via Telegram Bot API
 * - Automated 10:30 AM daily trigger setup and teardown
 * =============================================================================
 */

// Configuration Defaults (Can also be set in Script Properties: File > Project Properties > Script Properties)
var DEFAULT_CONFIG = {
  // Telegram Bot Token and Chat ID
  TELEGRAM_BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN",
  TELEGRAM_CHAT_ID: "YOUR_TELEGRAM_CHAT_ID",
  
  // URL to hit the local Node.js application (e.g. ngrok tunnel, cloudflare tunnel, or public IP)
  // Example: "https://your-tunnel-subdomain.ngrok-free.app/health"
  NODE_APP_URL: "http://localhost:3055/health",
  
  // Timeout in milliseconds
  REQUEST_TIMEOUT_MS: 10000
};

/**
 * Retrieves configuration from Script Properties with fallback to DEFAULT_CONFIG
 */
function getAppStatusConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    TELEGRAM_BOT_TOKEN: props.getProperty("TELEGRAM_BOT_TOKEN") || DEFAULT_CONFIG.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: props.getProperty("TELEGRAM_CHAT_ID") || DEFAULT_CONFIG.TELEGRAM_CHAT_ID,
    NODE_APP_URL: props.getProperty("NODE_APP_URL") || DEFAULT_CONFIG.NODE_APP_URL,
    REQUEST_TIMEOUT_MS: parseInt(props.getProperty("REQUEST_TIMEOUT_MS") || DEFAULT_CONFIG.REQUEST_TIMEOUT_MS, 10)
  };
}

/**
 * Helper to set script properties easily from Apps Script
 */
function setAppStatusConfig(botToken, chatId, appUrl) {
  var props = PropertiesService.getScriptProperties();
  if (botToken) props.setProperty("TELEGRAM_BOT_TOKEN", botToken);
  if (chatId) props.setProperty("TELEGRAM_CHAT_ID", chatId);
  if (appUrl) props.setProperty("NODE_APP_URL", appUrl);
  Logger.log("✅ Updated Script Properties for App Status Notifier.");
}

/**
 * Main Daily Job: Checks Node.js application status and sends Telegram notification
 * Scheduled daily at 10:30 AM
 */
function checkNodeAppStatusDaily() {
  var config = getAppStatusConfig();
  var timestamp = Utilities.formatDate(new Date(), "Asia/Kathmandu", "yyyy-MM-dd HH:mm:ss");
  Logger.log("[NodeApp Checker] Running status check at " + timestamp);

  var isOnline = false;
  var latency = 0;
  var statusMessage = "";
  var appDetails = "";

  var startTime = new Date().getTime();
  try {
    var response = UrlFetchApp.fetch(config.NODE_APP_URL, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "GoogleAppsScript-MeroShareWatch/1.0"
      }
    });

    latency = new Date().getTime() - startTime;
    var statusCode = response.getResponseCode();

    if (statusCode >= 200 && statusCode < 300) {
      isOnline = true;
      statusMessage = "HTTP " + statusCode + " OK (" + latency + "ms)";
      
      try {
        var json = JSON.parse(response.getContentText());
        if (json.uptime) {
          appDetails = "\n• <b>Uptime:</b> " + Math.round(json.uptime / 60) + " minutes";
        }
        if (json.service) {
          appDetails += "\n• <b>Service:</b> " + json.service;
        }
      } catch (_) {
        // Response was not JSON
      }
    } else {
      isOnline = false;
      statusMessage = "HTTP " + statusCode + " (" + response.getContentText().slice(0, 100) + ")";
    }
  } catch (err) {
    latency = new Date().getTime() - startTime;
    isOnline = false;
    statusMessage = err.message || "Connection refused / timed out";
  }

  // Construct formatted Telegram HTML message
  var telegramText = "";
  if (isOnline) {
    telegramText = 
      "🟢 <b>Local Node.js Service Online</b>\n\n" +
      "• <b>Status:</b> <code>RUNNING</code>\n" +
      "• <b>Endpoint:</b> <code>" + escapeHtml(config.NODE_APP_URL) + "</code>\n" +
      "• <b>Response:</b> " + statusMessage +
      appDetails + "\n" +
      "• <b>Checked At:</b> <i>" + timestamp + "</i>";
  } else {
    telegramText = 
      "🔴 <b>Local Node.js Service OFFLINE / Unreachable</b>\n\n" +
      "• <b>Status:</b> <code>DOWN / ERROR</code>\n" +
      "• <b>Endpoint:</b> <code>" + escapeHtml(config.NODE_APP_URL) + "</code>\n" +
      "• <b>Error:</b> <code>" + escapeHtml(statusMessage) + "</code>\n" +
      "• <b>Checked At:</b> <i>" + timestamp + "</i>\n\n" +
      "⚠️ <i>Please ensure your local supervisor service and tunnel are running.</i>";
  }

  // Send Telegram Notification
  var sendResult = sendTelegramMessage(telegramText, config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID);
  Logger.log("[Telegram] Send result: " + JSON.stringify(sendResult));
}

/**
 * Sends message to Telegram via Bot API
 */
function sendTelegramMessage(text, botToken, chatId) {
  if (!botToken || botToken === "YOUR_TELEGRAM_BOT_TOKEN" || !chatId || chatId === "YOUR_TELEGRAM_CHAT_ID") {
    Logger.log("⚠️ Telegram Bot Token or Chat ID not configured. Skipping send.");
    return { success: false, error: "Missing bot credentials" };
  }

  var telegramUrl = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };

  try {
    var response = UrlFetchApp.fetch(telegramUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true, code: code };
    } else {
      return { success: false, code: code, response: response.getContentText() };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Escapes HTML characters for Telegram parse_mode: 'HTML'
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Configures the daily 10:30 AM trigger in Google Apps Script
 */
function setupDailyStatus1030Trigger() {
  removeDailyStatusTrigger();

  // Create daily trigger at 10:30 AM (hour 10, near minute 30)
  ScriptApp.newTrigger("checkNodeAppStatusDaily")
    .timeBased()
    .atHour(10)
    .nearMinute(30)
    .everyDays(1)
    .create();

  Logger.log("✅ Trigger configured: checkNodeAppStatusDaily will run daily at ~10:30 AM.");

  try {
    SpreadsheetApp.getUi().alert("✅ 10:30 AM Daily Status Trigger Configured!\n\nFunction: checkNodeAppStatusDaily\nSchedule: ~10:30 AM Daily\nAlerts: Sent to Telegram");
  } catch (e) {
    Logger.log("Running in background context (no UI prompt needed).");
  }
}

/**
 * Removes any existing triggers for checkNodeAppStatusDaily
 */
function removeDailyStatusTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "checkNodeAppStatusDaily") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log("Removed " + count + " existing trigger(s) for checkNodeAppStatusDaily.");
}
