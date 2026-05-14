// ============================================================
// NEPSE Large Player Accumulation Detector — Playwright Script
//
// Install: npm install playwright xlsx
// Run:     node nepse_accumulation.js
// Output:  accumulation_report.xlsx  (opens in Excel / Google Sheets)
// ============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const XLSX = require("xlsx");

// ── CONFIG ───────────────────────────────────────────────────
const SYMBOLS = [
  // Paste your watchlist here — must match NEPSE ticker exactly
  "NABIL",
  "KBL",
  "CHCL",
  "MEN",
  "CBBL",
  "NLIC",
  "LICN",
  "SAHAS",
  "EBL",
  "NTC",
  "NICL",
  "MPFL",
  "NFS",
  "MAKAR",
  "GBBL",
  "PMHPL",
  "SPDL",
  "SKBBL",
];

const CONFIG = {
  VOL_SPIKE_THRESHOLD: 2.5, // Volume 2.5x above avg = spike
  NEAR_LOW_PCT: 15, // Within 15% of 52W low = accumulation zone
  BROKER_CONC_PCT: 25, // Single broker >25% of buy vol = big player
  DAYS_LOOKBACK: 20, // Days for average volume calc
  DELAY_MS: 2000, // Polite delay between requests (ms)
  OUTPUT_FILE: "accumulation_report.xlsx",
  HEADLESS: true, // Set false to watch browser
};

// ── KNOWN INSTITUTIONAL BROKER CODES IN NEPSE ────────────────
// These brokers are commonly used by institutions & big players
const INSTITUTIONAL_BROKERS = {
  1: "NIBL ACE Capital",
  6: "Prabhu Capital",
  10: "NIBL Securities",
  12: "Kumari Capital",
  14: "Nabil Investment Banking",
  17: "NMB Capital",
  19: "Siddhartha Capital",
  21: "Laxmi Capital",
  24: "Global IME Capital",
  28: "Sanima Capital",
  30: "Citizens Investment Trust",
  47: "Prabhu Capital Ltd",
  50: "NMB Bank",
  52: "Nabil Bank",
  56: "Standard Chartered",
};

// ── MAIN ─────────────────────────────────────────────────────
(async () => {
  console.log("\n🔍 NEPSE Large Player Accumulation Scanner");
  console.log("=".repeat(50));
  console.log(`Scanning ${SYMBOLS.length} symbols...\n`);

  const browser = await chromium.launch({ headless: CONFIG.HEADLESS });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const results = [];

  for (const symbol of SYMBOLS) {
    console.log(`  Scanning ${symbol}...`);
    try {
      const stockData = await fetchStockData(context, symbol);
      const floorData = await fetchFloorsheet(context, symbol);
      const analysis = analyzeSignals(symbol, stockData, floorData);
      results.push(analysis);

      // Print to console
      const badge =
        analysis.score >= 4
          ? "🟢 STRONG"
          : analysis.score >= 2
            ? "🟡 WATCH"
            : "⚪ NONE";
      console.log(
        `  ${badge} ${symbol}: score=${analysis.score}, ${analysis.topSignal}`,
      );
    } catch (e) {
      console.log(`  ⚠️  ${symbol}: Error — ${e.message}`);
      results.push({ symbol, error: e.message, score: 0 });
    }
    await sleep(CONFIG.DELAY_MS);
  }

  await browser.close();

  // Export to Excel
  exportToExcel(results);
  console.log(`\n✅ Done! Report saved to: ${CONFIG.OUTPUT_FILE}`);
  console.log(
    `   Strong signals: ${results.filter((r) => r.score >= 4).length} stocks`,
  );
})();

// ── FETCH STOCK DATA FROM MEROLAGANI ─────────────────────────
async function fetchStockData(context, symbol) {
  const page = await context.newPage();
  await page.goto(
    `https://merolagani.com/CompanyDetail.aspx?symbol=${symbol}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    },
  );

  const data = {};

  // LTP
  data.ltp = await safeText(page, "#ctl00_ContentPlaceHolder1_lblMarketPrice");
  data.ltp = parseFloat((data.ltp || "0").replace(/,/g, ""));

  // Today's volume
  data.todayVol = await safeText(
    page,
    "#ctl00_ContentPlaceHolder1_lblShareTraded",
  );
  data.todayVol = parseInt((data.todayVol || "0").replace(/,/g, ""));

  // 52W High / Low
  data.high52 = await safeText(
    page,
    "#ctl00_ContentPlaceHolder1_lbl52WeekHigh",
  );
  data.high52 = parseFloat((data.high52 || "0").replace(/,/g, ""));

  data.low52 = await safeText(page, "#ctl00_ContentPlaceHolder1_lbl52WeekLow");
  data.low52 = parseFloat((data.low52 || "0").replace(/,/g, ""));

  // PE
  data.pe = await safeText(page, "#ctl00_ContentPlaceHolder1_lblPE");
  data.pe = parseFloat(data.pe || "0");

  // EPS
  data.eps = await safeText(page, "#ctl00_ContentPlaceHolder1_lblEPS");
  data.eps = parseFloat((data.eps || "0").replace(/,/g, ""));

  // Previous close
  data.prevClose = await safeText(
    page,
    "#ctl00_ContentPlaceHolder1_lblPreviousClose",
  );
  data.prevClose = parseFloat((data.prevClose || "0").replace(/,/g, ""));

  // Get price history for avg volume calculation
  data.priceHistory = await extractPriceHistory(page);
  data.avgVol20 = calcAvgVol(data.priceHistory, CONFIG.DAYS_LOOKBACK);

  await page.close();
  return data;
}

// ── FETCH FLOORSHEET FROM SHARESANSAR ────────────────────────
async function fetchFloorsheet(context, symbol) {
  const page = await context.newPage();

  // Sharesansar floorsheet
  await page.goto(`https://www.sharesansar.com/floorsheet?symbol=${symbol}`, {
    waitUntil: "networkidle",
    timeout: 25000,
  });

  // Wait for table
  try {
    await page.waitForSelector("table tbody tr", { timeout: 8000 });
  } catch {
    await page.close();
    return { rows: [], brokerStats: {} };
  }

  const rows = await page.evaluate(() => {
    const trs = document.querySelectorAll("table tbody tr");
    return Array.from(trs)
      .map((tr) => {
        const tds = tr.querySelectorAll("td");
        return {
          txnNo: tds[0]?.innerText?.trim() || "",
          symbol: tds[1]?.innerText?.trim() || "",
          buyBroker: tds[2]?.innerText?.trim() || "",
          sellBroker: tds[3]?.innerText?.trim() || "",
          qty: parseInt((tds[4]?.innerText || "0").replace(/,/g, "")) || 0,
          rate: parseFloat((tds[5]?.innerText || "0").replace(/,/g, "")) || 0,
          amount: parseFloat((tds[6]?.innerText || "0").replace(/,/g, "")) || 0,
        };
      })
      .filter((r) => r.qty > 0);
  });

  // Aggregate by broker
  const buyerMap = {};
  const sellerMap = {};
  rows.forEach((r) => {
    if (r.buyBroker)
      buyerMap[r.buyBroker] = (buyerMap[r.buyBroker] || 0) + r.qty;
    if (r.sellBroker)
      sellerMap[r.sellBroker] = (sellerMap[r.sellBroker] || 0) + r.qty;
  });

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  // Top brokers
  const topBuyers = sortTop(buyerMap, 5).map(([b, q]) => ({
    broker: b,
    qty: q,
    pct: totalQty > 0 ? ((q / totalQty) * 100).toFixed(1) : "0",
    isInstitutional: !!INSTITUTIONAL_BROKERS[b],
    name: INSTITUTIONAL_BROKERS[b] || `Broker ${b}`,
  }));

  const topSellers = sortTop(sellerMap, 3).map(([b, q]) => ({
    broker: b,
    qty: q,
    pct: totalQty > 0 ? ((q / totalQty) * 100).toFixed(1) : "0",
    name: INSTITUTIONAL_BROKERS[b] || `Broker ${b}`,
  }));

  // Institutional buy concentration
  const instQty = Object.entries(buyerMap)
    .filter(([b]) => INSTITUTIONAL_BROKERS[b])
    .reduce((s, [, q]) => s + q, 0);
  const instPct = totalQty > 0 ? ((instQty / totalQty) * 100).toFixed(1) : "0";

  const maxBrokerPct = topBuyers[0] ? parseFloat(topBuyers[0].pct) : 0;

  await page.close();
  return {
    rows: rows.length,
    totalQty,
    topBuyers,
    topSellers,
    instQty,
    instPct,
    maxBrokerPct,
    isConcentrated: maxBrokerPct >= CONFIG.BROKER_CONC_PCT,
    hasInstitutionalBuying: parseFloat(instPct) >= 20,
  };
}

// ── SIGNAL ANALYSIS ENGINE ────────────────────────────────────
function analyzeSignals(symbol, stock, floor) {
  const signals = [];
  let score = 0;

  // 1. Volume spike
  let volRatio = null;
  if (stock.todayVol > 0 && stock.avgVol20 > 0) {
    volRatio = stock.todayVol / stock.avgVol20;
    if (volRatio >= CONFIG.VOL_SPIKE_THRESHOLD) {
      const sig = `Vol spike ${volRatio.toFixed(1)}x avg`;
      signals.push(sig);
      score += volRatio >= 5 ? 3 : 2;
    }
  }

  // 2. Near 52-week low
  if (stock.ltp > 0 && stock.low52 > 0) {
    const pctFromLow = ((stock.ltp - stock.low52) / stock.low52) * 100;
    if (pctFromLow <= CONFIG.NEAR_LOW_PCT) {
      signals.push(`Near 52W low (+${pctFromLow.toFixed(1)}%)`);
      score += pctFromLow <= 5 ? 3 : 2;
    }
  }

  // 3. Institutional broker buying (strongest signal in NEPSE)
  if (floor.hasInstitutionalBuying) {
    signals.push(`Institutional brokers ${floor.instPct}% of buys`);
    score += 3;
  }

  // 4. Single broker concentration
  if (floor.isConcentrated) {
    const top = floor.topBuyers[0];
    signals.push(`Big buyer: ${top?.name} (${top?.pct}% of vol)`);
    score += 2;
  }

  // 5. Low PE = value buying
  if (stock.pe > 0 && stock.pe < 12) {
    signals.push(`Low PE ${stock.pe.toFixed(1)} — deep value`);
    score += 1;
  }

  // 6. High EPS with low price = quality at discount
  if (stock.eps > 40 && stock.ltp < 600) {
    signals.push(`Strong EPS ${stock.eps} — undervalued`);
    score += 1;
  }

  // Grade
  const grade =
    score >= 6
      ? "A — Strong accumulation"
      : score >= 4
        ? "B — Probable accumulation"
        : score >= 2
          ? "C — Watch closely"
          : "D — No clear signal";

  return {
    symbol,
    ltp: stock.ltp || "N/A",
    todayVol: stock.todayVol?.toLocaleString() || "N/A",
    avgVol20: stock.avgVol20?.toLocaleString() || "N/A",
    volRatio: volRatio ? volRatio.toFixed(2) + "x" : "N/A",
    pctFromLow:
      stock.low52 > 0
        ? (((stock.ltp - stock.low52) / stock.low52) * 100).toFixed(1) + "%"
        : "N/A",
    pe: stock.pe || "N/A",
    eps: stock.eps || "N/A",
    floorTxns: floor.rows || 0,
    topBuyer: floor.topBuyers?.[0]?.name || "N/A",
    topBuyerPct: floor.topBuyers?.[0] ? floor.topBuyers[0].pct + "%" : "N/A",
    instBuyPct: floor.instPct ? floor.instPct + "%" : "N/A",
    bigPlayer:
      floor.isConcentrated || floor.hasInstitutionalBuying ? "YES" : "No",
    score,
    grade,
    topSignal: signals[0] || "No signal",
    allSignals: signals.join(" | ") || "None",
    scannedAt: new Date().toLocaleString("en-NP"),
  };
}

// ── EXPORT TO EXCEL ───────────────────────────────────────────
function exportToExcel(results) {
  const wb = XLSX.utils.book_new();

  // Sort by score
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Main results sheet
  const ws = XLSX.utils.json_to_sheet(
    results.map((r) => ({
      Symbol: r.symbol,
      "LTP (Rs)": r.ltp,
      "Today Volume": r.todayVol,
      "20D Avg Volume": r.avgVol20,
      "Volume Ratio": r.volRatio,
      "% From 52W Low": r.pctFromLow,
      PE: r.pe,
      EPS: r.eps,
      "Floor Txns": r.floorTxns,
      "Top Buyer Broker": r.topBuyer,
      "Top Buyer %": r.topBuyerPct,
      "Institutional Buy %": r.instBuyPct,
      "Big Player Active?": r.bigPlayer,
      "Score (0-10)": r.score,
      Grade: r.grade,
      "Top Signal": r.topSignal,
      "All Signals": r.allSignals,
      "Scanned At": r.scannedAt,
      Error: r.error || "",
    })),
  );

  XLSX.utils.book_append_sheet(wb, ws, "Accumulation Signals");

  // Strong signals only
  const strong = results.filter((r) => r.score >= 4);
  if (strong.length) {
    const ws2 = XLSX.utils.json_to_sheet(strong);
    XLSX.utils.book_append_sheet(wb, ws2, "Strong Signals");
  }

  XLSX.writeFile(wb, CONFIG.OUTPUT_FILE);
}

// ── HELPERS ───────────────────────────────────────────────────
async function safeText(page, selector) {
  try {
    return await page.textContent(selector, { timeout: 3000 });
  } catch {
    return null;
  }
}

async function extractPriceHistory(page) {
  try {
    return await page.evaluate(() => {
      const rows = document.querySelectorAll(
        "#ctl00_ContentPlaceHolder1_divPriceHistory table tr",
      );
      return Array.from(rows)
        .slice(1, 22)
        .map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            date: tds[0]?.innerText?.trim(),
            open: parseFloat((tds[1]?.innerText || "0").replace(/,/g, "")),
            high: parseFloat((tds[2]?.innerText || "0").replace(/,/g, "")),
            low: parseFloat((tds[3]?.innerText || "0").replace(/,/g, "")),
            close: parseFloat((tds[4]?.innerText || "0").replace(/,/g, "")),
            volume: parseInt((tds[5]?.innerText || "0").replace(/,/g, "")),
          };
        })
        .filter((r) => r.volume > 0);
    });
  } catch {
    return [];
  }
}

function calcAvgVol(history, days) {
  if (!history || !history.length) return 0;
  const vols = history
    .slice(0, days)
    .map((r) => r.volume)
    .filter((v) => v > 0);
  if (!vols.length) return 0;
  return Math.round(vols.reduce((a, b) => a + b, 0) / vols.length);
}

function sortTop(map, n) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
