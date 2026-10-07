# Graph Report - meroshare  (2026-10-07)

## Corpus Check
- 85 files · ~50,856 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 592 nodes · 942 edges · 67 communities (60 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c39702ee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- initSheets
- ⚙️ Core System & Orchestration
- scripts
- googleSheetsService.ts
- Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data
- sltpHit.js
- storeDailyClose.js
- dependencies
- 6. Step-by-Step Implementation Steps
- nepseAccumulation.js
- MeroShare Automation & NEPSE Trading Suite
- compilerOptions
- liveTradingData.js
- 📁 Component Breakdown
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
- notificationService.ts
- Q: Cell B1 time 'Kathmandu current time: now' +2 min
- Q: Cell B1 time 'Kathmandu current time: now' +3 min
- Q: Cell B1 time 'Kathmandu current time: now' +5 min
- Q: there is alwasys issue in Cell B1 time why ?, i need 'Kathmandu current time: now' + add extra 2 min
- Q: in autoBuySellScript sheet tab there is price column i say it need to blank and in B1 there should be current datetime stamp plus 2 min why it is not reflecting as i have already restart the supervisor
- Q: To clear a formula set cell value null error when appending auto buy sell trade
- Q: TMS Automation popup notification error page.waitForSelector dashboard-wrapper closed

## God Nodes (most connected - your core abstractions)
1. `main()` - 30 edges
2. `initSheets()` - 29 edges
3. `handleTelegramCommand()` - 27 edges
4. `callWithRetry()` - 20 edges
5. `scripts` - 19 edges
6. `jitterSleep()` - 18 edges
7. `getRandomUserAgent()` - 17 edges
8. `launchBrowserWithViewMode()` - 16 edges
9. `sendTelegramNotification()` - 16 edges
10. `humanClick()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `fetchFundamentalData()` --calls--> `initSheets()`  [EXTRACTED]
  fundaScraper.ts → googleSheetsService.ts
- `syncLiveTradingSheet()` --calls--> `callWithRetry()`  [EXTRACTED]
  sltpMonitorService.ts → googleSheetsService.ts
- `pollSLTPHitsQueue()` --calls--> `callWithRetry()`  [EXTRACTED]
  sltpQueueService.ts → googleSheetsService.ts
- `scrapePortfolio()` --calls--> `initSheets()`  [EXTRACTED]
  portfolioScraper.ts → googleSheetsService.ts
- `main()` --calls--> `initSheets()`  [EXTRACTED]
  syncService.ts → googleSheetsService.ts

## Import Cycles
- 3-file cycle: `sltpMonitorService.ts -> sltpQueueService.ts -> telegramBotService.ts -> sltpMonitorService.ts`

## Communities (67 total, 7 thin omitted)

### Community 0 - "initSheets"
Cohesion: 0.16
Nodes (24): doc, initSheets(), fetchShareSansarLiveHtml(), formatPurchaseDate(), generateUniqueStockId(), getLiveMarketData(), isNepseMarketOpen(), LiveStockData (+16 more)

### Community 1 - "⚙️ Core System & Orchestration"
Cohesion: 0.05
Nodes (37): 1. Authentication & Security, 1. Layered Architecture Pattern, 2. Human Behavior Simulation Pattern (`humanUtils.ts`), 2. Network Resilience & Rate Limiting, 3. Anti-Bot Stealth Integration, 3. Detailed Tab-by-Tab Schema & Modification Rules, 4. Resilient Network & Concurrency Pattern, 5. Persistent Context Pattern (+29 more)

### Community 2 - "scripts"
Cohesion: 0.06
Nodes (35): author, description, devDependencies, @playwright/test, ts-node, @types/node, typescript, keywords (+27 more)

### Community 3 - "googleSheetsService.ts"
Cohesion: 0.12
Nodes (51): runAutomation(), formatShortError(), login(), runCheckStatus(), StatusEntry, StockReport, User, fetchFundamentalData() (+43 more)

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

### Community 10 - "MeroShare Automation & NEPSE Trading Suite"
Cohesion: 0.08
Nodes (23): 1. Preparation, 1. Prerequisites, 2. Execution, 2. Install Dependencies, 3. Environment Variables (`.env`), 3. Workflow, 🏗️ Architecture & Data Flow, 🚦 Available NPM Scripts (+15 more)

### Community 11 - "compilerOptions"
Cohesion: 0.12
Nodes (15): ES2020, google-apps-script, **/*.gs, **/*.js, node_modules, compilerOptions, allowJs, checkJs (+7 more)

### Community 12 - "liveTradingData.js"
Cohesion: 0.30
Nodes (13): arrayDiff(), canWeFetch(), checkPointsFromSheet(), divideWithoutDecimal(), fetchLiveTradingData(), fetchTradingData(), findMatchingSymbols(), getListedSymbolsPoints() (+5 more)

### Community 13 - "📁 Component Breakdown"
Cohesion: 0.08
Nodes (23): 1. `syncService.ts` (Master Orchestrator Daemon), 1. `yogen` (Source Portfolio), 2. `googleSheetsService.ts` (Google Sheets Data Bridge), 2. `SLTP-stocks` (Filtered Active Holdings), 3. `SL-TP-Hits` (Alert & Execution Queue), 3. `sltpMonitorService.ts` (Stop Loss / Take Profit Engine), 4. `autoBuySellScript` (TMS Execution Queue), 4. `sltpQueueService.ts` (Queue & Notification Dispatcher) (+15 more)

### Community 14 - "riskMgmt.js"
Cohesion: 0.36
Nodes (9): calculateBeta(), calculateReturns(), calculateVaR(), covariance(), flattenToNumbers(), getHistoricalPrices(), mean(), stdev() (+1 more)

### Community 15 - "tmsAutomation.ts"
Cohesion: 0.49
Nodes (10): fetchAutoBuySellData(), launchPersistentContextWithViewMode(), clearInput(), delay(), dismissTmsPopups(), executeSingleTrade(), fetchExistingTrades(), humanClick() (+2 more)

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

### Community 59 - "notificationService.ts"
Cohesion: 0.39
Nodes (7): enqueueNotification(), flushNotificationQueue(), getPendingCount(), QUEUE_DIR, QueuedMessage, sendDirectTelegram(), startQueueWorker()

### Community 60 - "Q: Cell B1 time 'Kathmandu current time: now' +2 min"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Cell B1 time 'Kathmandu current time: now' +2 min, Source Nodes

### Community 61 - "Q: Cell B1 time 'Kathmandu current time: now' +3 min"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Cell B1 time 'Kathmandu current time: now' +3 min, Source Nodes

### Community 62 - "Q: Cell B1 time 'Kathmandu current time: now' +5 min"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Cell B1 time 'Kathmandu current time: now' +5 min, Source Nodes

### Community 63 - "Q: there is alwasys issue in Cell B1 time why ?, i need 'Kathmandu current time: now' + add extra 2 min"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: there is alwasys issue in Cell B1 time why ?, i need 'Kathmandu current time: now' + add extra 2 min, Source Nodes

### Community 64 - "Q: in autoBuySellScript sheet tab there is price column i say it need to blank and in B1 there should be current datetime stamp plus 2 min why it is not reflecting as i have already restart the supervisor"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: in autoBuySellScript sheet tab there is price column i say it need to blank and in B1 there should be current datetime stamp plus 2 min why it is not reflecting as i have already restart the supervisor, Source Nodes

### Community 65 - "Q: To clear a formula set cell value null error when appending auto buy sell trade"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: To clear a formula set cell value null error when appending auto buy sell trade, Source Nodes

### Community 66 - "Q: TMS Automation popup notification error page.waitForSelector dashboard-wrapper closed"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: TMS Automation popup notification error page.waitForSelector dashboard-wrapper closed, Source Nodes

## Knowledge Gaps
- **223 isolated node(s):** `User`, `StatusEntry`, `StockReport`, `formattedKey`, `serviceAccountAuth` (+218 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `nepseStatusAppsScript.js` (2× useful, score=1.86860378)
- `nepseScraper.ts` (2× useful, score=1.868466454)
- `scheduleNepseScraper()` (2× useful, score=1.868466454)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initSheets()` connect `initSheets` to `googleSheetsService.ts`, `tmsAutomation.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `User`, `StatusEntry`, `StockReport` to the rest of the system?**
  _223 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `⚙️ Core System & Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `googleSheetsService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11841491841491841 - nodes in this community are weakly interconnected._
- **Should `Potential Outcomes & Capabilities Derived from `🗃️ DailyClose` Data` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._