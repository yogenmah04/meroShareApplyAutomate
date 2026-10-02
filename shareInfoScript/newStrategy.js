function generateSignalsNew() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // Get the PriceHistory sheet (data source)
    const priceHistorySheet = ss.getSheetByName("PriceHistory");
    if (!priceHistorySheet) throw new Error("PriceHistory sheet not found");
    
    // Get or create the Signals sheet (output)
    let signalSheet = ss.getSheetByName("Signals");
    if (!signalSheet) {
      signalSheet = ss.insertSheet("Signals");
      signalSheet.getRange("A1:J1").setValues([
        ["Date", "Type", "Price", "StopLoss", "TakeProfit", "Reason", "RSI", "SMA20", "SMA50", "DaysHeld"]
      ]);
      signalSheet.getRange("A1:J1").setFontWeight("bold");
    } else {
      // Clear previous signals if any
      if (signalSheet.getLastRow() > 1) {
        signalSheet.getRange("A2:J" + signalSheet.getLastRow()).clearContent();
      }
    }
    
    // Get raw data starting from row 10 (headers at row 9)
    const lastRow = priceHistorySheet.getLastRow();
    const rawData = priceHistorySheet.getRange("B10:K" + lastRow).getValues();
    
    // Process data (convert to chronological order - oldest first)
    const data = rawData.reverse().map(row => ({
      date: row[0],    // tradeDateString (B)
      high: row[1],    // maxPrice (C)
      low: row[2],     // minPrice (D)
      close: row[3],   // closingPrice (E)
      volume: row[5]   // volume (G)
    }));
    
    // Strategy Parameters
    const RSI_PERIOD = 14;
    const SMA20_PERIOD = 20;
    const SMA50_PERIOD = 50;
    const OVERSOLD = 35;
    const MAX_HOLD = 10;
    const SUPPORT_BUFFER = 0.008;  // 0.8% buffer
    const RISK_REWARD_RATIO = 2;   // 1:2 risk-reward
    
    // Calculate indicators
    const { sma20, sma50, rsi } = calculateIndicators(data, SMA20_PERIOD, SMA50_PERIOD, RSI_PERIOD);
    
    // Generate trading signals
    const signals = [];
    let activeTrade = null;
    
    // Start from the point where all indicators are available
    const startIndex = Math.max(SMA50_PERIOD, RSI_PERIOD);
    
    for (let i = startIndex; i < data.length; i++) {
      const current = data[i];
      
      // BUY Signal Conditions
      const isOversold = Array.from({length: 5}, (_, j) => rsi[i - j]).some(val => val < OVERSOLD);
      const rsiCrossUp = rsi[i] > 50 && rsi[i - 1] <= 50;
      const supportBounce = current.low <= sma20[i] * (1 + SUPPORT_BUFFER) && current.close > sma20[i];
      const uptrend = current.close > sma50[i];
      
      // Generate BUY signal if all conditions met
      if (isOversold && rsiCrossUp && supportBounce && uptrend) {
        const stopLoss = Math.min(...data.slice(i - 4, i + 1).map(d => d.low));
        const takeProfit = current.close + (current.close - stopLoss) * RISK_REWARD_RATIO;
        
        signals.push({
          date: current.date,
          type: "BUY",
          price: current.close,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          reason: "",
          rsi: rsi[i],
          sma20: sma20[i],
          sma50: sma50[i],
          daysHeld: ""
        });
        
        activeTrade = {
          entryIndex: i,
          stopLoss: stopLoss,
          takeProfit: takeProfit
        };
      }
      
      // Exit conditions (if in active trade)
      if (activeTrade && i > activeTrade.entryIndex) {
        const daysHeld = i - activeTrade.entryIndex;
        let exitSignal = null;
        
        // Stop-loss hit
        if (current.low <= activeTrade.stopLoss) {
          exitSignal = { reason: "Stop-loss", price: activeTrade.stopLoss };
        } 
        // Take-profit hit
        else if (current.high >= activeTrade.takeProfit) {
          exitSignal = { reason: "Take-profit", price: activeTrade.takeProfit };
        }
        // RSI exit
        else if (rsi[i] < 50 && rsi[i - 1] >= 50) {
          exitSignal = { reason: "RSI Exit", price: current.close };
        }
        // Max holding period
        else if (daysHeld >= MAX_HOLD) {
          exitSignal = { reason: "Max Hold Period", price: current.close };
        }
        
        // Process exit if any condition met
        if (exitSignal) {
          signals.push({
            date: current.date,
            type: "SELL",
            price: exitSignal.price,
            stopLoss: "",
            takeProfit: "",
            reason: exitSignal.reason,
            rsi: rsi[i],
            sma20: sma20[i],
            sma50: sma50[i],
            daysHeld: daysHeld
          });
          activeTrade = null;
        }
      }
    }
    
    // Write signals to sheet
    if (signals.length > 0) {
      const output = signals.map(s => [
        s.date,
        s.type,
        s.price,
        s.type === "BUY" ? s.stopLoss : "",
        s.type === "BUY" ? s.takeProfit : "",
        s.reason,
        s.rsi ? s.rsi.toFixed(2) : "",
        s.sma20 ? s.sma20.toFixed(2) : "",
        s.sma50 ? s.sma50.toFixed(2) : "",
        s.daysHeld
      ]);
      
      signalSheet.getRange(2, 1, output.length, output[0].length).setValues(output);
      
      // Format the output
      signalSheet.autoResizeColumns(1, 10);
      signalSheet.setFrozenRows(1);
      
      // Show completion message
      try {
        var ui = SpreadsheetApp.getUi();
        ui.alert(
          "Signal Generation Complete",
          `Generated ${signals.length} trading signals`,
          ui.ButtonSet.OK
        );
      } catch (err) {
        Logger.log(`Signal Generation Complete: Generated ${signals.length} trading signals`);
      }
    } else {
      try {
        var ui = SpreadsheetApp.getUi();
        ui.alert(
          "No Signals Generated",
          "No trading signals met the criteria with this data",
          ui.ButtonSet.OK
        );
      } catch (err) {
        Logger.log("No trading signals met the criteria with this data");
      }
    }
    
  } catch (e) {
    try {
      var ui = SpreadsheetApp.getUi();
      ui.alert(
        "Error Generating Signals",
        e.message,
        ui.ButtonSet.OK
      );
    } catch (err) {
      Logger.log("Error Generating Signals: " + e.message);
    }
  }
}

function calculateIndicators(data, sma20Period, sma50Period, rsiPeriod) {
  const sma20 = [];
  const sma50 = [];
  const rsi = new Array(data.length).fill(null);
  
  // Calculate SMAs
  for (let i = 0; i < data.length; i++) {
    // SMA20
    if (i >= sma20Period - 1) {
      sma20[i] = data.slice(i - sma20Period + 1, i + 1)
        .reduce((sum, item) => sum + item.close, 0) / sma20Period;
    }
    
    // SMA50
    if (i >= sma50Period - 1) {
      sma50[i] = data.slice(i - sma50Period + 1, i + 1)
        .reduce((sum, item) => sum + item.close, 0) / sma50Period;
    }
  }
  
  // Calculate RSI
  let avgGain = 0;
  let avgLoss = 0;
  
  // Initial RSI calculation
  for (let i = 1; i <= rsiPeriod; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  
  avgGain /= rsiPeriod;
  avgLoss /= rsiPeriod;
  
  // Calculate subsequent RSI values
  for (let i = rsiPeriod + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
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
//   SpreadsheetApp.getUi().createMenu('📈 NEPSE Trader')
//     .addItem('Generate Signals', 'generateSignals')
//     .addToUi();
// }