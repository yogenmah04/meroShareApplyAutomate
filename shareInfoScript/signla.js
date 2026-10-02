function createSignalSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Delete old signal sheet if exists
  var existing = ss.getSheetByName("📊 Signals");
  if (existing) ss.deleteSheet(existing);
  
  var sheet = ss.insertSheet("📊 Signals");
  var fundSheet = ss.getSheetByName("fundamentalInfo");
  var liveSheet = ss.getSheetByName("live trading");
  var yogenSheet = ss.getSheetByName("yogen");
  
  // ── HEADER ROW ──────────────────────────────────────────
  var headers = [
    "Symbol","Sector","LTP","Avg Buy\nPrice","Kitta Held",
    "P&L %","Financial\nStrength","PE","PB","ROE %","ROA %",
    "Fundamental\nScore","SL Price\n(-7%)","TP Price\n(+10%)",
    "📊 SIGNAL","⚡ ACTION","📝 Notes"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  var hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setBackground("#1a1a2e");
  hRange.setFontColor("#ffffff");
  hRange.setFontWeight("bold");
  hRange.setFontSize(10);
  hRange.setWrap(true);
  hRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 45);
  
  // ── TITLE SECTION ────────────────────────────────────────
  sheet.getRange("A1:A1").setNote("Auto-generated signals. Refresh by re-running createSignalSheet()");
  
  // ── READ FUNDAMENTAL DATA ────────────────────────────────
  // Assumes fundamentalInfo columns: Symbol, Ratios Summary (Strength), Sector,
  // Daily Gain, LTP, PE, PB, ROE, ROA, PEG, ...
  var fundData = fundSheet.getDataRange().getValues();
  var fundMap = {};
  for (var i = 1; i < fundData.length; i++) {
    var row = fundData[i];
    var sym = String(row[0]).trim().toUpperCase();
    if (sym) {
      fundMap[sym] = {
        strength: String(row[1]).trim(),   // Ratios Summary
        sector:   String(row[3]).trim(),   // Sector
        ltp:      parseFloat(row[5]) || 0, // LTP
        pe:       parseFloat(row[6]) || 0,
        pb:       parseFloat(row[7]) || 0,
        roe:      parseFloat(String(row[8]).replace('%','')) || 0,
        roa:      parseFloat(String(row[9]).replace('%','')) || 0,
        peg:      parseFloat(row[10]) || 0
      };
    }
  }
  
  // ── READ YOGEN PORTFOLIO ──────────────────────────────────
  // Columns: Symbol, Sector, kitta, share value (LTP), total,
  //          purchase price, purchase total, profit/loss, date, days, profit%
  var yogenData = yogenSheet.getDataRange().getValues();
  var portfolioMap = {};
  for (var j = 1; j < yogenData.length; j++) {
    var yr = yogenData[j];
    var ys = String(yr[0]).trim().toUpperCase();
    if (ys && ys.length > 1 && ys.length < 10) {
      var kitta   = parseFloat(yr[2]) || 0;
      var avgBuy  = parseFloat(yr[5]) || 0;
      var plPct   = parseFloat(String(yr[10]).replace('%','')) || 0;
      if (kitta > 0 && avgBuy > 0) {
        if (portfolioMap[ys]) {
          portfolioMap[ys].kitta  += kitta;
          portfolioMap[ys].avgBuy  = (portfolioMap[ys].avgBuy + avgBuy) / 2;
        } else {
          portfolioMap[ys] = { kitta: kitta, avgBuy: avgBuy, plPct: plPct };
        }
      }
    }
  }
  
  // ── SCORING FUNCTION ──────────────────────────────────────
  function fundamentalScore(f) {
    var score = 0;
    var strength = f.strength.toLowerCase();
    if (strength === "strong")      score += 40;
    else if (strength === "medium") score += 20;
    else                            score += 0;
    
    // PE score (lower is better, but not negative)
    if (f.pe > 0 && f.pe < 20)       score += 20;
    else if (f.pe >= 20 && f.pe < 40) score += 10;
    else if (f.pe >= 40)              score += 0;
    
    // ROE score
    if (f.roe >= 15)      score += 20;
    else if (f.roe >= 10) score += 10;
    else if (f.roe >= 5)  score += 5;
    
    // ROA score
    if (f.roa >= 2)       score += 10;
    else if (f.roa >= 1)  score += 5;
    
    // PB score (lower is better)
    if (f.pb > 0 && f.pb < 2)       score += 10;
    else if (f.pb >= 2 && f.pb < 4) score += 5;
    
    return score;
  }
  
  // ── BUILD SIGNAL ROWS ─────────────────────────────────────
  var allSymbols = {};
  // Add all fundamental symbols
  for (var sym in fundMap) allSymbols[sym] = true;
  // Add portfolio symbols
  for (var sym in portfolioMap) allSymbols[sym] = true;
  
  var rows = [];
  
  for (var symbol in allSymbols) {
    var f = fundMap[symbol] || null;
    var p = portfolioMap[symbol] || null;
    
    if (!f) continue; // skip if no fundamental data
    
    var ltp     = f.ltp;
    var avgBuy  = p ? p.avgBuy : 0;
    var kitta   = p ? p.kitta : 0;
    var plPct   = (ltp > 0 && avgBuy > 0) ? ((ltp - avgBuy) / avgBuy * 100) : 0;
    var score   = fundamentalScore(f);
    var sl      = (ltp > 0) ? Math.round(ltp * 0.93 * 100) / 100 : 0;
    var tp      = (ltp > 0) ? Math.round(ltp * 1.10 * 100) / 100 : 0;
    
    // ── SIGNAL LOGIC ──────────────────────────────────────
    var signal = "";
    var action = "";
    var notes  = "";
    
    var isSLHit     = (avgBuy > 0 && ltp > 0 && ltp <= avgBuy * 0.93);
    var isTPHit     = (avgBuy > 0 && ltp > 0 && ltp >= avgBuy * 1.10);
    var isOverbought= (plPct >= 15);
    var isOversold  = (plPct <= -10);
    var goodFund    = score >= 60;
    var medFund     = score >= 35;
    var inPortfolio = (kitta > 0);
    
    if (isSLHit && inPortfolio) {
      signal = "🔴 SELL";
      action = "Cut Loss – SL Hit";
      notes  = "Price hit -7% SL from avg buy (" + avgBuy.toFixed(0) + "). Exit to protect capital.";
    } else if (isTPHit && inPortfolio) {
      signal = "🟢 SELL/TP";
      action = "Take Profit";
      notes  = "Target +10% reached. Book profit or trail SL.";
    } else if (isOverbought && inPortfolio) {
      signal = "🟡 SELL";
      action = "Partial Sell";
      notes  = "Up 15%+. Consider selling 50% and trailing rest.";
    } else if (inPortfolio && isOversold && goodFund) {
      signal = "🔵 ADD UP";
      action = "Average Down";
      notes  = "Strong fundamentals. Down 10%+. Can average if RSI<40 & exposure<10%.";
    } else if (!inPortfolio && goodFund && ltp > 0) {
      signal = "🟢 BUY";
      action = "Fresh Entry";
      notes  = "Strong fundamentals (score " + score + "/100). Watch for RSI<35 entry.";
    } else if (!inPortfolio && medFund && ltp > 0) {
      signal = "🟡 WATCH";
      action = "Monitor";
      notes  = "Moderate fundamentals. Wait for oversold RSI before entry.";
    } else if (inPortfolio && goodFund && !isOverbought && !isSLHit) {
      signal = "🔵 HOLD";
      action = "Hold";
      notes  = "Good fundamentals. Within normal range. Continue holding.";
    } else {
      signal = "⚪ NEUTRAL";
      action = "No action";
      notes  = "Weak fundamentals or insufficient data.";
    }
    
    rows.push([
      symbol,
      f.sector,
      ltp,
      avgBuy > 0 ? avgBuy : "—",
      kitta > 0  ? kitta  : "—",
      avgBuy > 0 ? plPct.toFixed(1) + "%" : "—",
      f.strength,
      f.pe > 0   ? f.pe   : "—",
      f.pb > 0   ? f.pb   : "—",
      f.roe > 0  ? f.roe + "%" : "—",
      f.roa > 0  ? f.roa + "%" : "—",
      score + "/100",
      sl > 0 ? sl : "—",
      tp > 0 ? tp : "—",
      signal,
      action,
      notes
    ]);
  }
  
  // Sort: SELL first, then BUY, then ADD UP, then HOLD, then WATCH, then NEUTRAL
  var order = {"🔴 SELL":0,"🟢 SELL/TP":1,"🟡 SELL":2,"🟢 BUY":3,"🔵 ADD UP":4,"🔵 HOLD":5,"🟡 WATCH":6,"⚪ NEUTRAL":7};
  rows.sort(function(a,b) {
    var oa = order[a[14]] !== undefined ? order[a[14]] : 99;
    var ob = order[b[14]] !== undefined ? order[b[14]] : 99;
    if (oa !== ob) return oa - ob;
    return b[11].toString().localeCompare(a[11].toString());
  });
  
  // ── WRITE DATA ────────────────────────────────────────────
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // ── CONDITIONAL FORMATTING ────────────────────────────────
  var signalCol = "O"; // column 15
  var dataRange = sheet.getRange(2, 1, rows.length || 1, headers.length);
  
  // Color rows by signal
  for (var r = 0; r < rows.length; r++) {
    var rowNum  = r + 2;
    var sig     = String(rows[r][14]);
    var rowRef  = sheet.getRange(rowNum, 1, 1, headers.length);
    if (sig.includes("🔴") || (sig.includes("🟡") && sig.includes("SELL"))) {
      rowRef.setBackground("#fff1f1");
    } else if (sig.includes("🟢 BUY")) {
      rowRef.setBackground("#f0fff4");
    } else if (sig.includes("🔵 ADD")) {
      rowRef.setBackground("#eff6ff");
    } else if (sig.includes("🟡 WATCH")) {
      rowRef.setBackground("#fffbeb");
    } else if (sig.includes("🟢 SELL")) {
      rowRef.setBackground("#f0fff4");
    }
  }
  
  // ── COLUMN WIDTHS ─────────────────────────────────────────
  sheet.setColumnWidths(1, 1, 80);   // Symbol
  sheet.setColumnWidths(2, 1, 140);  // Sector
  sheet.setColumnWidths(3, 1, 70);   // LTP
  sheet.setColumnWidths(4, 1, 80);   // Avg Buy
  sheet.setColumnWidths(5, 1, 65);   // Kitta
  sheet.setColumnWidths(6, 1, 65);   // P&L%
  sheet.setColumnWidths(7, 1, 80);   // Strength
  sheet.setColumnWidths(8, 1, 55);   // PE
  sheet.setColumnWidths(9, 1, 50);   // PB
  sheet.setColumnWidths(10, 1, 65);  // ROE
  sheet.setColumnWidths(11, 1, 65);  // ROA
  sheet.setColumnWidths(12, 1, 80);  // Score
  sheet.setColumnWidths(13, 1, 80);  // SL
  sheet.setColumnWidths(14, 1, 80);  // TP
  sheet.setColumnWidths(15, 1, 110); // Signal
  sheet.setColumnWidths(16, 1, 110); // Action
  sheet.setColumnWidths(17, 1, 300); // Notes
  
  // ── FREEZE & FORMAT ───────────────────────────────────────
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  dataRange.setFontSize(10);
  dataRange.setVerticalAlignment("middle");
  
  // Alternating row shading (overridden by signal colors above, but sets baseline)
  // Already done per signal above.
  
  // ── SUMMARY BOX ──────────────────────────────────────────
  var sumRow = rows.length + 3;
  var sells  = rows.filter(function(r){ return r[14].toString().includes("SELL"); }).length;
  var buys   = rows.filter(function(r){ return r[14].toString().includes("BUY");  }).length;
  var adds   = rows.filter(function(r){ return r[14].toString().includes("ADD");  }).length;
  var holds  = rows.filter(function(r){ return r[14].toString().includes("HOLD"); }).length;
  
  sheet.getRange(sumRow, 1, 1, 4).setValues([["SUMMARY","SELL: "+sells,"BUY: "+buys,"ADD: "+adds]]);
  sheet.getRange(sumRow, 1, 1, 4).setBackground("#1a1a2e").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10);
  
  // ── LAST UPDATED ──────────────────────────────────────────
  sheet.getRange(sumRow + 1, 1).setValue("Last updated: " + new Date().toLocaleString("en-GB"));
  sheet.getRange(sumRow + 1, 1).setFontColor(SpreadsheetApp.newColor().setRgbColor("#888888").build());
  
  SpreadsheetApp.flush();
  try {
    SpreadsheetApp.getUi().alert(
      "✅ Signal sheet created!\n\n" +
      "Found " + rows.length + " stocks.\n" +
      "SELL signals: " + sells + "\n" +
      "BUY signals: " + buys + "\n" +
      "ADD UP signals: " + adds + "\n\n" +
      "Tab: 📊 Signals"
    );
  } catch (e) {
    Logger.log("✅ Signal sheet created (trigger/headless mode). Found " + rows.length + " stocks. SELL: " + sells + ", BUY: " + buys + ", ADD: " + adds);
  }
}

// ── TRIGGER / ENGINE ALIAS ────────────────────────────────────
function runSignalEngine() {
  createSignalSheet();
}