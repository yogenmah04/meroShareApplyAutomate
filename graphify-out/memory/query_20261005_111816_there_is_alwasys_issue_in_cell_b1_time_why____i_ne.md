---
type: "query"
date: "2026-10-05T11:18:16.436939+00:00"
question: "there is alwasys issue in Cell B1 time why ?, i need 'Kathmandu current time: now' + add extra 2 min"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "getTmsScheduleTime()", "syncService.ts", "googleSheetsService.ts"]
---

# Q: there is alwasys issue in Cell B1 time why ?, i need 'Kathmandu current time: now' + add extra 2 min

## Answer

Root cause identified directly from watch-sheets.log: appendAutoBuySellTrade() was writing currentDateTimeStr (the exact current second). syncService polls every 30s and requires scheduledDate > new Date(). By the time Google Sheets API saves and syncService polls (even 2 seconds later), the timestamp in Cell B1 is already in the past, causing syncService to log: 'Scheduled time is in the past. Will not schedule.' every single time. Adding +2 minutes (120,000 ms) to now guarantees the scheduled time is 90 to 120 seconds into the future when polled, allowing node-schedule to trigger start-tms properly.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- getTmsScheduleTime()
- syncService.ts
- googleSheetsService.ts