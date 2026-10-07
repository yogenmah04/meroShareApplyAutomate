---
type: "query"
date: "2026-10-05T11:15:26.233243+00:00"
question: "Cell B1 time 'Kathmandu current time: now' +5 min"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "getTmsScheduleTime()", "syncService.ts", "googleSheetsService.ts"]
---

# Q: Cell B1 time 'Kathmandu current time: now' +5 min

## Answer

Expanded from original query via vocab: [time, date, current, sheet, sheets, schedule, scheduler, auto, tms, trade, append, sync]. Traversed nodes appendAutoBuySellTrade, getTmsScheduleTime, syncService.ts. Cell B1 in Google Sheet tab 'autoBuySellScript' holds the scheduled execution time for TMS automation. The syncService polls Cell B1 every 30s. Setting Cell B1 to Kathmandu current time: now + 5 minutes (now.getTime() + 5 * 60 * 1000 ms = 300,000ms) guarantees scheduledDate > new Date() when polled, allowing syncService to successfully schedule 'npm run start-tms' with node-schedule.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- getTmsScheduleTime()
- syncService.ts
- googleSheetsService.ts