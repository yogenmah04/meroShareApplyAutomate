---
type: "query"
date: "2026-09-29T05:09:17.374045+00:00"
question: "what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = \"0 05 16 * * *\";' in google sheet script"
contributor: "graphify"
outcome: "useful"
source_nodes: ["nepseScraper.ts", "scheduleNepseScraper()", "nepseStatusAppsScript.js", "setupNepseAllTriggers()", "Report!B1"]
---

# Q: what about for running in nepseScraper.ts at ' const scheduleRuleAfternoon = "0 05 16 * * *";' in google sheet script

## Answer

Expanded from original query via vocab: [nepse, scraper, schedule, scheduled, google, sheet, script, time]. Implemented setupNepse1605Trigger() and setupNepseAllTriggers() in nepseStatusAppsScript.js so Google Apps Script triggers scrapeNepseStatusDaily both at ~11:01 AM (market open) and at ~4:05 PM / 16:05 (market close), mirroring scheduleNepseScraper() from nepseScraper.ts. Pushed updates to Google Apps Script.

## Outcome

- Signal: useful

## Source Nodes

- nepseScraper.ts
- scheduleNepseScraper()
- nepseStatusAppsScript.js
- setupNepseAllTriggers()
- Report!B1