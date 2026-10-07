---
type: "query"
date: "2026-10-05T11:31:51.935875+00:00"
question: "To clear a formula set cell value null error when appending auto buy sell trade"
contributor: "graphify"
outcome: "useful"
source_nodes: ["appendAutoBuySellTrade()", "googleSheetsService.ts"]
---

# Q: To clear a formula set cell value null error when appending auto buy sell trade

## Answer

The Google Spreadsheet API throws 'To clear a formula, set cell.value = null' if formula is set to empty string. Fixed in googleSheetsService.ts by unconditionally setting formula = =C{rowNumber}*D{rowNumber} (which natively evaluates to 0 in Google Sheets when Col D is blank). Verified live in Google Sheet: Cell B1 gets now + 2 min, Col D is blank (null), Col F formula evaluates correctly with zero errors.

## Outcome

- Signal: useful

## Source Nodes

- appendAutoBuySellTrade()
- googleSheetsService.ts