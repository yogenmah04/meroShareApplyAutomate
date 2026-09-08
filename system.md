# System Architecture & Technical Documentation

This document provides a comprehensive detail of the **Meroshare & NEPSE Automation System**, including its core objectives, folder structure, Google Sheets integration architecture, coding patterns, third-party libraries, and file-by-file responsibilities.

---

## 🎯 Aim of the Application

The primary objective of this application is to provide a complete, automated end-to-end suite for the Nepalese Stock Market (NEPSE & Meroshare). It automates high-value, repetitive financial tasks including:

1. **Automated IPO Application**: Logs into multiple Meroshare accounts simultaneously, scans for open "Ordinary Shares", populates application details (Bank, Account Number, Applied Kitta, CRN, PIN), and submits applications at precise scheduled times.
2. **IPO Allotment Status Checking**: Automatically checks whether targeted IPOs have been allotted across all configured accounts and records the results in both local JSON reports and real-time Google Sheets tabs.
3. **Automated TMS Trade Placement**: Automatically places BUY/SELL orders on the NEPSE Broker Trade Management System (TMS52) using static or dynamic market price calculations.
4. **Market Data Scraping & Analysis**:
   - **NEPSE Index Tracker**: Periodically scrapes live NEPSE index data.
   - **Fundamental Data Scraper**: Collects fundamental financial indicators from Nepse Alpha and syncs with Google Sheets.
   - **Promoter Share Lock-in Scraper**: Scrapes upcoming promoter share unlock dates from Nepse Alpha.
   - **Large Player Accumulation Scanner**: Scrapes Merolagani and Sharesansar floorsheets to detect institutional accumulation patterns and generate weighted Excel reports.
5. **AI Identity Document Parsing**: Uses Playwright with saved web sessions to interface with Kimi AI for extracting structured JSON (`fullName`, `citizenshipNumber`, `dateOfBirth`) from scanned document images.
6. **Centralized Google Sheets Orchestration**: Allows full remote control of the entire automation system via a Google Sheet control tab without needing manual CLI execution.

---

## 📊 Google Sheets Integration & Modification Engine

The Google Sheets integration serves as the **central management console and real-time database** for the entire automation suite. Built in `googleSheetsService.ts` and managed by `syncService.ts`, it allows remote task triggering, status tracking, credential management, and automated report storage.

### 1. Authentication & Security
- **JWT Service Account**: Uses `google-auth-library` (`JWT`) with Google Spreadsheet API scope (`https://www.googleapis.com/auth/spreadsheets`).
- **Environment Variables**: Authenticates securely via `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SHEET_ID` defined in `.env`.

### 2. Network Resilience & Rate Limiting
- **Exponential Backoff (`callWithRetry`)**: Automatically retries failed API calls up to 3 times with exponential delay to gracefully handle transient network drops (`EAI_AGAIN`), socket hang-ups, or 500 server errors.
- **Rate-Limiting (`p-limit`)**: Limits Google API calls to a maximum concurrency of 2 to avoid hitting Google Sheets API rate limits.

### 3. Detailed Tab-by-Tab Schema & Modification Rules

| Tab Name | Read / Write | Modification Type | Schema / Headers | Purpose & Detailed Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **`Control`** | Read & Write | Cell-level updates | `Command` (A2), `Status` (B2), `Last Run` (C2), `Message` (D2) | **Command Center**: `syncService.ts` polls A2 every 30s. When a command (`CHECK_STATUS`, `START_SCHEDULER`, `PROMOTER_UNLOCK_CHECK`, `EXTRACT_FUNDA_DATA`, `STOP`) is detected, B2 updates to `IN_PROGRESS`, C2 updates with the current timestamp, and D2 shows live status. After completion, A2 resets to `IDLE` and B2 updates to `COMPLETED`. |
| **`Users`** | Read & Write | Row lookup & specific cell mutation | `ID`, `DP`, `Username`, `Password`, `CRN`, `PIN`, `Kitta`, `Name`, `isApply`, `ApplyAt`, `Remarks`, `checkForThis` | **User Credential Store**: `fetchUsersFromSheet()` reads account credentials, schedule times, and check flags. `isApply` (Column I) controls whether an account is scheduled for IPO application by `initializeScheduler()`. `checkForThis` (Column L) controls whether an account is scanned for allotment results during `CHECK_STATUS` (if `TRUE`, the account is checked; otherwise skipped). After an IPO application attempt, `markUserAsIPOApplied()` toggles `isApply` to `FALSE` and updates `Remarks`/`Status` (Column K). |
| **`Stocks`** | Read Only | Bulk row read | `Stock Name` | **Watchlist Store**: Reads target stock names used by `checkStatus.ts` to scan allotment status in Meroshare's Application Report tab. |
| **`Results`** | Write Only | Append-only rows | `Timestamp`, `Stock Name`, `User Name`, `Status` | **Allotment Output Log**: `addResultToSheet()` appends a new result row whenever `checkStatus.ts` completes checking an allotment status for a user. |
| **`PromoterShareUnlock`** | Write Only | Full tab overwrite (`clear` + `addRows`) | Dynamic headers extracted from Nepse Alpha (e.g., `Symbol`, `Lock-in Expiry Date`, `Share Quantity`, etc.) | **Scraper Data Dump**: `promoterUnlock.ts` scrapes Nepse Alpha, then `overrideSheetData()` wipes existing contents, sets headers, and populates fresh promoter lock-in data. |
| **`fundamentalInfo`** | Write Only | Full tab overwrite (`clear` + `addRows`) | Dynamic headers from Nepse Alpha table | **Financial Metrics Dump**: `fundaScraper.ts` extracts company metrics from Nepse Alpha and calls `overrideSheetData()` to replace all tab rows with updated fundamental financial ratios. |
| **`Report`** | Write Only | Targeted cell update | Cell `B1` | **NEPSE Index Tracker**: `nepseScraper.ts` opens `B1` cell (`sheet.loadCells("B1")`) and writes the latest scraped live NEPSE index value twice daily. |
| **`autoBuySellScript`** | Read Only | Range read (`B1`, `B3:E200`) | Cell B1: Scheduled Time.<br>Rows B3:E200: `Symbol` (Col B), `Qty` (Col C), `Price` (Col D), `Action` (Col E) | **TMS Trade Queue**: `getTmsScheduleTime()` reads B1 for trade execution timing. `fetchAutoBuySellData()` parses valid `BUY` and `SELL` rows to feed into `tmsAutomation.ts`. |

---

## 📂 Folder Structure

```
meroshare/
├── .github/                       # GitHub workflows and repository configurations
├── input/                         # Input directory for document parsing (e.g., identity images)
│   └── document.jpg               # Sample identity document image for AI parsing
├── security/                      # Authenticated state storage
│   └── kimiTokens.json            # Saved storageState cookies for Kimi AI session
├── tests/                         # Playwright test suite directory
├── tms_user_data/                 # Persistent browser context data for TMS automation
├── .env                           # Environment variables configuration file
├── .gitignore                     # Git exclusion rules
├── automate.ts                    # Meroshare IPO application script
├── autonomousParser.ts            # Kimi AI identity document parsing script
├── checkStatus.ts                 # Meroshare IPO allotment status checking script
├── checkStockStatus.json          # Input stock names list for allotment checking
├── fundaScraper.ts                # Nepse Alpha fundamental financial data scraper
├── googleSheetsService.ts         # Google Sheets API integration and abstraction layer
├── humanUtils.ts                  # Stealth and human behavior simulation utility toolkit
├── naasaLogin.ts                  # Naasa Securities TMS login automation snippet
├── nepseAccumulation.js           # NEPSE large player accumulation scanner & Excel generator
├── nepseScraper.ts                # Live NEPSE index scraper
├── package.json                   # Dependency declarations and npm script targets
├── package-lock.json              # Dependency lockfile
├── playwright.config.ts           # Playwright test framework configuration
├── promoterUnlock.ts              # Nepse Alpha promoter share lock-in date scraper
├── reportStatus.json              # Output storage for allotment check results
├── saveAuthSession.ts             # Interactive auth session capture script for Kimi AI
├── scheduler.ts                   # Time-driven cron scheduler for IPO applications
├── syncService.ts                 # Master background orchestrator and polling loop
├── testBody.ts                    # Debug script for DOM layout analysis
├── testStealth.ts                 # Stealth plugin verification script
├── tmsAutomation.ts               # Automated TMS buy/sell order execution script
├── users.json                     # Local JSON user credential and schedule store
├── README.md                      # Operational overview and quickstart guide
├── technical_documentation.md    # Multi-layer technical specification
└── system.md                      # System design, code patterns, and file inventory (this document)
```

---

## 🧬 Coding Style & Architectural Patterns

### 1. Layered Architecture Pattern
The project follows a clean 3-layer architecture:
- **Orchestration Layer (`syncService.ts`)**: Background loop polling remote state (Google Sheets) and triggering tasks.
- **Data & Service Layer (`googleSheetsService.ts`)**: Abstraction over Google Sheets API v4 with retry logic and error resilience.
- **Automation & Scraper Layer (`automate.ts`, `checkStatus.ts`, `tmsAutomation.ts`, etc.)**: Pure automation logic interacting with web interfaces via Playwright.

### 2. Human Behavior Simulation Pattern (`humanUtils.ts`)
To bypass bot detection mechanisms (e.g., Cloudflare, Akamai, custom anti-bot scripts):
- **Character-by-Character Typing (`humanType`)**: Emulates natural typing speeds with randomized keypress delays (50ms–150ms).
- **Hover Before Click (`humanClick`)**: Moves mouse pointer over elements and pauses before clicking.
- **Jitter Delays (`jitterSleep`)**: Replaces fixed wait times with randomized delay ranges.
- **User-Agent Rotation (`getRandomUserAgent`)**: Randomizes browser user-agent strings.

### 3. Anti-Bot Stealth Integration
- Extends Playwright's Chromium instance using `playwright-extra` and `puppeteer-extra-plugin-stealth`.
- Disables blink features via `--disable-blink-features=AutomationControlled` chrome flag.

### 4. Resilient Network & Concurrency Pattern
- **Exponential Backoff (`callWithRetry`)**: Handles transient Google API failures (DNS drops, rate limits, 500 errors).
- **Concurrency Limiting (`p-limit`)**: Restricts concurrent browser contexts/API calls to avoid IP throttling or high CPU usage.

### 5. Persistent Context Pattern
- Uses `launchPersistentContext` (e.g. `tms_user_data`) or `storageState` (`security/kimiTokens.json`) to reuse logged-in user sessions across script executions without triggering re-authentication challenges.

---

## 📚 Used Libraries & Exact Versions

The application relies on Node.js and TypeScript. Below are the packages defined in `package.json`:

### Production Dependencies (`dependencies`)

| Library | Version | Intention & Role in Application |
| :--- | :--- | :--- |
| `playwright-extra` | `^4.3.6` | Modular framework wrapper over Playwright adding plugin support. |
| `puppeteer-extra-plugin-stealth` | `^2.11.2` | Plugin applied to Playwright Chromium instances to hide automation signatures. |
| `google-spreadsheet` | `^5.2.0` | High-level wrapper for Google Sheets API v4 to query and update spreadsheet tabs. |
| `google-auth-library` | `^10.6.2` | Handles JWT service account authentication with Google APIs. |
| `node-schedule` | `^2.1.1` | Flexible time-based and cron scheduler for queuing delayed execution tasks. |
| `@types/node-schedule` | `^2.1.8` | TypeScript declaration types for `node-schedule`. |
| `p-limit` | `^3.1.0` | Concurrency controller limiting simultaneous promise execution. |
| `dotenv` | `^17.4.1` | Loads configuration environment variables from `.env` file into `process.env`. |
| `xlsx` | `^0.18.5` | Spreadsheet reader/writer used for generating formatted Excel reports (`accumulation_report.xlsx`). |

### Development Dependencies (`devDependencies`)

| Library | Version | Intention & Role in Application |
| :--- | :--- | :--- |
| `@playwright/test` | `^1.59.1` | Core browser automation driver for Chromium/WebKit/Firefox. |
| `typescript` | `^6.0.2` | Type-safe JavaScript compiler providing static analysis and code intelligence. |
| `ts-node` | `^10.9.2` | Execution engine enabling direct runtime execution of TypeScript files without manual compilation steps. |
| `@types/node` | `^25.5.2` | TypeScript definitions for Node.js standard runtime APIs. |

---

## 📄 File-by-File Intentions & Responsibilities

### ⚙️ Core System & Orchestration

#### `syncService.ts`
- **Intention**: Master daemon and background polling service.
- **Responsibilities**:
  - Polls Google Sheets (`Control` tab) every 30 seconds for remote commands (`CHECK_STATUS`, `START_SCHEDULER`, `PROMOTER_UNLOCK_CHECK`, `EXTRACT_FUNDA_DATA`, `STOP`).
  - Triggers sub-routines dynamically and reports progress/status back to Google Sheets.
  - Manages internal schedule jobs for periodic tasks (NEPSE index scraper, Promoter unlock scraper, Fundamental scraper, TMS time trigger).

#### `googleSheetsService.ts`
- **Intention**: Data Access Object (DAO) for Google Sheets API interaction.
- **Responsibilities**:
  - Authenticates via Google JWT Service Account credentials from `.env`.
  - Wraps operations in `callWithRetry` for network failure resilience.
  - Provides helper methods to fetch user accounts, stocks, commands, and append/override sheet tabs (`Users`, `Stocks`, `Results`, `Control`, `PromoterShareUnlock`, `fundamentalInfo`, `autoBuySellScript`).

#### `automate.ts`
- **Intention**: Core automation logic for applying to Meroshare IPOs.
- **Responsibilities**:
  - Launches Playwright browser with stealth settings.
  - Logs into Meroshare using DP, username, and password.
  - Navigates to "My ASBA", finds open "Ordinary Shares" issues with an active "Apply" button.
  - Selects bank account, populates applied Kitta quantity, enters CRN, checks disclaimers, pauses for verification, inputs 4-digit PIN, and submits the application.

#### `checkStatus.ts`
- **Intention**: Allotment verification engine for Meroshare IPOs.
- **Responsibilities**:
  - Logins to Meroshare for each configured user (using concurrency limits via `p-limit`).
  - Navigates to "My ASBA" -> "Application Report".
  - Scans for target company names listed in `checkStockStatus.json` or Google Sheets `Stocks` tab.
  - Opens the application report dialog, extracts the allotment result text (e.g. "Allotted", "Not Allotted"), and saves results locally to `reportStatus.json` and to Google Sheets.

#### `scheduler.ts`
- **Intention**: Time-based IPO application trigger manager.
- **Responsibilities**:
  - Reads user list from `users.json` or Google Sheets.
  - Parses each user's `applyAt` ISO date timestamp.
  - Registers `node-schedule` jobs to trigger `runAutomation(user)` at the precise target time.
  - Updates application status ("IPO applied" or "IPO applied failed") back to Google Sheets.

#### `tmsAutomation.ts`
- **Intention**: Automated order execution on NEPSE Broker Trade Management System (TMS52).
- **Responsibilities**:
  - Loads trade orders from Google Sheets (`autoBuySellScript` tab).
  - Uses persistent browser context (`tms_user_data`) to maintain session cookies across runs.
  - Navigates to Daily Order Book to check if orders already exist to prevent duplicate execution.
  - Fills order entry form (BUY/SELL toggle, symbol, quantity, static price or calculated high/low dynamic market price) and submits trades.

---

### 📊 Market Scrapers & Analyzers

#### `fundaScraper.ts`
- **Intention**: Financial metric extractor for NEPSE listed companies.
- **Responsibilities**:
  - Navigates to Nepse Alpha fundamental signals page (`https://www.nepsealpha.com/trading-signals/funda`).
  - Modifies table view settings, extracts table headers and paginated rows.
  - Pushes extracted company fundamental data into the `fundamentalInfo` tab of Google Sheets.

#### `promoterUnlock.ts`
- **Intention**: Promoter share lock-in period scraper.
- **Responsibilities**:
  - Navigates to Nepse Alpha promoter lock-in overview page (`https://nepsealpha.com/promoter-lock-in`).
  - Interacts with filter controls ("Next 3 Months").
  - Extracts tabular data containing unlock dates, company symbols, and share quantities, updating the `PromoterShareUnlock` Google Sheet tab.

#### `nepseScraper.ts`
- **Intention**: Live NEPSE index monitor.
- **Responsibilities**:
  - Navigates to `https://www.nepalstock.com/`.
  - Extracts current index value via DOM XPath.
  - Updates cell `B1` in the `Report` tab of Google Sheets on scheduled daily intervals (11:01 AM and 4:05 PM).

#### `nepseAccumulation.js`
- **Intention**: Advanced algorithmic stock scanner for large-player accumulation detection.
- **Responsibilities**:
  - Scrapes Merolagani for stock fundamentals (52W high/low, LTP, 20-day volume history, PE, EPS).
  - Scrapes Sharesansar floor-sheets for trade-by-trade transaction breakdown.
  - Evaluates institutional broker concentration and volume spikes against weighting criteria.
  - Generates comprehensive Excel spreadsheets (`accumulation_report.xlsx`) categorized by score and signal strength.

---

### 🤖 Stealth & AI Utilities

#### `humanUtils.ts`
- **Intention**: Reusable stealth toolkit for human emulation.
- **Responsibilities**:
  - Exports `jitterSleep`, `humanType`, `humanClick`, and `getRandomUserAgent` helpers used across all Playwright automation scripts.

#### `autonomousParser.ts`
- **Intention**: Vision/LLM document identity extraction agent.
- **Responsibilities**:
  - Loads saved authentication cookies (`security/kimiTokens.json`).
  - Navigates to Kimi AI chat web interface (`https://www.kimi.com/`).
  - Uploads document image (`input/document.jpg`).
  - Submits structured JSON extraction prompt and extracts generated JSON output containing identity metadata.

#### `saveAuthSession.ts`
- **Intention**: Authentication session generator for web-based AI services.
- **Responsibilities**:
  - Opens visible browser session pointing to Kimi AI.
  - Waits for manual user login.
  - Captures browser `storageState` cookies and saves them to `security/kimiTokens.json` for subsequent autonomous parsing.

#### `naasaLogin.ts`
- **Intention**: Utility script testing browser interaction for Naasa Securities login portal.
- **Responsibilities**:
  - Automates initial login sequence for Naasa Securities TMS.

#### `testStealth.ts`
- **Intention**: Anti-bot detection verifier.
- **Responsibilities**:
  - Navigates to `https://bot.sannysoft.com/` using Playwright Extra + Stealth plugin and saves a screenshot (`stealth_test.png`) to verify stealth bypass effectiveness.

#### `testBody.ts`
- **Intention**: Developer DOM analysis tool.
- **Responsibilities**:
  - Inspects table layout and DOM element hierarchy on target scraper web pages.

---

### 📋 Configuration & Documentation Files

- **`package.json`**: Defines Node.js project metadata, npm script aliases, dependencies, and devDependencies.
- **`playwright.config.ts`**: Configuration file for Playwright test framework.
- **`users.json`**: Local user database containing DP names, usernames, encrypted passwords, CRNs, transaction PINs, and scheduled IPO application timestamps (`applyAt`).
- **`checkStockStatus.json`**: Array of stock company names to check allotment status for.
- **`reportStatus.json`**: Auto-generated output JSON file storing allotment check results grouped by stock name.
- **`.env`**: Stores sensitive credentials (Google Service Account Email, Private Key, Google Sheet ID, TMS credentials, Concurrency limit).
- **`README.md`**: User setup manual, prerequisites, JSON schema guides, and running instructions.
- **`technical_documentation.md`**: Technical specification document detailing system architecture and functions.
- **`system.md`**: Comprehensive ground-truth document for system architecture, coding patterns, libraries, and file catalog (this document).
