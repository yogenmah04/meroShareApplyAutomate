# Fundamental 52-Week Stock Scanner for Google Sheets

## Vision
An automated, 10-minute scheduled scanner inside Google Apps Script (`shareInfoScript`) that analyzes stocks from the `52WeekHighLow` and `fundamentalInfo` tabs of the "share info" Google Spreadsheet, isolates fundamentally sound companies (where ROE > Sector ROE and ROA > Sector ROA), identifies those trading near their 52-week low (Range % <= 20%) and near their 52-week high (Range % >= 80%), and dynamically renders the prioritized watchlists directly into the existing `Report` sheet starting at cell `A69`.

## Core Value
Automatically surface high-conviction value accumulation opportunities (near 52W Low) and momentum breakouts (near 52W High) with verified superior profitability over sector peers, refreshing on every live data fetch without manual calculation.

## Target Users
Personal trading workflow for NEPSE portfolio management, providing an instant real-time dashboard of high-potential stocks directly in Google Sheets.

## Technical Context
- **Platform**: Google Apps Script (V8 runtime) in `shareInfoScript/`
- **Spreadsheet**: "share info" Google Spreadsheet
- **Source Tabs**:
  - `52WeekHighLow` (Category, Symbol, LTP, 52W High, 52W High Date, 52W Low, 52W Low Date, Range %, Updated At)
  - `fundamentalInfo` (Symbol, Ratios Summary, Financial Strength, Sector, Daily Gain, LTP, PE, PB, ROE, ROA, PEG, Discount From Graham Number, PE vs Sector, PB vs Sector, PEG vs Sector, Dividend Yield vs Sector, ROE Vs Sector, YOY Growth Vs Sector, QOQ Growth Vs Sector, ROA Vs Sector, Dividend Yield, Payout Ratio)
- **Target Destination**: Existing sheet tab `Report` starting from cell `A69`
- **Execution Lifecycle**: Integrated directly into `fetchLiveTradingData()` in `shareInfoScript/liveTradingData.js`, running every 10 minutes during NEPSE market hours.

## Requirements

### Validated
(None yet — ship to validate)

### Active
- [ ] Parse and match stock data across `52WeekHighLow` and `fundamentalInfo` by `Symbol`
- [ ] Filter stocks with superior profitability: `ROE Vs Sector` > 0 / "Higher" and `ROA Vs Sector` > 0 / "Higher"
- [ ] Classify qualifying stocks into two groups:
  - **Near 52W Low (Bargain/Accumulation)**: `Range %` <= 20%
  - **Near 52W High (Breakout/Momentum)**: `Range %` >= 80%
- [ ] Format and write clean, formatted tables into tab `Report` starting at cell `A69`
- [ ] Chain execution seamlessly into `fetchLiveTradingData()` in `shareInfoScript/liveTradingData.js`
- [ ] Safe execution guards: Handle missing symbols, non-numeric values, empty cells, and clear prior contents cleanly

### Out of Scope
- Scraping new external web pages (uses already-scraped data from `52WeekHighLow` and `fundamentalInfo`)
- Automatic order placement (viewing and decision-support only)

## Key Decisions

| Decision | Source | Rationale | Outcome |
|----------|--------|-----------|---------|
| Execution Environment | User | Google Apps Script inside `shareInfoScript` | Decided |
| Trigger Cadence | User | Hooked into `fetchLiveTradingData()` every 10 min during market hours | Decided |
| Output Location | User | Existing sheet tab `Report` from cell `A69` | Decided |
| 52W Metric | User | `Range %` column (<= 20% for Low, >= 80% for High) | Decided |
| Fundamental Criteria | User | Profitability: ROE > Sector ROE and ROA > Sector ROA | Decided |

---
*Last updated: 2026-11-03 after initialization*
