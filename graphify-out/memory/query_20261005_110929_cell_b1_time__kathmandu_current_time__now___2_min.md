---
type: "query"
date: "2026-10-05T11:09:29.776652+00:00"
question: "Cell B1 time 'Kathmandu current time: now' +2 min"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "getTmsScheduleTime()", "syncService.ts", "googleSheetsService.ts"]
---

# Q: Cell B1 time 'Kathmandu current time: now' +2 min

## Answer

Expanded from original query via vocab: [time, date, current, sheet, sheets, schedule, scheduler, auto, tms, trade, append, sync]. Traversed nodes appendAutoBuySellTrade, getTmsScheduleTime, syncService.ts. Cell B1 in Google Sheet tab 'autoBuySellScript' holds the scheduled execution time for TMS automation. The syncService polls Cell B1 every 30s. Setting Cell B1 to Kathmandu current time: now + 2 minutes (now.getTime() + 120,000ms) guarantees that scheduledDate > new Date() when polled, allowing syncService to successfully schedule 'npm run start-tms' with node-schedule.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- getTmsScheduleTime()
- syncService.ts
- googleSheetsService.ts