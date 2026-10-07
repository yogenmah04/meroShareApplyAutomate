---
type: "query"
date: "2026-10-05T11:43:30.159336+00:00"
question: "TMS Automation popup notification error page.waitForSelector dashboard-wrapper closed"
contributor: "graphify"
outcome: "useful"
source_nodes: ["runAutomation()", "executeSingleTrade()", "humanClick()", "tmsAutomation.ts"]
---

# Q: TMS Automation popup notification error page.waitForSelector dashboard-wrapper closed

## Answer

TMS popups (such as announcement advisories, Force Login/duplicate session modals, or notice dialogs) were causing page.waitForSelector('.dashboard-wrapper') to hang or fail when closed. Resolved by implementing dismissTmsPopups() in tmsAutomation.ts: 1) Proactively clicks common dismiss buttons (Close, OK, Proceed, Continue, Yes, Dismiss, Got it, [aria-label=Close]) and sends Escape to dismiss backdrops. 2) Replaced the rigid waitForSelector with an active polling loop that checks for dashboard visibility while auto-dismissing popups. 3) Calls dismissTmsPopups() before humanClick actions to ensure no modal backdrop blocks navigation.

## Outcome

- Signal: useful

## Source Nodes

- runAutomation()
- executeSingleTrade()
- humanClick()
- tmsAutomation.ts