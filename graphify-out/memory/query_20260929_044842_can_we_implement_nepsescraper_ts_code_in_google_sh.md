---
type: "query"
date: "2026-09-29T04:48:42.375520+00:00"
question: "can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'"
contributor: "graphify"
outcome: "useful"
source_nodes: ["nepseScraper.ts", "scheduleNepseScraper()", "scrapeNepseAndSave()"]
---

# Q: can we implement nepseScraper.ts code in google sheet script which is located in folder 'shareInforScript'

## Answer

Expanded from original query via vocab: [nepse, scraper, google, sheet, report, schedule, playwright, scrape, stealth]. Direct port of nepseScraper.ts into shareInfoScript (Google Apps Script) is not possible because nepseScraper requires headless Chromium, Playwright, and stealth plugins to render the Angular SPA on nepalstock.com and bypass HTTP/2 stream resets. Google Apps Script only provides UrlFetchApp without a browser engine. However, the same business goal (writing NEPSE status to Report!B1 on schedule) can be achieved in Apps Script by fetching server-rendered sources like Sharesansar or Merolagani via UrlFetchApp.

## Outcome

- Signal: useful

## Source Nodes

- nepseScraper.ts
- scheduleNepseScraper()
- scrapeNepseAndSave()