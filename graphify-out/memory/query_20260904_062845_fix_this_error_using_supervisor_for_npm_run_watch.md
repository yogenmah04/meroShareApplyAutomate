---
type: "query"
date: "2026-09-04T06:28:45.887476+00:00"
question: "fix this error using supervisor for npm run watch-sheets"
contributor: "graphify"
outcome: "useful"
source_nodes: ["scheduleNepseScraper", "scrapeNepseAndSave", "main"]
---

# Q: fix this error using supervisor for npm run watch-sheets

## Answer

Expanded from original query via vocab: [nepse, scraper, retry, resilience, playwright, stealth, schedule, sheets]. Fixed net::ERR_HTTP2_PROTOCOL_ERROR by launching Chromium with --disable-http2, adding scrape retry loop, safe CDP session cleanup, and process-level unhandled rejection handlers in syncService. Added Linux supervisor config meroshare-supervisor.conf and npm script supervise-watch-sheets via supervisor.ts.

## Outcome

- Signal: useful

## Source Nodes

- scheduleNepseScraper
- scrapeNepseAndSave
- main