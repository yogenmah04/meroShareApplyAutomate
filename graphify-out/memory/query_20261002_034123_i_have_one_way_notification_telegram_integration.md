---
type: "query"
date: "2026-10-02T03:41:23.204092+00:00"
question: " i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendTelegramNotification()", "getControlCommand()", "menu.js", "webapp", "syncService.ts", "nodeAppStatusNotifier.js"]
---

# Q:  i have one way notification telegram integration now i need two way communication where google sheet command controls also hit from telegram msg, make a plan for that implementation

## Answer

Expanded from original query via vocab: [telegram, notification, notifier, sheet, sheets, spreadsheet, appsscript, command, menu, webapp, trigger, send]. Traversed graph and analyzed notificationService.ts, menu.js, googleSheetsService.ts (getControlCommand), nodeAppStatusNotifier.js, and syncService.ts. Designed a comprehensive two-way communication implementation plan using Google Apps Script Web App doPost webhook and Control sheet queue integration.

## Outcome

- Signal: useful

## Source Nodes

- sendTelegramNotification()
- getControlCommand()
- menu.js
- webapp
- syncService.ts
- nodeAppStatusNotifier.js