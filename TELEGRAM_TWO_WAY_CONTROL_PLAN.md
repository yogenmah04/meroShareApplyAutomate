# Implementation Plan: Two-Way Telegram Control for Google Sheets & Node Daemon

## 1. Overview & Objective

Transform the current one-way Telegram notification setup into a full **two-way interactive control center**. Users can send Telegram commands or tap Telegram inline buttons to:
1. Trigger native **Google Apps Script** functions directly in Google Sheets (e.g. `scanStocksForSLTP`, `runAll`, `scrapeNepseStatusDaily`, `generateSignalsNew`).
2. Queue heavy Playwright scraper tasks in the Google Sheets **`Control`** tab (`CHECK_STATUS`, `EXTRACT_PORTFOLIO`, `EXTRACT_FUNDA_DATA`, `EXTRACT_TECH_SIGNALS`, `EXTRACT_52_WEEK`, `START_SCHEDULER`, `STOP`) which are picked up and executed by the local Node.js daemon ([syncService.ts](file:///home/yogen/Desktop/workspace/playwrite/meroshare/syncService.ts)).
3. Receive immediate execution acknowledgments and asynchronous completion reports with rich formatting directly on Telegram.

---

## 2. Architecture & Communication Flow

```
                              ┌────────────────────────────────────────┐
                              │             Telegram User              │
                              └───────────────────▲────────────────────┘
                                                  │
                          1. Sends /command       │ 5. Instant Ack &
                          or clicks Inline Button │    Progress Updates
                                                  │
                                                  ▼
                              ┌────────────────────────────────────────┐
                              │    Google Apps Script Web App Webhook  │
                              │           (doPost in GAS)              │
                              │   - Authenticates TELEGRAM_CHAT_ID     │
                              │   - Parses Command / Callback Action   │
                              └───────┬────────────────────────▲───────┘
                                      │                        │
                 ┌────────────────────┴───────────┐            │
                 │ Case 1: Native Sheet Action    │ Case 2: Node.js Daemon Action
                 ▼                                ▼            │
        ┌─────────────────────────────┐  ┌────────────────────────────────────────┐
        │  Executes Apps Script Tasks │  │ Updates 'Control' Sheet Tab (A2=CMD)   │
        │  - scanStocksForSLTP()      │  │ (e.g. CHECK_STATUS, EXTRACT_PORTFOLIO) │
        │  - runAll()                 │  └───────────────────┬────────────────────┘
        │  - scrapeNepseStatusDaily() │                      │
        │  - generateSignalsNew()     │                      │ Polled every 30s
        └─────────────────────────────┘                      ▼
                                         ┌────────────────────────────────────────┐
                                         │     Local Node.js Background Daemon    │
                                         │       (syncService.ts / supervisor)    │
                                         │  - Executes Playwright automation      │
                                         │  - Posts finished status to Telegram   │
                                         │    via notificationService.ts          │
                                         └────────────────────────────────────────┘
```

### Why This Hybrid Model?
- **Serverless & Always-On (Zero Hosting Cost):** Google Apps Script Web App runs 24/7 on Google's infrastructure with a public HTTPS endpoint. No public IP, VPS, or continuous ngrok tunnel required to receive Telegram webhook calls.
- **Heavy Task Offloading:** Heavy browser automation (Playwright/Chromium) cannot run inside Google Apps Script cloud. The existing `Control` sheet tab mechanism in [googleSheetsService.ts](file:///home/yogen/Desktop/workspace/playwrite/meroshare/googleSheetsService.ts#L127) bridges the cloud webhook with the local Node.js scraper seamlessly.

---

## 3. Command & Button Mapping Matrix

| Telegram Command / Button | Action Type | Target Handler / File | Description |
| :--- | :--- | :--- | :--- |
| `/menu`, `/start`, `cmd_menu` | UI | `sendTelegramMenu(chatId)` | Displays interactive Telegram inline keyboard buttons |
| `/nepse`, `cmd_nepse` | Apps Script | [scrapeNepseStatusDaily()](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/nepseStatusAppsScript.js#L20) | Scrapes NEPSE status and updates `Report!B1` |
| `/scansltp`, `cmd_scansltp` | Apps Script | `scanStocksForSLTP()` | Scans stocks for SL/TP hits in sheet |
| `/runall`, `cmd_runall` | Apps Script | `runAll()` | Runs full suite of sheet calculation scans |
| `/signals`, `cmd_signals` | Apps Script | `generateSignalsNew()` | Generates new trading signals tab |
| `/checkstatus`, `cmd_checkstatus` | Sheet Queue | `Control!A2 = CHECK_STATUS` | Triggers IPO status check for marked users via Node daemon |
| `/portfolio`, `cmd_portfolio` | Sheet Queue | `Control!A2 = EXTRACT_PORTFOLIO` | Triggers MeroShare portfolio scraper via Node daemon |
| `/funda`, `cmd_funda` | Sheet Queue | `Control!A2 = EXTRACT_FUNDA_DATA` | Triggers fundamental data scraper via Node daemon |
| `/52week`, `cmd_52week` | Sheet Queue | `Control!A2 = EXTRACT_52_WEEK` | Triggers 52-week High/Low scraper via Node daemon |
| `/promoter`, `cmd_promoter` | Sheet Queue | `Control!A2 = PROMOTER_UNLOCK_CHECK`| Triggers promoter lock-in scraper via Node daemon |
| `/status`, `cmd_status` | Status | Reads `Control!A2:D2` & `Report!B1` | Returns live health, current command, and last run time |
| `/stop`, `cmd_stop` | Sheet Queue | `Control!A2 = STOP` | Gracefully halts local Node daemon processes |

---

## 4. Detailed Component Implementation

### Component A: Google Apps Script Webhook (`shareInfoScript/telegramWebhook.js`)

Create a new file [shareInfoScript/telegramWebhook.js](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/telegramWebhook.js) containing:

1. **`doPost(e)`**:
   - Parses incoming JSON payload from Telegram (`e.postData.contents`).
   - Extracts `message` (chat messages) or `callback_query` (inline button presses).
   - Validates that `chat.id` matches authorized `TELEGRAM_CHAT_ID` (stored in Script Properties).
   - Routes command text / callback data to `handleTelegramCommand()`.
   - Returns HTTP 200 JSON `{ "status": "ok" }`.

2. **`handleTelegramCommand(command, chatId, messageId)`**:
   - Matches commands and callback queries.
   - For native Apps Script functions: executes immediately, formats result, sends Telegram response.
   - For Node daemon functions: sets `Control` tab values (A2=Command, B2="PENDING", C2=timestamp, D2="Queued via Telegram") and notifies user.

3. **`sendTelegramMenu(chatId)`**:
   - Sends Telegram message with `reply_markup` containing an `inline_keyboard` corresponding to the `📊 NEPSE Command Center` menu in [menu.js](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/menu.js).

4. **`setupTelegramWebhook()` & `removeTelegramWebhook()`**:
   - Helper function using `UrlFetchApp` to register the Google Apps Script Web App URL with Telegram Bot API (`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBAPP_URL>`).
   - Added as an option to the sheet's `📊 NEPSE Command Center` menu in [menu.js](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/menu.js) for 1-click setup.

### Component B: Web App Manifest Update (`shareInfoScript/appsscript.json`)

Update [shareInfoScript/appsscript.json](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/appsscript.json) so the Web App endpoint is publicly accessible to Telegram's webhook dispatcher:
```json
{
  "timeZone": "Asia/Kathmandu",
  "dependencies": {},
  "webapp": {
    "access": "ANYONE",
    "executeAs": "USER_DEPLOYING"
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### Component C: Menu Integration (`shareInfoScript/menu.js`)

Add Telegram Webhook management items to [shareInfoScript/menu.js](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/menu.js):
```javascript
.addSeparator()
.addItem('🤖 Register Telegram Webhook', 'setupTelegramWebhook')
.addItem('❌ Remove Telegram Webhook', 'removeTelegramWebhook')
.addItem('📱 Send Command Center Menu to Telegram', 'sendTelegramMenuToAdmin')
```

### Component D: Node Daemon Sync Verification (`syncService.ts`)

[syncService.ts](file:///home/yogen/Desktop/workspace/playwrite/meroshare/syncService.ts#L95-L262) already checks the `Control` tab every 30 seconds for commands:
- When Apps Script sets `Control!A2` to `CHECK_STATUS`, `syncService.ts` detects it.
- `syncService.ts` marks status as `IN_PROGRESS`.
- Upon completion, `syncService.ts` calls [sendTelegramNotification()](file:///home/yogen/Desktop/workspace/playwrite/meroshare/notificationService.ts#L222) to send full results to Telegram and resets `Control!A2` to `"IDLE"`.

---

## 5. Security & Reliability Safeguards

1. **Telegram Authorization Gate:**
   - Every request received by `doPost(e)` must check `String(chatId) === String(config.TELEGRAM_CHAT_ID)`.
   - Any message from unauthorized users or random groups is immediately rejected and logged.

2. **Secret Webhook Token:**
   - When registering webhook (`setWebhook`), pass `secret_token: "<RANDOM_SECRET>"`.
   - Verify `e.headers["X-Telegram-Bot-Api-Secret-Token"] === "<RANDOM_SECRET>"`.

3. **Concurrency & Execution Limits:**
   - Google Apps Script has a 6-minute maximum execution limit. Long Playwright runs are strictly routed through the `Control` sheet to the local Node daemon, preserving Apps Script responsiveness.
   - Immediate feedback is always returned to Telegram within 2 seconds so Telegram does not retry the webhook.

4. **Network Resilience:**
   - Outgoing messages from Node daemon leverage [notificationService.ts](file:///home/yogen/Desktop/workspace/playwrite/meroshare/notificationService.ts) with persistent disk queuing and IPv4 routing to prevent dropped notifications during temporary ISP interruptions.

---

## 6. Step-by-Step Implementation Steps

### Step 1: Create `shareInfoScript/telegramWebhook.js`
- Implement `doPost(e)`, `handleTelegramCommand()`, `sendTelegramMenu()`, `setSheetControlCommand()`, and `setupTelegramWebhook()`.

### Step 2: Update `shareInfoScript/appsscript.json`
- Set `"access": "ANYONE"` and `"executeAs": "USER_DEPLOYING"`.

### Step 3: Update `shareInfoScript/menu.js`
- Add UI menu items for webhook setup and test menu dispatch.

### Step 4: Push to Google Apps Script via clasp
- Run `clasp push` or deploy the files to the Google Apps Script project.
- Deploy as **Web App** (New Deployment -> Web app -> Execute as: Me -> Who has access: Anyone).
- Copy the Web App URL.

### Step 5: Bind Telegram Webhook
- Run `setupTelegramWebhook(webAppUrl)` or run from the Sheet UI menu `'🤖 Register Telegram Webhook'`.
- Verify Telegram responds with `{"ok": true, "result": true, "description": "Webhook was set"}`.

### Step 6: End-to-End Verification
- Send `/start` or `/menu` in Telegram chat: Verify inline buttons appear.
- Click `🏷️ NEPSE Status`: Verify `Report!B1` updates and Telegram receives confirmation.
- Click `👤 Check IPOs`: Verify `Control` tab updates to `CHECK_STATUS` and Node daemon begins processing.
