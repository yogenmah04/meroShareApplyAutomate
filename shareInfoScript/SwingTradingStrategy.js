function generateSignals() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Debugging setup
  const debugLog = [];
  debugLog.push("Script started at: " + new Date());
  
  try {
    const priceHistorySheet = ss.getSheetByName("PriceHistory");
    if (!priceHistorySheet) throw new Error("❌ PriceHistory sheet not found");
    debugLog.push("✓ PriceHistory sheet found");

    // Create Signals sheet if not exists
    let signalSheet = ss.getSheetByName("Signals");
    if (!signalSheet) {
      debugLog.push("Creating new Signals sheet");
      signalSheet = ss.insertSheet("Signals");
      signalSheet.getRange("A1:I1").setValues([["Date", "Type", "Price", "StopLoss", "Reason", "RSI", "SMA20", "SMA50", "DaysHeld"]]);
      signalSheet.getRange("A1:I1").setFontWeight("bold");
    } else {
      debugLog.push("✓ Signals sheet found");
    }

    // Get raw data (starting from row 10)
    const lastRow = priceHistorySheet.getLastRow();
    debugLog.push("Last row in PriceHistory: " + lastRow);
    
    if (lastRow < 10) throw new Error("❌ No data below row 10");
    
    const rawData = priceHistorySheet.getRange("B10:K" + lastRow).getValues();
    debugLog.push("Raw data rows: " + rawData.length);
    
    if (rawData.length === 0) throw new Error("❌ No data retrieved from PriceHistory");

    // Process data
    const processedData = [];
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      processedData.push({
        date: row[0],
        high: row[1],
        low: row[2],
        close: row[3],
        volume: row[5]
      });
    }
    
    // Reverse to chronological order (oldest first)
    const data = processedData.reverse();
    debugLog.push("Processed data points: " + data.length);

    // Strategy Parameters
    const RSI_PERIOD = 14;
    const SMA20_PERIOD = 20;
    const SMA50_PERIOD = 50;
    const OVERSOLD = 35;
    const MAX_HOLD = 10;
    const SUPPORT_BUFFER = 0.008;

    // Calculate indicators
    const indicators = calculateIndicators(data, SMA20_PERIOD, SMA50_PERIOD, RSI_PERIOD);
    debugLog.push("Indicators calculated");
    debugLog.push(`SMA20 samples: ${indicators.sma20.filter(v => v !== undefined).length}`);
    debugLog.push(`SMA50 samples: ${indicators.sma50.filter(v => v !== undefined).length}`);
    debugLog.push(`RSI samples: ${indicators.rsi.filter(v => v !== undefined).length}`);

    // Generate signals
    const signals = [];
    let activeTrade = null;
    let signalCount = 0;
    
    const startIndex = Math.max(SMA50_PERIOD, RSI_PERIOD);
    debugLog.push("Starting signal generation from index: " + startIndex);
    
    for (let i = startIndex; i < data.length; i++) {
      const current = data[i];
      
      // BUY Signal Conditions
      const isOversold = Array.from({length: 5}, (_, j) => indicators.rsi[i - j])
        .some(val => val < OVERSOLD);
      
      const rsiCrossUp = indicators.rsi[i] > 50 && indicators.rsi[i - 1] <= 50;
      const supportBounce = current.low <= indicators.sma20[i] * (1 + SUPPORT_BUFFER) && 
                            current.close > indicators.sma20[i];
      const uptrend = current.close > indicators.sma50[i];
      
      // Generate BUY signal
      if (rsiCrossUp && supportBounce && uptrend && isOversold) {
        const stopLoss = Math.min(...data.slice(i - 4, i + 1).map(d => d.low));
        
        signals.push({
          date: current.date,
          type: "BUY",
          price: current.close,
          stopLoss: stopLoss,
          reason: "",
          rsi: indicators.rsi[i],
          sma20: indicators.sma20[i],
          sma50: indicators.sma50[i],
          daysHeld: ""
        });
        
        activeTrade = { entryIndex: i, stopLoss: stopLoss };
        signalCount++;
        debugLog.push(`BUY signal at ${current.date}: Close=${current.close}, RSI=${indicators.rsi[i].toFixed(2)}`);
      }
      
      // Exit conditions
      if (activeTrade && i > activeTrade.entryIndex) {
        const daysHeld = i - activeTrade.entryIndex;
        let exitSignal = null;
        
        if (current.low <= activeTrade.stopLoss) {
          exitSignal = { reason: "Stop-loss", price: activeTrade.stopLoss };
        } else if (indicators.rsi[i] < 50 && indicators.rsi[i - 1] >= 50) {
          exitSignal = { reason: "RSI Exit", price: current.close };
        } else if (daysHeld >= MAX_HOLD) {
          exitSignal = { reason: "Max Hold Period", price: current.close };
        }
        
        if (exitSignal) {
          signals.push({
            date: current.date,
            type: "SELL",
            price: exitSignal.price,
            stopLoss: "",
            reason: exitSignal.reason,
            rsi: indicators.rsi[i],
            sma20: indicators.sma20[i],
            sma50: indicators.sma50[i],
            daysHeld: daysHeld
          });
          activeTrade = null;
          signalCount++;
          debugLog.push(`SELL signal at ${current.date}: ${exitSignal.reason}`);
        }
      }
    }
    
    // Write signals to sheet
    if (signals.length > 0) {
      const output = signals.map(s => [
        s.date,
        s.type,
        s.price,
        s.stopLoss,
        s.reason,
        s.rsi ? s.rsi.toFixed(2) : "",
        s.sma20 ? s.sma20.toFixed(2) : "",
        s.sma50 ? s.sma50.toFixed(2) : "",
        s.daysHeld
      ]);
      
      signalSheet.getRange(2, 1, output.length, output[0].length).setValues(output);
      debugLog.push(`Generated ${signals.length} signals`);
    } else {
      debugLog.push("⚠️ No trading signals generated");
    }
    
  } catch (e) {
    debugLog.push("❌ ERROR: " + e.message);
  }
  
  // Display debug info
  const debugMessage = debugLog.join("\n");
  Logger.log(debugMessage);
  
  // Create debug sheet
  let debugSheet = ss.getSheetByName("DebugLog");
  if (!debugSheet) debugSheet = ss.insertSheet("DebugLog");
  debugSheet.clear();
  debugSheet.getRange(1, 1, debugLog.length, 1).setValues(debugLog.map(log => [log]));
  
  // UI alert
  // const ui = SpreadsheetApp.getUi();
  // ui.alert(
  //   "Signal Generation Complete",
  //   `${signalCount} signals generated\nCheck DebugLog for details`,
  //   ui.ButtonSet.OK
  // );
}

function calculateIndicators(data, sma20Period, sma50Period, rsiPeriod) {
  const sma20 = [];
  const sma50 = [];
  const rsi = new Array(data.length).fill(null);
  
  // Calculate SMAs
  for (let i = 0; i < data.length; i++) {
    // SMA20
    if (i >= sma20Period - 1) {
      const sum20 = data.slice(i - sma20Period + 1, i + 1)
        .reduce((sum, item) => sum + item.close, 0);
      sma20[i] = sum20 / sma20Period;
    }
    
    // SMA50
    if (i >= sma50Period - 1) {
      const sum50 = data.slice(i - sma50Period + 1, i + 1)
        .reduce((sum, item) => sum + item.close, 0);
      sma50[i] = sum50 / sma50Period;
    }
  }
  
  // Calculate RSI
  let avgGain = 0;
  let avgLoss = 0;
  
  // Initial RSI calculation
  for (let i = 1; i <= rsiPeriod; i++) {
    const change = data[i].close - data[i-1].close;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  
  avgGain /= rsiPeriod;
  avgLoss /= rsiPeriod;
  
  // Calculate subsequent RSI values
  for (let i = rsiPeriod + 1; i < data.length; i++) {
    const change = data[i].close - data[i-1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
    avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - (100 / (1 + rs));
  }
  
  return { sma20, sma50, rsi };
}

// function onOpen() {
//   SpreadsheetApp.getUi().createMenu('📈 Swing Trader')
//     .addItem('Generate Signals', 'generateSignals')
//     .addItem('View Debug Log', 'showDebugLog')
//     .addToUi();
// }

function showDebugLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const debugSheet = ss.getSheetByName("DebugLog");
  
  if (debugSheet) {
    ss.setActiveSheet(debugSheet);
  } else {
    try {
      SpreadsheetApp.getUi().alert("DebugLog not found");
    } catch (e) {
      Logger.log("DebugLog not found");
    }
  }
}