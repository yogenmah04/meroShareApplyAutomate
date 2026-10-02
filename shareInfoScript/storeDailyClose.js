// =============================================================================
// priceHistory.gs — Daily RSI-14 + Intraday Dip Detection (Extended Metrics)
// Tabs created/managed:
//   🗃️ DailyClose   — Hidden matrix storing up to 60 trading days of OHLCV+ metrics
//   📈 RSI & Dip     — Output: RSI-14 + intraday dip per symbol
//   🎯 Watchlist Dip — Filtered: held + value picks in buy/dip zone
// =============================================================================

var DAILY_TAB  = '🗃️ DailyClose';
var RSI_TAB    = '📈 RSI & Dip';
var WATCH_TAB  = '🎯 Watchlist Dip';
var MAX_DAYS   = 60; // Updated from 20 to 60 days
var RSI_PERIOD = 14;

// FIX [2] — NEPSE trades Sun(0)–Thu(4); weekend = Fri(5) + Sat(6)
function isMarketOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reportWs = ss.getSheetByName('Report');

  if (reportWs) {
    var status = reportWs.getRange('B1').getValue().toString().trim();
    if (status === 'Market Closed') {
      console.log("Stopping: 'Report'!B1 says Market Closed.");
      return false;
    }
  }

  var day = new Date().getDay();
  if (day === 5 || day === 6) return false; // Fri + Sat = NEPSE weekend

  return true;
}

// Helper to fetch allowed symbols from "resistance and support" range A1:A
function getAllowedSymbols() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('resistance and support');
  if (!sheet) return null; // Returns null if sheet doesn't exist so it doesn't block if uncreated
  
  var rangeValues = sheet.getRange('A1:A').getValues();
  var allowedMap = {};
  for (var i = 0; i < rangeValues.length; i++) {
    var sym = String(rangeValues[i][0] || '').trim().toUpperCase();
    if (sym && sym !== 'SYMBOL') {
      allowedMap[sym] = true;
    }
  }
  return allowedMap;
}

// =============================================================================
// TRIGGER 1 — storeDailyClose()
// Runs once daily at 3 PM (set via setupTriggers with nearMinute(5))
// Captures full OHLCV matrix per symbol into 🗃️ DailyClose
// =============================================================================
function storeDailyClose() {
  if (!isMarketOpen()) return;
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var livWs = ss.getSheetByName('live trading');
  if (!livWs) return;

  var allowedSymbols = getAllowedSymbols();

  var today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var liveRows = livWs.getDataRange().getValues();

  var todayDataMap = {};
  for (var i = 1; i < liveRows.length; i++) {
    var sym = String(liveRows[i][1] || '').trim().toUpperCase();
    
    // Skip if not listed in resistance and support tab (if the tab exists)
    if (allowedSymbols && !allowedSymbols[sym]) continue;

    var ltp = parsePrice(liveRows[i][2]);
    if (sym && ltp > 0) {
      todayDataMap[sym] = {
        open:      parsePrice(liveRows[i][5]),
        high:      parsePrice(liveRows[i][6]),
        low:       parsePrice(liveRows[i][7]),
        close:     ltp,
        volume:    parsePrice(liveRows[i][8]),
        ptChange:  parsePrice(liveRows[i][3]),
        pctChange: parsePrice(liveRows[i][4]),
        prevClose: parsePrice(liveRows[i][9]),
        candle:    String(liveRows[i][13] || '').trim()
      };
    }
  }

  var headers = ['Symbol','Date','Open','High','Low','Close','Volume','Point Change','Change %','Prev Close','Candle'];
  var ws = ss.getSheetByName(DAILY_TAB);
  if (!ws) {
    ws = ss.insertSheet(DAILY_TAB);
    ws.hideSheet();
    ws.getRange(1, 1, 1, headers.length).setValues([headers]);
    ws.setFrozenRows(1);
  }

  // Read existing data into memory
  var existing = ws.getDataRange().getValues();
  var hist = {};
  for (var j = 1; j < existing.length; j++) {
    var s = String(existing[j][0] || '').trim().toUpperCase();
    if (!s) continue;
    
    // Filter out old records if they are no longer in the allowed list
    if (allowedSymbols && !allowedSymbols[s]) continue;

    if (!hist[s]) hist[s] = [];
    
    var rawDate = existing[j][1];
    var safeDateStr = (rawDate instanceof Date) 
      ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd') 
      : String(rawDate).substring(0, 10);

    hist[s].push({
      date:      safeDateStr, 
      open:      parsePrice(existing[j][2]),
      high:      parsePrice(existing[j][3]),
      low:       parsePrice(existing[j][4]),
      close:     parsePrice(existing[j][5]),
      volume:    parsePrice(existing[j][6]),
      ptChange:  parsePrice(existing[j][7]),
      pctChange: parsePrice(existing[j][8]),
      prevClose: parsePrice(existing[j][9]),
      candle:    String(existing[j][10] || '').trim()
    });
  }

  // Merge today's data — prevent duplicates, enforce 60-day window
  var syms = Object.keys(todayDataMap);
  for (var k = 0; k < syms.length; k++) {
    var sym2 = syms[k];
    if (!hist[sym2]) hist[sym2] = [];
    var lastIdx = hist[sym2].length - 1;
    var tObj = todayDataMap[sym2];
    var entry = {
      date: today, open: tObj.open, high: tObj.high, low: tObj.low,
      close: tObj.close, volume: tObj.volume, ptChange: tObj.ptChange,
      pctChange: tObj.pctChange, prevClose: tObj.prevClose, candle: tObj.candle
    };
    if (lastIdx >= 0 && hist[sym2][lastIdx].date === today) {
      hist[sym2][lastIdx] = entry; 
    } else {
      hist[sym2].push(entry);
    }
    if (hist[sym2].length > MAX_DAYS) {
      hist[sym2] = hist[sym2].slice(-MAX_DAYS);
    }
  }

  // Flatten back to sheet
  var out = [headers];
  var allSyms = Object.keys(hist).sort();
  for (var m = 0; m < allSyms.length; m++) {
    var entries = hist[allSyms[m]];
    for (var n = 0; n < entries.length; n++) {
      var e = entries[n];
      out.push([allSyms[m], e.date, e.open, e.high, e.low, e.close,
                e.volume, e.ptChange, e.pctChange, e.prevClose, e.candle]);
    }
  }
  ws.clearContents();
  ws.getRange(1, 1, out.length, headers.length).setValues(out);
  if (out.length > 1) {
    ws.getRange(2, 2, out.length - 1, 1).setNumberFormat('yyyy-MM-dd');
    ws.getRange(2, 3, out.length - 1, 4).setNumberFormat('#,##0.00'); // Open, High, Low, Close
    ws.getRange(2, 7, out.length - 1, 1).setNumberFormat('#,##0');    // Volume
    ws.getRange(2, 8, out.length - 1, 3).setNumberFormat('#,##0.00'); // Pt Change, Pct Change, Prev Close
  }

  // Build standardCloseHist for RSI computation
  var standardCloseHist = {};
  allSyms.forEach(function(s) {
    standardCloseHist[s] = hist[s].map(function(item) {
      return [item.date, item.close];
    });
  });

  var liveMap = buildLiveMap(liveRows, allowedSymbols);
  computeAndWriteRsiDip(ss, liveMap, standardCloseHist);

  _log(ss, 'storeDailyClose', 'Stored 11-col matrix for ' + syms.length + ' symbols on ' + today);
}

// =============================================================================
// TRIGGER 2 — refreshIntradayDip()
// Runs every 10 minutes — updates RSI & Dip tab with intraday live data
// =============================================================================
function refreshIntradayDip() {
  if (!isMarketOpen()) return; 
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var livWs = ss.getSheetByName('live trading');
  if (!livWs) return;

  var allowedSymbols = getAllowedSymbols();
  var liveRows = livWs.getDataRange().getValues();
  var liveMap  = buildLiveMap(liveRows, allowedSymbols);
  var hist     = readDailyHist(ss, allowedSymbols);

  computeAndWriteRsiDip(ss, liveMap, hist);
}

function runAll() {
  if (!isMarketOpen()) return;
  refreshIntradayDip();
  if (typeof runSignalEngine === 'function') runSignalEngine();
}

// =============================================================================
// HELPERS
// =============================================================================
function buildLiveMap(rows, allowedSymbols) {
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var sym = String(rows[i][1] || '').trim().toUpperCase();
    if (!sym) continue;
    if (allowedSymbols && !allowedSymbols[sym]) continue;
    
    map[sym] = {
      ltp:       parsePrice(rows[i][2]),
      open:      parsePrice(rows[i][5]),
      high:      parsePrice(rows[i][6]),
      low:       parsePrice(rows[i][7]),
      volume:    parsePrice(rows[i][8]),
      prevClose: parsePrice(rows[i][9]),
      candle:    String(rows[i][13] || '').trim()
    };
  }
  return map;
}

// Reads 🗃️ DailyClose — close is at column index [5]
function readDailyHist(ss, allowedSymbols) {
  var ws = ss.getSheetByName(DAILY_TAB);
  if (!ws) return {};
  var rows = ws.getDataRange().getValues();
  var hist = {};
  for (var i = 1; i < rows.length; i++) {
    var s = String(rows[i][0] || '').trim().toUpperCase();
    if (!s) continue;
    if (allowedSymbols && !allowedSymbols[s]) continue;

    if (!hist[s]) hist[s] = [];
    hist[s].push([String(rows[i][1]), parsePrice(rows[i][5])]);
  }
  return hist;
}

// =============================================================================
// RSI-14 — Wilder smoothing (correct implementation)
// =============================================================================
function calcRSI(prices) {
  if (!prices || prices.length < RSI_PERIOD + 1) return null;
  var ag = 0, al = 0;
  for (var i = 1; i <= RSI_PERIOD; i++) {
    var d = prices[i] - prices[i - 1];
    if (d >= 0) ag += d; else al -= d;
  }
  ag /= RSI_PERIOD;
  al /= RSI_PERIOD;
  for (var j = RSI_PERIOD + 1; j < prices.length; j++) {
    var diff = prices[j] - prices[j - 1];
    ag = (ag * (RSI_PERIOD - 1) + (diff >= 0 ? diff : 0)) / RSI_PERIOD;
    al = (al * (RSI_PERIOD - 1) + (diff <  0 ? -diff : 0)) / RSI_PERIOD;
  }
  if (al === 0) return 100;
  return Math.round((100 - 100 / (1 + ag / al)) * 10) / 10;
}

function rsiLabel(rsi, validPriceCount) {
  if (rsi === null) {
    var need = Math.max(0, RSI_PERIOD + 1 - validPriceCount);
    return '⏳ Need ' + need + ' more day' + (need === 1 ? '' : 's');
  }
  if (rsi < 25)  return '🟢 Oversold — Strong BUY';
  if (rsi < 35)  return '🟡 Near Oversold — Watch';
  if (rsi <= 55) return '⚪ Neutral';
  if (rsi <= 70) return '🟠 Overbought — Caution';
  return                 '🔴 Severely Overbought — Avoid';
}

function detectDip(lv) {
  var dayChg = lv.prevClose > 0 ? (lv.ltp - lv.prevClose) / lv.prevClose * 100 : 0;
  var frHigh = lv.high     > 0 ? (lv.ltp - lv.high)     / lv.high     * 100 : 0;
  var frOpen = lv.open     > 0 ? (lv.ltp - lv.open)     / lv.open     * 100 : 0;

  var sigs = [];
  if      (dayChg <= -3.0) sigs.push('🔴 Sharp Dip '    + r1(dayChg) + '%');
  else if (dayChg <= -1.5) sigs.push('🟡 Mild Dip '     + r1(dayChg) + '%');
  if (frHigh <= -2.0)      sigs.push('📉 Pullback '      + r1(frHigh) + '% from High');
  if (frOpen  >= 1.5)      sigs.push('📈 Up from Open +' + r1(frOpen) + '%');

  return {
    sig:    sigs.join(' | ') || '—',
    dayChg: r1(dayChg),
    frHigh: r1(frHigh),
    frOpen: r1(frOpen)
  };
}

// =============================================================================
// CORE OUTPUT — computeAndWriteRsiDip()
// =============================================================================
function computeAndWriteRsiDip(ss, liveMap, hist) {
  var ws = ss.getSheetByName(RSI_TAB);
  if (!ws) ws = ss.insertSheet(RSI_TAB);
  ws.clearContents();
  ws.clearFormats(); 

  var HDR = ['Symbol','LTP','Days\nStored','RSI-14\n(Daily)','RSI Zone',
             'Day Chg%\n(Intraday)','From High%\n(Intraday)','From Open%',
             'Dip Signal','Volume','Candle'];
  var hRow = ws.getRange(1, 1, 1, HDR.length);
  hRow.setValues([HDR]);
  hRow.setBackground('#1C3A5E').setFontColor('#FFF').setFontWeight('bold').setWrap(true);
  ws.setRowHeight(1, 44);

  var syms = Object.keys(liveMap).sort();
  var data = [];

  for (var i = 0; i < syms.length; i++) {
    var sym  = syms[i];
    var lv   = liveMap[sym];
    var days = hist[sym] ? hist[sym].length : 0;

    var prices = hist[sym]
      ? hist[sym].map(function(h) { return h[1]; }).filter(function(p) { return p > 0; })
      : [];
    var rsi = calcRSI(prices);
    var dip = detectDip(lv);

    data.push([
      sym, lv.ltp, days,
      rsi !== null ? rsi : '—',
      rsiLabel(rsi, prices.length), 
      dip.dayChg, dip.frHigh, dip.frOpen,
      dip.sig, lv.volume, lv.candle || '—'
    ]);
  }

  if (!data.length) return;
  ws.getRange(2, 1, data.length, HDR.length).setValues(data);

  // Enforce explicit number formatting to prevent numeric price/RSI from auto-converting to dates
  ws.getRange(2, 2, data.length, 1).setNumberFormat('#,##0.00'); // Column B: LTP
  ws.getRange(2, 3, data.length, 1).setNumberFormat('0');       // Column C: Days Stored
  ws.getRange(2, 4, data.length, 1).setNumberFormat('0.0');     // Column D: RSI-14
  ws.getRange(2, 6, data.length, 3).setNumberFormat('0.00');    // Columns F, G, H: Day Chg%, From High%, From Open%
  ws.getRange(2, 10, data.length, 1).setNumberFormat('#,##0');  // Column J: Volume

  var rsiBgs     = [];
  var zoneColors = [];
  var zoneBolds  = [];
  var dcColors   = [];
  var dcBolds    = [];
  var dipColors  = [];
  var dipBolds   = [];

  for (var j = 0; j < data.length; j++) {
    var rsi   = data[j][3];
    var zone  = String(data[j][4]);
    var dc    = parseFloat(data[j][5]);
    var dipS  = String(data[j][8]);

    if      (typeof rsi === 'number' && rsi < 25)  rsiBgs.push(['#A5D6A7']);
    else if (typeof rsi === 'number' && rsi < 35)  rsiBgs.push(['#C8E6C9']);
    else if (typeof rsi === 'number' && rsi <= 55) rsiBgs.push(['#F5F5F5']);
    else if (typeof rsi === 'number' && rsi <= 70) rsiBgs.push(['#FFE0B2']);
    else if (typeof rsi === 'number')              rsiBgs.push(['#FFCDD2']);
    else                                           rsiBgs.push(['#FFFFFF']);

    if      (zone.includes('Strong BUY'))         { zoneColors.push(['#1B5E20']); zoneBolds.push(['bold']); }
    else if (zone.includes('Near Oversold'))        { zoneColors.push(['#33691E']); zoneBolds.push(['normal']); }
    else if (zone.includes('Severely Overbought')) { zoneColors.push(['#B71C1C']); zoneBolds.push(['bold']); }
    else if (zone.includes('Overbought'))          { zoneColors.push(['#E65100']); zoneBolds.push(['normal']); }
    else if (zone.includes('Need'))                { zoneColors.push(['#9E9E9E']); zoneBolds.push(['normal']); }
    else                                           { zoneColors.push(['#000000']); zoneBolds.push(['normal']); }

    if      (dc <= -3.0) { dcColors.push(['#B71C1C']); dcBolds.push(['bold']); }
    else if (dc <= -1.5) { dcColors.push(['#E65100']); dcBolds.push(['bold']); }
    else if (dc >= 2.0)  { dcColors.push(['#1B5E20']); dcBolds.push(['bold']); }
    else if (dc >= 1.0)  { dcColors.push(['#388E3C']); dcBolds.push(['normal']); }
    else                 { dcColors.push(['#000000']); dcBolds.push(['normal']); }

    if      (dipS.includes('Sharp'))    { dipColors.push(['#B71C1C']); dipBolds.push(['bold']); }
    else if (dipS.includes('Mild'))     { dipColors.push(['#E65100']); dipBolds.push(['bold']); }
    else if (dipS.includes('Pullback')) { dipColors.push(['#F57F17']); dipBolds.push(['normal']); }
    else                                { dipColors.push(['#000000']); dipBolds.push(['normal']); }
  }

  ws.getRange(2, 4, data.length, 1).setBackgrounds(rsiBgs);
  ws.getRange(2, 5, data.length, 1).setFontColors(zoneColors).setFontWeights(zoneBolds);
  ws.getRange(2, 6, data.length, 1).setFontColors(dcColors).setFontWeights(dcBolds);
  ws.getRange(2, 9, data.length, 1).setFontColors(dipColors).setFontWeights(dipBolds);

  ws.setFrozenRows(1);
  [80,70,65,75,210,85,90,80,230,90,120].forEach(function(w, i) { ws.setColumnWidth(i + 1, w); });
  ws.getRange(1, 5, data.length + 1, 1).setWrap(true);
  ws.getRange(1, 9, data.length + 1, 1).setWrap(true);
  _stamp(ws, data.length + 3);
}

// =============================================================================
// getRsiDipData
// =============================================================================
function getRsiDipData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(RSI_TAB);
  if (!ws) return {};
  var rows = ws.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < rows.length; i++) {
    var sym = String(rows[i][0] || '').trim().toUpperCase();
    if (!sym || sym === 'UPDATED:') continue;
    var rsiRaw = parseFloat(rows[i][3]);
    map[sym] = {
      rsi:     isNaN(rsiRaw) ? null : rsiRaw,
      rsiZone: String(rows[i][4] || '').trim(),
      dayChg:  parseFloat(rows[i][5]) || 0,
      frHigh:  parseFloat(rows[i][6]) || 0,
      frOpen:  parseFloat(rows[i][7]) || 0,
      dipSig:  String(rows[i][8] || '').trim(),
      days:    parseInt(rows[i][2])    || 0
    };
  }
  return map;
}

// =============================================================================
// runWatchlistScreener
// =============================================================================
function runWatchlistScreener() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var rsiMap = getRsiDipData();

  var heldSet = {};
  var yWs = ss.getSheetByName('yogen');
  if (yWs) {
    var yRows = yWs.getDataRange().getValues();
    var YOGEN_HEADER_ROW = 4;
    for (var j = YOGEN_HEADER_ROW + 1; j < yRows.length; j++) {
      var s = String(yRows[j][0] || '').trim().toUpperCase();
      if (s && s !== 'SYMBOL') heldSet[s] = true;
    }
  }

  var pickSet = {};
  var vpWs = ss.getSheetByName('💎 Value Picks');
  if (vpWs) {
    var vpRows = vpWs.getDataRange().getValues();
    for (var k = 1; k < vpRows.length; k++) {
      var ps = String(vpRows[k][0] || '').trim().toUpperCase();
      if (ps) pickSet[ps] = true;
    }
  }

  var allWatch = {};
  Object.keys(heldSet).forEach(function(s) { allWatch[s] = true; });
  Object.keys(pickSet).forEach(function(s) { allWatch[s] = true; });

  var hits = [];
  Object.keys(allWatch).forEach(function(sym) {
    var d = rsiMap[sym];
    if (!d) return;
    var rsiHit = d.rsi !== null && d.rsi < 40;
    var dipHit = d.dayChg <= -1.5;
    if (!rsiHit && !dipHit) return;
    hits.push({
      sym: sym, held: heldSet[sym] ? '✓' : '', pick: pickSet[sym] ? '✓' : '',
      rsi: d.rsi, zone: d.rsiZone, dayChg: d.dayChg, frHigh: d.frHigh,
      dipSig: d.dipSig, days: d.days, rsiHit: rsiHit, dipHit: dipHit
    });
  });

  hits.sort(function(a, b) {
    var ra = a.rsi !== null ? a.rsi : 999;
    var rb = b.rsi !== null ? b.rsi : 999;
    if (ra !== rb) return ra - rb;
    return a.dayChg - b.dayChg;
  });

  var ws = ss.getSheetByName(WATCH_TAB);
  if (!ws) ws = ss.insertSheet(WATCH_TAB);
  ws.clearContents();
  ws.clearFormats(); 

  var HDR = ['Symbol','Held','Value Pick','RSI-14\n(Daily)','RSI Zone','Day Chg%','From High%','Dip Signal','Days of\nData'];
  var hRow = ws.getRange(1, 1, 1, HDR.length);
  hRow.setValues([HDR]);
  hRow.setBackground('#4A148C').setFontColor('#FFF').setFontWeight('bold').setWrap(true);
  ws.setRowHeight(1, 44);

  if (!hits.length) {
    ws.getRange(2, 1).setValue('No watchlist stocks in buy/dip zone right now.');
    try {
      SpreadsheetApp.getUi().alert('🎯 Screener done.\nNo watchlist stocks in dip/oversold zone.');
    } catch (e) {
      Logger.log('🎯 Screener done. No watchlist stocks in dip/oversold zone.');
    }
    return;
  }

  var data = hits.map(function(h) {
    return [h.sym, h.held, h.pick, h.rsi !== null ? h.rsi : '—', h.zone,
            h.dayChg, h.frHigh, h.dipSig, h.days];
  });
  ws.getRange(2, 1, data.length, HDR.length).setValues(data);

  var rowBgs   = [];
  var rsiColors = [];
  var rsiWeights = [];
  var dcColors  = [];
  var dcWeights = [];

  for (var i = 0; i < hits.length; i++) {
    var rsi = hits[i].rsi;
    var dc  = hits[i].dayChg;

    if      (rsi !== null && rsi < 25) { rowBgs.push(Array(HDR.length).fill('#E8F5E9')); rsiColors.push(['#1B5E20']); rsiWeights.push(['bold']); }
    else if (rsi !== null && rsi < 35) { rowBgs.push(Array(HDR.length).fill('#F1F8E9')); rsiColors.push(['#33691E']); rsiWeights.push(['normal']); }
    else if (hits[i].dipHit)           { rowBgs.push(Array(HDR.length).fill('#FFF8E1')); rsiColors.push(['#000000']); rsiWeights.push(['normal']); }
    else                               { rowBgs.push(Array(HDR.length).fill('#FAFAFA')); rsiColors.push(['#000000']); rsiWeights.push(['normal']); }

    if      (dc <= -3.0) { dcColors.push(['#B71C1C']); dcWeights.push(['bold']); }
    else if (dc <= -1.5) { dcColors.push(['#E65100']); dcWeights.push(['bold']); }
    else                 { dcColors.push(['#000000']); dcWeights.push(['normal']); }
  }

  ws.getRange(2, 1, data.length, HDR.length).setBackgrounds(rowBgs);
  ws.getRange(2, 4, data.length, 1).setFontColors(rsiColors).setFontWeights(rsiWeights);
  ws.getRange(2, 6, data.length, 1).setFontColors(dcColors).setFontWeights(dcWeights);

  ws.setFrozenRows(1);
  [80,55,75,75,210,80,90,230,70].forEach(function(w, i) { ws.setColumnWidth(i + 1, w); });
  ws.getRange(1, 5, data.length + 1, 1).setWrap(true);
  ws.getRange(1, 8, data.length + 1, 1).setWrap(true);
  _stamp(ws, hits.length + 3);

  try {
    SpreadsheetApp.getUi().alert('🎯 Watchlist Screener done!\n' + hits.length + ' stocks found.');
  } catch (e) {
    Logger.log('🎯 Watchlist Screener done! ' + hits.length + ' stocks found.');
  }
}

// =============================================================================
// TRIGGER MANAGEMENT
// =============================================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) {
      return ['runAll','runSignalEngine','storeDailyClose','refreshIntradayDip','storePriceSnapshot']
        .indexOf(t.getHandlerFunction()) >= 0;
    })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('storeDailyClose')
    .timeBased()
    .atHour(15)
    .nearMinute(2)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('runAll')
    .timeBased()
    .everyMinutes(10)
    .create();

  try {
    SpreadsheetApp.getUi().alert('✅ Two triggers synchronized.\n• storeDailyClose → ~3:02 PM daily\n• runAll → every 10 minutes');
  } catch (e) {
    Logger.log('✅ Two triggers synchronized: storeDailyClose (~3:02 PM) and runAll (every 10m)');
  }
}

function removeTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) {
      return ['runAll','runSignalEngine','storeDailyClose','refreshIntradayDip','storePriceSnapshot']
        .indexOf(t.getHandlerFunction()) >= 0;
    })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });
  try {
    SpreadsheetApp.getUi().alert('⏹️ All triggers removed.');
  } catch (e) {
    Logger.log('⏹️ All triggers removed.');
  }
}

function clearDailyHistory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(DAILY_TAB);
  if (ws) {
    ws.clearContents();
    var headers = ['Symbol','Date','Open','High','Low','Close','Volume','Point Change','Change %','Prev Close','Candle'];
    ws.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  try {
    SpreadsheetApp.getUi().alert('🗑️ Daily history wiped and header restored.');
  } catch (e) {
    Logger.log('🗑️ Daily history wiped and header restored.');
  }
}

// =============================================================================
// UTILITIES
// =============================================================================
function r1(n) { return Math.round(n * 10) / 10; }

function parsePrice(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val instanceof Date) {
    // If Google Sheets auto-formatted a numeric price (e.g. 333.80) to date serial
    var epoch = new Date(1899, 11, 30, 0, 0, 0);
    var serial = (val.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24);
    return isNaN(serial) ? 0 : Math.round(serial * 100) / 100;
  }
  var parsed = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(parsed) ? 0 : parsed;
}

function _stamp(ws, row) {
  ws.getRange(row, 1).setValue('Updated:');
  var timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kathmandu', 'dd/MM/yyyy HH:mm:ss');
  ws.getRange(row, 2).setValue(timeStr).setNumberFormat('@');
  ws.getRange(row, 1, 1, 3).setFontColor('#9E9E9E').setFontStyle('italic');
}

function _log(ss, fn, msg) {
  var ws = ss.getSheetByName('DebugLog');
  if (!ws) {
    ws = ss.insertSheet('DebugLog');
    ws.appendRow(['Timestamp', 'Function', 'Message']);
    ws.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#263238').setFontColor('#fff');
  }
  ws.appendRow([new Date(), fn, msg]);
}