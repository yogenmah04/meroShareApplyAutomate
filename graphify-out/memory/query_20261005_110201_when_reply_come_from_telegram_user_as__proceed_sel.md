---
type: "query"
date: "2026-10-05T11:02:01.887619+00:00"
question: "when reply come from telegram user as 'proceed_sell' it append in 'autoBuySellScript' payload data correct as SN-> correct Symbol-> correct qty-> correct price -> incorrect ( correct is = >put price as blank) cell B1 -> incorrect (correct is current timestamp + 1min)"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "handleTelegramCommand()", "getTmsScheduleTime()", "telegramBotService.ts", "googleSheetsService.ts", "syncService.ts"]
---

# Q: when reply come from telegram user as 'proceed_sell' it append in 'autoBuySellScript' payload data correct as SN-> correct Symbol-> correct qty-> correct price -> incorrect ( correct is = >put price as blank) cell B1 -> incorrect (correct is current timestamp + 1min)

## Answer

Expanded from original query via vocab: [append, auto, bot, buy, data, price, sell, service, sheet, telegram, time, trade]. Traversed nodes appendAutoBuySellTrade, handleTelegramCommand, getTmsScheduleTime, syncService.ts. When telegram user triggers 'proceed_sell', telegramBotService calls appendAutoBuySellTrade in googleSheetsService. Currently: 1) Price is written as Number(price) from the alert callback; correct behavior is leaving Column D empty/blank so tmsAutomation can dynamically fetch the low price + 0.5. 2) Cell B1 is currently written as current timestamp; correct behavior is setting Cell B1 to current timestamp + 1 minute so syncService.ts polling loop (which checks scheduledDate > new Date()) can successfully schedule npm run start-tms.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- handleTelegramCommand()
- getTmsScheduleTime()
- telegramBotService.ts
- googleSheetsService.ts
- syncService.ts