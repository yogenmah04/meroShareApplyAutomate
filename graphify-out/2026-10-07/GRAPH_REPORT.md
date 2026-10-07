# Graph Report - meroshare  (2026-10-05)

## Corpus Check
- 77 files · ~46,886 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 534 nodes · 876 edges · 59 communities (52 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bca61408`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- humanUtils.ts
- ⚙️ Core System & Orchestration
- scripts
- googleSheetsService.ts
- Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data
- sltpHit.js
- storeDailyClose.js
- dependencies
- 6. Step-by-Step Implementation Steps
- nepseAccumulation.js
- Meroshare Automated IPO Scheduler
- compilerOptions
- liveTradingData.js
- 📁 File & Function Breakdown
- riskMgmt.js
- tmsAutomation.ts
- nepseStatusAppsScript.js
- Q: when tmsAuomation.ts is failed to complete the process, push the failed notificaiton in telegram to user use the queue mechanisum
- appsscript.json
- nodeAppStatusNotifier.js
- nepseScraper.ts
- Code.js
- nepseChargesCalulator.js
- Q: fix this error using supervisor for npm run watch-sheets
- Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'
- Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet
- Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script
- Q: what can we get usefull data from technical data and 52highlow stored in google sheet
- Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation
- Q: read TELEGRAM_TWO_WAY_CONTROL_PLAN.md and implement phase 1
- Q: how to run or test the two way communication implemetation
- buypoint.js
- createSignalSheet
- SupportBounce_Vol_Rsi.js
- SwingTradingStrategy.js
- supervisor.ts
- autonomousParser.ts
- fetchStockHistory
- newStrategy.js
- Q: when reply come from telegram user as 'proceed_sell' it append in 'autoBuySellScript' payload data correct as SN-> correct Symbol-> correct qty-> correct price -> incorrect ( correct is = >put price as blank) cell B1 -> incorrect (correct is current timestamp + 1min)

## God Nodes (most connected - your core abstractions)
1. `main()` - 30 edges
2. `initSheets()` - 27 edges
3. `handleTelegramCommand()` - 27 edges
4. `callWithRetry()` - 20 edges
5. `jitterSleep()` - 18 edges
6. `scripts` - 18 edges
7. `getRandomUserAgent()` - 17 edges
8. `launchBrowserWithViewMode()` - 16 edges
9. `sendTelegramNotification()` - 16 edges
10. `humanClick()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `runAutomation()` --calls--> `sendTelegramNotification()`  [EXTRACTED]
  automate.ts → notificationService.ts
- `initializeScheduler()` --calls--> `runAutomation()`  [EXTRACTED]
  scheduler.ts → automate.ts
- `main()` --calls--> `formatShortError()`  [EXTRACTED]
  syncService.ts → checkStatus.ts
- `runTaskAsync()` --calls--> `formatShortError()`  [EXTRACTED]
  telegramBotService.ts → checkStatus.ts
- `runCheckStatus()` --calls--> `sendTelegramNotification()`  [EXTRACTED]
  checkStatus.ts → notificationService.ts

## Import Cycles
- 3-file cycle: `sltpMonitorService.ts -> sltpQueueService.ts -> telegramBotService.ts -> sltpMonitorService.ts`

## Communities (59 total, 7 thin omitted)

### Community 0 - "humanUtils.ts"
Cohesion: 0.18
Nodes (25): runAutomation(), formatShortError(), login(), runCheckStatus(), StatusEntry, StockReport, User, fetchFundamentalData() (+17 more)

### Community 1 - "⚙️ Core System & Orchestration"
Cohesion: 0.05
Nodes (37): 1. Authentication & Security, 1. Layered Architecture Pattern, 2. Human Behavior Simulation Pattern (`humanUtils.ts`), 2. Network Resilience & Rate Limiting, 3. Anti-Bot Stealth Integration, 3. Detailed Tab-by-Tab Schema & Modification Rules, 4. Resilient Network & Concurrency Pattern, 5. Persistent Context Pattern (+29 more)

### Community 2 - "scripts"
Cohesion: 0.06
Nodes (34): author, description, devDependencies, @playwright/test, ts-node, @types/node, typescript, keywords (+26 more)

### Community 3 - "googleSheetsService.ts"
Cohesion: 0.09
Nodes (56): addResultToSheet(), appendAutoBuySellTrade(), callWithRetry(), doc, fetchStocksFromSheet(), fetchUsersFromSheet(), formattedKey, getControlCommand() (+48 more)

### Community 4 - "Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data"
Cohesion: 0.10
Nodes (20): 1. Executive Summary & Data Schema, 2.1 Trend & Moving Averages, 2.2 Relative Strength Index (RSI-14) & Momentum Divergence, 2.3 Volatility & Band Systems (Bollinger Bands), 2. Technical & Momentum Indicators, 3.1 Relative Volume (RVOL) & Volume Surges, 3.2 Volume Divergence & Distribution Detection, 3.4 MACD (Moving Average Convergence Divergence) (+12 more)

### Community 5 - "sltpHit.js"
Cohesion: 0.20
Nodes (20): formatPurchaseDate(), generateUniqueStockId(), getExistingSLTPStocksMap(), getExistingUniqueIdsInHitsSheet(), getLiveTradingDataMap(), getOrCreateSLTPHitsSheet(), getOrCreateSLTPStocksSheet(), parsePriceNum() (+12 more)

### Community 6 - "storeDailyClose.js"
Cohesion: 0.20
Nodes (17): buildLiveMap(), calcRSI(), computeAndWriteRsiDip(), detectDip(), getAllowedSymbols(), getRsiDipData(), isMarketOpen(), _log() (+9 more)

### Community 7 - "dependencies"
Cohesion: 0.11
Nodes (19): dotenv, google-auth-library, google-spreadsheet, node-schedule, p-limit, dependencies, dotenv, google-auth-library (+11 more)

### Community 8 - "6. Step-by-Step Implementation Steps"
Cohesion: 0.11
Nodes (18): 1. Overview & Objective, 2. Architecture & Communication Flow, 3. Command & Button Mapping Matrix, 4. Detailed Component Implementation, 5. Security & Reliability Safeguards, 6. Step-by-Step Implementation Steps, Component A: Google Apps Script Webhook (`shareInfoScript/telegramWebhook.js`), Component B: Web App Manifest Update (`shareInfoScript/appsscript.json`) (+10 more)

### Community 9 - "nepseAccumulation.js"
Cohesion: 0.16
Nodes (12): calcAvgVol(), { chromium }, CONFIG, extractPriceHistory(), fetchFloorsheet(), fetchStockData(), fs, INSTITUTIONAL_BROKERS (+4 more)

### Community 10 - "Meroshare Automated IPO Scheduler"
Cohesion: 0.12
Nodes (15): 1. Configuration, 1. Manual Execution (CLI), 2. How to Run, 2. Remote Trigger via Google Sheets, 3. Scheduled Daily Run, 3. Viewing Results, 52-Week High & Low Stock Scraper, Configuration (+7 more)

### Community 11 - "compilerOptions"
Cohesion: 0.12
Nodes (15): ES2020, google-apps-script, **/*.gs, **/*.js, node_modules, compilerOptions, allowJs, checkJs (+7 more)

### Community 12 - "liveTradingData.js"
Cohesion: 0.30
Nodes (13): arrayDiff(), canWeFetch(), checkPointsFromSheet(), divideWithoutDecimal(), fetchLiveTradingData(), fetchTradingData(), findMatchingSymbols(), getListedSymbolsPoints() (+5 more)

### Community 13 - "📁 File & Function Breakdown"
Cohesion: 0.15
Nodes (12): 1. `syncService.ts` (The Orchestrator), 2. `googleSheetsService.ts` (The Data Bridge), 3. `checkStatus.ts` (The Status Checker), 4. `automate.ts` (The IPO Applicant), 5. `scheduler.ts` (The Time-Based Trigger), 6. `humanUtils.ts` (The Stealth Toolkit), 7. `testStealth.ts` (The Debugger), 🏗️ Architecture Overview (+4 more)

### Community 14 - "riskMgmt.js"
Cohesion: 0.36
Nodes (9): calculateBeta(), calculateReturns(), calculateVaR(), covariance(), flattenToNumbers(), getHistoricalPrices(), mean(), stdev() (+1 more)

### Community 15 - "tmsAutomation.ts"
Cohesion: 0.51
Nodes (9): fetchAutoBuySellData(), launchPersistentContextWithViewMode(), clearInput(), delay(), executeSingleTrade(), fetchExistingTrades(), humanClick(), humanType() (+1 more)

### Community 16 - "nepseStatusAppsScript.js"
Cohesion: 0.36
Nodes (7): fetchNepseMarketStatus(), getHeuristicMarketStatus(), removeNepseTriggers(), saveNepseStatusToReport(), scrapeNepseStatusDaily(), setupNepse1101Trigger(), setupNepseAllTriggers()

### Community 17 - "Q: when tmsAuomation.ts is failed to complete the process, push the failed notificaiton in telegram to user use the queue mechanisum"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: when tmsAuomation.ts is failed to complete the process, push the failed notificaiton in telegram to user use the queue mechanisum, Source Nodes

### Community 18 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 19 - "nodeAppStatusNotifier.js"
Cohesion: 0.39
Nodes (6): checkNodeAppStatusDaily(), escapeHtml(), getAppStatusConfig(), removeDailyStatusTrigger(), sendTelegramMessage(), setupDailyStatus1030Trigger()

### Community 20 - "nepseScraper.ts"
Cohesion: 0.38
Nodes (6): doc, formattedKey, scheduleNepseScraper(), scrapeNepseAndSave(), scrapeWithRetry(), serviceAccountAuth

### Community 22 - "nepseChargesCalulator.js"
Cohesion: 0.73
Nodes (5): _calculateNepseFees(), _calculateTotalCost(), NEPSE_BUY_TOTAL(), NEPSE_NET_PROFIT(), NEPSE_SELL_NET()

### Community 23 - "Q: fix this error using supervisor for npm run watch-sheets"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: fix this error using supervisor for npm run watch-sheets, Source Nodes

### Community 24 - "Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript', Source Nodes

### Community 25 - "Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: implement this code in google sheet script nepseStatusAppsScript.js and triggered at 11:01 am every day and update in report B1 sheet, Source Nodes

### Community 26 - "Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script, Source Nodes

### Community 27 - "Q: what can we get usefull data from technical data and 52highlow stored in google sheet"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what can we get usefull data from technical data and 52highlow stored in google sheet, Source Nodes

### Community 28 - "Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation, Source Nodes

### Community 29 - "Q: read TELEGRAM_TWO_WAY_CONTROL_PLAN.md and implement phase 1"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: read TELEGRAM_TWO_WAY_CONTROL_PLAN.md and implement phase 1, Source Nodes

### Community 30 - "Q: how to run or test the two way communication implemetation"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: how to run or test the two way communication implemetation, Source Nodes

### Community 31 - "buypoint.js"
Cohesion: 1.00
Nodes (3): analyzeBuyTpSl(), average(), stdev()

### Community 33 - "SupportBounce_Vol_Rsi.js"
Cohesion: 0.83
Nodes (3): average(), calculateRSI(), swingBuyToday()

### Community 58 - "Q: when reply come from telegram user as 'proceed_sell' it append in 'autoBuySellScript' payload data correct as SN-> correct Symbol-> correct qty-> correct price -> incorrect ( correct is = >put price as blank) cell B1 -> incorrect (correct is current timestamp + 1min)"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: when reply come from telegram user as 'proceed_sell' it append in 'autoBuySellScript' payload data correct as SN-> correct Symbol-> correct qty-> correct price -> incorrect ( correct is = >put price as blank) cell B1 -> incorrect (correct is current timestamp + 1min), Source Nodes

## Knowledge Gaps
- **186 isolated node(s):** `User`, `StatusEntry`, `StockReport`, `formattedKey`, `serviceAccountAuth` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `nepseStatusAppsScript.js` (2× useful, score=1.86860378)
- `nepseScraper.ts` (2× useful, score=1.868466454)
- `scheduleNepseScraper()` (2× useful, score=1.868466454)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initSheets()` connect `googleSheetsService.ts` to `humanUtils.ts`, `tmsAutomation.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `User`, `StatusEntry`, `StockReport` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `⚙️ Core System & Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `googleSheetsService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._