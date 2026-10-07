# MeroShare Automation & NEPSE Trading Suite

A comprehensive, production-grade automation suite and market intelligence platform for the Nepal Stock Exchange (NEPSE) and MeroShare. Built with **Node.js**, **TypeScript**, **Playwright**, and **Google Sheets API**, it orchestrates everything from automated multi-account IPO applications to real-time Stop Loss / Take Profit (SL/TP) monitoring, two-way Telegram control, and TMS 52 order placement.

---

## 🚀 Key Features

1. **Automated Multi-Account IPO Application**:
   - Applies for standard Ordinary Shares across multiple user accounts simultaneously.
   - Precise scheduling per user (`applyAt`) with human-like stealth delays and PIN entry.
   - Built-in visual confirmation pause before submission.

2. **IPO Allotment Status Checker**:
   - Automated parallel checking of ASBA allotment status across all registered users.
   - Multi-tab report generation with results logged directly to Google Sheets and JSON reports.

3. **Stop Loss (SL) & Take Profit (TP) Monitoring Engine (4-Stage Pipeline)**:
   - **Stage 1 (Filter & Deduplication)**: Filters portfolio holdings from sheet `yogen` with SL/TP targets, generating normalized Unique IDs (`SYMBOL-KITTA-PRICE-YYYY-MM-DD`) and syncing to `SLTP-stocks`.
   - **Stage 2 (Live Market Hit Detection)**: Scans live prices every 10 minutes during market hours. Detects Stop Loss breaches and Take Profit crossings, logging new triggers to `SL-TP-Hits` with `Status = FALSE`.
   - **Stage 3 (Queue & Telegram Alerts)**: Polls `SL-TP-Hits` every 30 seconds. Dispatches instant interactive Telegram alerts with **"Proceed"** and **"Dismiss"** inline buttons, marking rows `Status = TRUE` with Kathmandu timestamp.
   - **Stage 4 (2-Way Execution)**: Tapping **Proceed** automatically appends a SELL order into `autoBuySellScript` with dynamic Kathmandu scheduling (+2 min) for TMS execution.

4. **TMS 52 Automated Buy & Sell (`tmsAutomation.ts`)**:
   - Headless or GUI-assisted browser login with CAPTCHA/OTP handling and announcement popup dismissal.
   - Inspects the daily order book before execution to prevent duplicate order placement.
   - Places BUY and SELL orders directly into the TMS 52 trading portal.

5. **Automated Market Scrapers & Scheduled Jobs**:
   - **52-Week High & Low**: Daily automated extraction at 11:45 AM synced to `52WeekHighLow` tab.
   - **Promoter Share Unlock**: Daily tracker at 11:35 AM identifying promoter lock-in expiration.
   - **Fundamental & Technical Scrapers**: Auto scrapers at 11:40 AM extracting valuation and indicators.
   - **Floorsheet & Accumulation Scraper**: Scrapes and analyzes big buyer/seller accumulation patterns.

6. **Interactive 2-Way Telegram Bot**:
   - Control your automation remotely using `/status`, `/proceed`, `/sltp`, `/portfolio`, `/run`, and interactive callback buttons.
   - Persistent notification queue with file-backed storage ensuring zero lost notifications.

7. **Google Apps Script Bridge (`shareInfoScript/sltpHit.js`)**:
   - Sheet-native Google Apps Script providing scheduled hourly portfolio sync and 10-minute live hit scanning directly inside Google Sheets.

---

## 🏗️ Architecture & Data Flow

```mermaid
flowchart TD
    subgraph GoogleSheets ["Google Sheets (Data & Control)"]
        Yogen["'yogen' (Portfolio)"]
        SLTPStocks["'SLTP-stocks'"]
        HitsSheet["'SL-TP-Hits'"]
        AutoTradeSheet["'autoBuySellScript'"]
        Control["'Control' (Commands)"]
    end

    subgraph NodeService ["Node.js Background Service (syncService.ts)"]
        Stage1["Stage 1: syncYogenToSLTPStocks()"]
        Stage2["Stage 2: scanSLTPStocksAgainstLive()"]
        Stage3["Stage 3: pollSLTPHitsQueue()"]
        Bot["Telegram Bot Service"]
        TMS["TMS 52 Automation"]
        Scrapers["Crons: 52-Week, Promoter, Funda"]
    end

    subgraph External ["External Services"]
        NEPSE["Live Market Data / ShareSansar"]
        Telegram["Telegram App (User)"]
        TMSPortal["NEPSE TMS 52 Portal"]
        MeroShare["MeroShare ASBA"]
    end

    Yogen -->|Filters SL/TP| Stage1 --> SLTPStocks
    SLTPStocks --> Stage2
    NEPSE -->|Live Prices| Stage2
    Stage2 -->|Appends Trigger Row| HitsSheet
    HitsSheet -->|Polls Status = FALSE| Stage3
    Stage3 -->|Sends Alert + Proceed button| Telegram
    Stage3 -->|Marks Status = TRUE| HitsSheet
    Telegram -->|User clicks Proceed| Bot
    Bot -->|Appends SELL Order| AutoTradeSheet
    AutoTradeSheet -->|Reads Trades| TMS --> TMSPortal
```

---

## 📋 Google Sheet Tabs Reference

| Tab Name | Purpose | Key Columns / Format |
| :--- | :--- | :--- |
| **`Control`** | Master command center for triggering tasks remotely | Cell `A2` accepts commands (`APPLY_ALL`, `CHECK_STATUS`, `EXTRACT_52_WEEK`, `SCRAPE_PORTFOLIO`) |
| **`Users`** | MeroShare credential database | `DP`, `Username`, `Password`, `CRN`, `PIN`, `Kitta`, `ApplyAt`, `Name`, `isApply` |
| **`Stocks`** | Stock names for ASBA allotment status checks | `Stock Name` |
| **`Results`** | Allotment status audit log | `Timestamp`, `Stock Name`, `User Name`, `Status` |
| **`yogen`** | Primary user portfolio tracking sheet | Symbol, Sector, Kitta, Purchase Price, ST (Stop Loss), TP (Take Profit) |
| **`SLTP-stocks`** | Filtered holdings with active SL or TP | `Unique ID` (Col A), Symbol, Kitta, Price, Purchase Date, ST, TP, Last Synced |
| **`SL-TP-Hits`** | Active alert queue for breached SL/TP targets | `Unique ID`, Symbol, Trigger Event, Live LTP, Day High/Low, `Status`, `Processed At` |
| **`autoBuySellScript`** | Order execution queue for TMS 52 automation | Cell `B1` (Scheduled Execution Time), Cols: `S.N`, `Symbol`, `qty`, `price`, `action`, `Total` |
| **`52WeekHighLow`** | Daily 52-week High/Low stock records | Symbol, LTP, 52W High, 52W Low, % From High, Scraped At |
| **`live trading`** | Cache of real-time market data | Symbol, LTP, High, Low, % Change, Volume |
| **`Report`** | Market status tracker | Cell `B1` reflects market state (`Market Open`, `Market Closed`) |

---

## 🛑 Stop Loss / Take Profit (SL/TP) 4-Stage Lifecycle

### Stage 1: Portfolio Filter & Normalized Deduplication
- Scans `yogen` sheet starting at Row 6.
- Keeps any stock where `Stop Loss (ST) > 0` or `Take Profit (TP) > 0`.
- Generates a normalized **Unique ID**:
  ```
  SYMBOL-KITTA-PURCHASEPRICE-YYYY-MM-DD
  Example: NRIC-20-800-2026-10-01
  ```
- **Date Normalization**: Automatically converts Excel serial numbers (`46296`), slash formats (`10/01/26`), and ISO dates into uniform `YYYY-MM-DD` format, preventing duplicate row generation.

### Stage 2: Live Price Monitoring & Hit Detection
- Compares `SLTP-stocks` against live market prices every 10 minutes during market hours.
- Triggers when:
  - **Stop Loss Hit**: `live.low <= Stop Loss (ST)`
  - **Take Profit Hit**: `live.high >= Take Profit (TP)`
- Appends to `SL-TP-Hits` with `Status = FALSE`.

### Stage 3: Queue Processing & Telegram Interactive Notification
- Polled every 30 seconds by `sltpQueueService.ts`.
- Picks up rows where `Status != true`.
- Sends an instant Telegram card with actionable buttons:
  - `[ Proceed ]`: Prepares a SELL order.
  - `[ ❌ Dismiss ]`: Ignores the alert.
- Immediately marks `Status = TRUE` and writes `Processed At` timestamp in Google Sheets.

### Stage 4: Telegram Two-Way Trade Dispatch
- Clicking **Proceed** queues a SELL order into `autoBuySellScript`.
- Automatically schedules TMS execution for **Kathmandu Time + 2 Minutes** in cell `B1`.

---

## 📜 Google Apps Script Setup (`shareInfoScript/sltpHit.js`)

You can run the Stage 1 & 2 automation directly inside Google Sheets via Apps Script:

1. Open your Google Spreadsheet.
2. In the top menu, go to **Extensions** $\rightarrow$ **Apps Script**.
3. Create a new script file (e.g., `sltpHit.gs`).
4. Copy the entire contents of [shareInfoScript/sltpHit.js](file:///home/yogen/Desktop/workspace/playwrite/meroshare/shareInfoScript/sltpHit.js) and paste it into the editor.
5. Save the project (`Ctrl+S`).
6. Refresh your Google Spreadsheet. A new custom menu **`Trading Automation`** will appear in the toolbar:
   - **Run Stage 1**: Manual sync from `yogen` $\rightarrow$ `SLTP-stocks`.
   - **Run Stage 2**: Manual scan against live trading data.
   - **Setup Triggers**: Configures automatic Hourly Sync and 10-Minute Market Scan triggers.
   - **Remove Triggers**: Disables all background triggers.

---

## 💻 TMS 52 Trading Automation (`tmsAutomation.ts`)

Automates placing BUY and SELL orders in NEPSE TMS (Broker 52):

### 1. Preparation
Ensure your `.env` contains TMS credentials:
```env
TMS_USER="your_tms_client_id"
TMS_PASS="your_tms_password"
```

### 2. Execution
```bash
npm run start-tms
```

### 3. Workflow
1. Opens Chromium in persistent context (`./tms_user_data`) to preserve sessions.
2. Navigates to TMS dashboard. If login screen is shown, autofills credentials and waits up to 3 minutes for manual OTP / CAPTCHA solving.
3. Automatically closes announcement and force-login popups.
4. Opens **Daily Order Book** to check existing open orders; skips trades that have already been placed.
5. Navigates to **Order Entry**, fills Symbol, Quantity, Price, submits the trade, clears inputs, resets toggles, and sends Telegram confirmations.

---

## 🤖 Telegram Bot Commands

When running the bot (`npm run start-bot` or via background service):

| Command | Action |
| :--- | :--- |
| `/status` | View background service health, active jobs, and supervisor status |
| `/sltp` | View portfolio SL/TP tracking summary and latest hit count |
| `/proceed` | Place a SELL order for the latest pending SL/TP hit into `autoBuySellScript` |
| `/proceed <SYM> <QTY> <PRICE>` | Manually append a custom order to `autoBuySellScript` |
| `/portfolio` | Display current stock holdings and valuation |
| `/report` | Get the latest IPO allotment status check report |
| `/run <CMD>` | Remotely execute commands (`CHECK_STATUS`, `EXTRACT_52_WEEK`, etc.) |
| `/help` | List all available bot commands |

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- Node.js (v18.0 or higher recommended)
- Google Cloud Service Account with Google Sheets API enabled

### 2. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 3. Environment Variables (`.env`)
Create a `.env` file in the root directory:
```env
# Google Sheets
GOOGLE_SHEET_ID="your_google_sheet_id_here"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Telegram Notifications & Bot
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"

# TMS Credentials
TMS_USER="your_client_code"
TMS_PASS="your_password"

# Automation & Stealth
HEADLESS="false"
HUMAN_MODE="true"
CONCURRENCY_LIMIT="2"
```

---

## 🚦 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run watch-sheets` | Main background orchestrator daemon (Sheets polling, cron jobs, bot, SL/TP monitor) |
| `npm run test-sltp` | **Run the complete SL/TP test suite** (Date parsing, Stage 1 sync, Stage 2 hit deduplication, Sheet inspection) |
| `npm run start-tms` | Run TMS 52 automated buy/sell order execution |
| `npm run start-bot` | Run standalone interactive Telegram bot |
| `npm run check-status` | Run parallel IPO allotment status checker |
| `npm run check-52-week` | Scrape 52-Week High & Low stocks and update Google Sheet |
| `npm run check-promoter-unlock` | Run Promoter Share Unlock scraper |
| `npm run check-funda` | Run Fundamental valuation scraper |
| `npm run check-tech` | Run Technical indicator scraper |
| `npm run scan-accumulation` | Analyze NEPSE floorsheet accumulation patterns |
| `npm run scrape-portfolio` | Scrape current holdings from MeroShare / Broker |
| `npm run test-notification` | Send test notification through Telegram queue |
| `npm run flush-notifications` | Force-deliver any queued Telegram messages |

---

## 🛡️ Production Supervisor Setup (Linux)

To ensure 24/7 background uptime, the project includes a Supervisor configuration in [meroshare-supervisor.conf](file:///home/yogen/Desktop/workspace/playwrite/meroshare/meroshare-supervisor.conf):

```ini
[program:meroshare-watch-sheets]
command=/home/yogen/.nvm/versions/node/v22.22.0/bin/npm run watch-sheets
directory=/home/yogen/Desktop/workspace/playwrite/meroshare
user=yogen
autostart=true
autorestart=true
startretries=10
redirect_stderr=true
stdout_logfile=/home/yogen/Desktop/workspace/playwrite/meroshare/watch-sheets.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=5
stopasgroup=true
killasgroup=true
```

### Supervisor Management Commands:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status meroshare-watch-sheets
sudo supervisorctl restart meroshare-watch-sheets
sudo supervisorctl tail -f meroshare-watch-sheets
```

---

## 🔒 Security & Privacy

- All sensitive credentials (`.env`, `users.json`, `reportStatus.json`, `tms_user_data/`) are excluded from version control via `.gitignore`.
- Browser automation sessions are contained locally with persistent sessions stored in protected directories.
- Google Service Account keys are accessed strictly via environment variables.
