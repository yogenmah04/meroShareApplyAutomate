# Graph Report - meroshare  (2026-10-02)

## Corpus Check
- 69 files · ~36,293 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 457 nodes · 671 edges · 55 communities (48 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aab2c7dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ⚙️ Core System & Orchestration
- googleSheetsService.ts
- Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data
- dependencies
- scripts
- System Architecture & Technical Documentation
- nepseAccumulation.js
- 📁 File & Function Breakdown
- storeDailyClose.js
- Meroshare Automated IPO Scheduler
- tmsAutomation.ts
- nepseScraper.ts
- autonomousParser.ts
- compilerOptions
- liveTradingData.js
- riskMgmt.js
- nepseStatusAppsScript.js
- appsscript.json
- nodeAppStatusNotifier.js
- Code.js
- nepseChargesCalulator.js
- Q: fix this error using supervisor for npm run watch-sheets
- Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'
- Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet
- Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script
- buypoint.js
- createSignalSheet
- sltpHit.js
- SupportBounce_Vol_Rsi.js
- SwingTradingStrategy.js
- supervisor.ts
- fetchStockHistory
- newStrategy.js
- 6. Step-by-Step Implementation Steps
- Q: what can we get usefull data from technical data and 52highlow stored in google sheet
- Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation

## God Nodes (most connected - your core abstractions)
1. `main()` - 25 edges
2. `jitterSleep()` - 18 edges
3. `getRandomUserAgent()` - 17 edges
4. `scripts` - 17 edges
5. `launchBrowserWithViewMode()` - 16 edges
6. `callWithRetry()` - 15 edges
7. `initSheets()` - 15 edges
8. `humanClick()` - 13 edges
9. `sendTelegramNotification()` - 11 edges
10. `runAutomation()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `runAutomation()` --calls--> `initSheets()`  [EXTRACTED]
  tmsAutomation.ts → googleSheetsService.ts
- `run()` --calls--> `getRandomUserAgent()`  [EXTRACTED]
  testBody.ts → humanUtils.ts
- `runAutomation()` --calls--> `formatShortError()`  [EXTRACTED]
  automate.ts → checkStatus.ts
- `runAutomation()` --calls--> `getRandomUserAgent()`  [EXTRACTED]
  automate.ts → humanUtils.ts
- `runAutomation()` --calls--> `humanClick()`  [EXTRACTED]
  automate.ts → humanUtils.ts

## Import Cycles
- None detected.

## Communities (55 total, 7 thin omitted)

### Community 0 - "⚙️ Core System & Orchestration"
Cohesion: 0.10
Nodes (21): `automate.ts`, `autonomousParser.ts`, `checkStatus.ts`, 📋 Configuration & Documentation Files, ⚙️ Core System & Orchestration, 📄 File-by-File Intentions & Responsibilities, `fundaScraper.ts`, `googleSheetsService.ts` (+13 more)

### Community 1 - "googleSheetsService.ts"
Cohesion: 0.11
Nodes (50): runAutomation(), formatShortError(), login(), runCheckStatus(), StatusEntry, StockReport, User, fetchFundamentalData() (+42 more)

### Community 2 - "Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data"
Cohesion: 0.10
Nodes (20): 1. Executive Summary & Data Schema, 2.1 Trend & Moving Averages, 2.2 Relative Strength Index (RSI-14) & Momentum Divergence, 2.3 Volatility & Band Systems (Bollinger Bands), 2. Technical & Momentum Indicators, 3.1 Relative Volume (RVOL) & Volume Surges, 3.2 Volume Divergence & Distribution Detection, 3.4 MACD (Moving Average Convergence Divergence) (+12 more)

### Community 3 - "dependencies"
Cohesion: 0.11
Nodes (19): dotenv, google-auth-library, google-spreadsheet, node-schedule, p-limit, dependencies, dotenv, google-auth-library (+11 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (33): author, description, devDependencies, @playwright/test, ts-node, @types/node, typescript, keywords (+25 more)

### Community 5 - "System Architecture & Technical Documentation"
Cohesion: 0.12
Nodes (16): 1. Authentication & Security, 1. Layered Architecture Pattern, 2. Human Behavior Simulation Pattern (`humanUtils.ts`), 2. Network Resilience & Rate Limiting, 3. Anti-Bot Stealth Integration, 3. Detailed Tab-by-Tab Schema & Modification Rules, 4. Resilient Network & Concurrency Pattern, 5. Persistent Context Pattern (+8 more)

### Community 6 - "nepseAccumulation.js"
Cohesion: 0.16
Nodes (12): calcAvgVol(), { chromium }, CONFIG, extractPriceHistory(), fetchFloorsheet(), fetchStockData(), fs, INSTITUTIONAL_BROKERS (+4 more)

### Community 7 - "📁 File & Function Breakdown"
Cohesion: 0.15
Nodes (12): 1. `syncService.ts` (The Orchestrator), 2. `googleSheetsService.ts` (The Data Bridge), 3. `checkStatus.ts` (The Status Checker), 4. `automate.ts` (The IPO Applicant), 5. `scheduler.ts` (The Time-Based Trigger), 6. `humanUtils.ts` (The Stealth Toolkit), 7. `testStealth.ts` (The Debugger), 🏗️ Architecture Overview (+4 more)

### Community 8 - "storeDailyClose.js"
Cohesion: 0.20
Nodes (17): buildLiveMap(), calcRSI(), computeAndWriteRsiDip(), detectDip(), getAllowedSymbols(), getRsiDipData(), isMarketOpen(), _log() (+9 more)

### Community 9 - "Meroshare Automated IPO Scheduler"
Cohesion: 0.12
Nodes (15): 1. Configuration, 1. Manual Execution (CLI), 2. How to Run, 2. Remote Trigger via Google Sheets, 3. Scheduled Daily Run, 3. Viewing Results, 52-Week High & Low Stock Scraper, Configuration (+7 more)

### Community 10 - "tmsAutomation.ts"
Cohesion: 0.51
Nodes (9): fetchAutoBuySellData(), launchPersistentContextWithViewMode(), clearInput(), delay(), executeSingleTrade(), fetchExistingTrades(), humanClick(), humanType() (+1 more)

### Community 11 - "nepseScraper.ts"
Cohesion: 0.40
Nodes (5): doc, formattedKey, scrapeNepseAndSave(), scrapeWithRetry(), serviceAccountAuth

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (15): ES2020, google-apps-script, **/*.gs, **/*.js, node_modules, compilerOptions, allowJs, checkJs (+7 more)

### Community 21 - "liveTradingData.js"
Cohesion: 0.30
Nodes (13): arrayDiff(), canWeFetch(), checkPointsFromSheet(), divideWithoutDecimal(), fetchLiveTradingData(), fetchTradingData(), findMatchingSymbols(), getListedSymbolsPoints() (+5 more)

### Community 22 - "riskMgmt.js"
Cohesion: 0.36
Nodes (9): calculateBeta(), calculateReturns(), calculateVaR(), covariance(), flattenToNumbers(), getHistoricalPrices(), mean(), stdev() (+1 more)

### Community 23 - "nepseStatusAppsScript.js"
Cohesion: 0.36
Nodes (7): fetchNepseMarketStatus(), getHeuristicMarketStatus(), removeNepseTriggers(), saveNepseStatusToReport(), scrapeNepseStatusDaily(), setupNepse1101Trigger(), setupNepseAllTriggers()

### Community 24 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 25 - "nodeAppStatusNotifier.js"
Cohesion: 0.39
Nodes (6): checkNodeAppStatusDaily(), escapeHtml(), getAppStatusConfig(), removeDailyStatusTrigger(), sendTelegramMessage(), setupDailyStatus1030Trigger()

### Community 27 - "nepseChargesCalulator.js"
Cohesion: 0.73
Nodes (5): _calculateNepseFees(), _calculateTotalCost(), NEPSE_BUY_TOTAL(), NEPSE_NET_PROFIT(), NEPSE_SELL_NET()

### Community 28 - "Q: fix this error using supervisor for npm run watch-sheets"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: fix this error using supervisor for npm run watch-sheets, Source Nodes

### Community 29 - "Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript', Source Nodes

### Community 30 - "Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet, Source Nodes

### Community 31 - "Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script, Source Nodes

### Community 32 - "buypoint.js"
Cohesion: 1.00
Nodes (3): analyzeBuyTpSl(), average(), stdev()

### Community 34 - "sltpHit.js"
Cohesion: 0.83
Nodes (3): findLiveStockData(), getLiveStockData(), scanStocksForSLTP()

### Community 35 - "SupportBounce_Vol_Rsi.js"
Cohesion: 0.83
Nodes (3): average(), calculateRSI(), swingBuyToday()

### Community 52 - "6. Step-by-Step Implementation Steps"
Cohesion: 0.11
Nodes (18): 1. Overview & Objective, 2. Architecture & Communication Flow, 3. Command & Button Mapping Matrix, 4. Detailed Component Implementation, 5. Security & Reliability Safeguards, 6. Step-by-Step Implementation Steps, Component A: Google Apps Script Webhook (`shareInfoScript/telegramWebhook.js`), Component B: Web App Manifest Update (`shareInfoScript/appsscript.json`) (+10 more)

### Community 53 - "Q: what can we get usefull data from technical data and 52highlow stored in google sheet"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what can we get usefull data from technical data and 52highlow stored in google sheet, Source Nodes

### Community 54 - "Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation, Source Nodes

## Knowledge Gaps
- **168 isolated node(s):** `User`, `StatusEntry`, `StockReport`, `formattedKey`, `serviceAccountAuth` (+163 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `nepseStatusAppsScript.js` (2× useful, score=1.86860378)
- `nepseScraper.ts` (2× useful, score=1.868466454)
- `scheduleNepseScraper()` (2× useful, score=1.868466454)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `📄 File-by-File Intentions & Responsibilities` connect `⚙️ Core System & Orchestration` to `System Architecture & Technical Documentation`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `User`, `StatusEntry`, `StockReport` to the rest of the system?**
  _168 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `⚙️ Core System & Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `googleSheetsService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1130952380952381 - nodes in this community are weakly interconnected._
- **Should `Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._