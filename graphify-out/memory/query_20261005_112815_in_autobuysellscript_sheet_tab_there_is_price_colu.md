---
type: "query"
date: "2026-10-05T11:28:15.608110+00:00"
question: "in autoBuySellScript sheet tab there is price column i say it need to blank and in B1 there should be current datetime stamp plus 2 min why it is not reflecting as i have already restart the supervisor"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "startTelegramBotListener()", "handleTelegramCommand()", "syncService.ts", "googleSheetsService.ts", "telegramBotService.ts"]
---

# Q: in autoBuySellScript sheet tab there is price column i say it need to blank and in B1 there should be current datetime stamp plus 2 min why it is not reflecting as i have already restart the supervisor

## Answer

The changes had not been saved to disk prior to the supervisor restart. Both files have now been modified and saved to disk: 1) googleSheetsService.ts appendAutoBuySellTrade now calculates Cell B1 as current Kathmandu timestamp + 2 min (now.getTime() + 120,000ms), and writes empty string '' to Column D (price) and Column F formula. 2) telegramBotService.ts passes price: '' for proceed_sell orders and displays market price. syncService.ts was then restarted cleanly under supervisor (PID 1938776) and is now running with the updated logic.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- startTelegramBotListener()
- handleTelegramCommand()
- syncService.ts
- googleSheetsService.ts
- telegramBotService.ts