# Graph Report - meroshare  (2026-08-26)

## Corpus Check
- 25 files · ~44,268 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 192 nodes · 280 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c12e015`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ⚙️ Core System & Orchestration
- googleSheetsService.ts
- checkStatus.ts
- dependencies
- package.json
- System Architecture & Technical Documentation
- nepseAccumulation.js
- 📁 File & Function Breakdown
- scripts
- Meroshare Automated IPO Scheduler
- tmsAutomation.ts
- nepseScraper.ts
- autonomousParser.ts

## God Nodes (most connected - your core abstractions)
1. `main()` - 16 edges
2. `callWithRetry()` - 12 edges
3. `jitterSleep()` - 11 edges
4. `humanClick()` - 11 edges
5. `getRandomUserAgent()` - 11 edges
6. `scripts` - 11 edges
7. `initSheets()` - 9 edges
8. `📁 File & Function Breakdown` - 8 edges
9. `runAutomation()` - 7 edges
10. `runCheckStatus()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `initializeScheduler()` --calls--> `runAutomation()`  [EXTRACTED]
  scheduler.ts → automate.ts
- `main()` --calls--> `runCheckStatus()`  [EXTRACTED]
  syncService.ts → checkStatus.ts
- `fetchFundamentalData()` --calls--> `getRandomUserAgent()`  [EXTRACTED]
  fundaScraper.ts → humanUtils.ts
- `fetchFundamentalData()` --calls--> `humanClick()`  [EXTRACTED]
  fundaScraper.ts → humanUtils.ts
- `fetchFundamentalData()` --calls--> `jitterSleep()`  [EXTRACTED]
  fundaScraper.ts → humanUtils.ts

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "⚙️ Core System & Orchestration"
Cohesion: 0.10
Nodes (21): `automate.ts`, `autonomousParser.ts`, `checkStatus.ts`, 📋 Configuration & Documentation Files, ⚙️ Core System & Orchestration, 📄 File-by-File Intentions & Responsibilities, `fundaScraper.ts`, `googleSheetsService.ts` (+13 more)

### Community 1 - "googleSheetsService.ts"
Cohesion: 0.28
Nodes (17): fetchFundamentalData(), addResultToSheet(), callWithRetry(), doc, fetchStocksFromSheet(), fetchUsersFromSheet(), formattedKey, getControlCommand() (+9 more)

### Community 2 - "checkStatus.ts"
Cohesion: 0.27
Nodes (12): runAutomation(), login(), runCheckStatus(), StatusEntry, StockReport, User, getRandomUserAgent(), humanClick() (+4 more)

### Community 3 - "dependencies"
Cohesion: 0.11
Nodes (19): dotenv, google-auth-library, google-spreadsheet, node-schedule, p-limit, dependencies, dotenv, google-auth-library (+11 more)

### Community 4 - "package.json"
Cohesion: 0.12
Nodes (16): author, description, devDependencies, @playwright/test, ts-node, @types/node, typescript, keywords (+8 more)

### Community 5 - "System Architecture & Technical Documentation"
Cohesion: 0.12
Nodes (16): 1. Authentication & Security, 1. Layered Architecture Pattern, 2. Human Behavior Simulation Pattern (`humanUtils.ts`), 2. Network Resilience & Rate Limiting, 3. Anti-Bot Stealth Integration, 3. Detailed Tab-by-Tab Schema & Modification Rules, 4. Resilient Network & Concurrency Pattern, 5. Persistent Context Pattern (+8 more)

### Community 6 - "nepseAccumulation.js"
Cohesion: 0.16
Nodes (12): calcAvgVol(), { chromium }, CONFIG, extractPriceHistory(), fetchFloorsheet(), fetchStockData(), fs, INSTITUTIONAL_BROKERS (+4 more)

### Community 7 - "📁 File & Function Breakdown"
Cohesion: 0.15
Nodes (12): 1. `syncService.ts` (The Orchestrator), 2. `googleSheetsService.ts` (The Data Bridge), 3. `checkStatus.ts` (The Status Checker), 4. `automate.ts` (The IPO Applicant), 5. `scheduler.ts` (The Time-Based Trigger), 6. `humanUtils.ts` (The Stealth Toolkit), 7. `testStealth.ts` (The Debugger), 🏗️ Architecture Overview (+4 more)

### Community 8 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, auth:kimi, check-funda, check-promoter-unlock, check-status, parse:id, scan-accumulation, start-naasa (+3 more)

### Community 9 - "Meroshare Automated IPO Scheduler"
Cohesion: 0.18
Nodes (10): 1. Configuration, 2. How to Run, 3. Viewing Results, Configuration, Explanation of JSON Fields:, How to Run the Scheduled Flow, Meroshare Automated IPO Scheduler, Prerequisites (+2 more)

### Community 10 - "tmsAutomation.ts"
Cohesion: 0.58
Nodes (8): fetchAutoBuySellData(), clearInput(), delay(), executeSingleTrade(), fetchExistingTrades(), humanClick(), humanType(), runAutomation()

### Community 11 - "nepseScraper.ts"
Cohesion: 0.40
Nodes (5): doc, formattedKey, scheduleNepseScraper(), scrapeNepseAndSave(), serviceAccountAuth

## Knowledge Gaps
- **91 isolated node(s):** `User`, `StatusEntry`, `StockReport`, `formattedKey`, `serviceAccountAuth` (+86 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `📄 File-by-File Intentions & Responsibilities` connect `⚙️ Core System & Orchestration` to `System Architecture & Technical Documentation`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `System Architecture & Technical Documentation` connect `System Architecture & Technical Documentation` to `⚙️ Core System & Orchestration`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `User`, `StatusEntry`, `StockReport` to the rest of the system?**
  _91 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `⚙️ Core System & Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._