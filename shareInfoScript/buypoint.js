function analyzeBuyTpSl() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PriceHistory');
  var data = sheet.getDataRange().getValues();

  // Find the header row containing 'closingPrice'
  var headerRowIdx = -1;
  var closeIdx = -1;
  for (var i = 0; i < data.length; i++) {
    closeIdx = data[i].indexOf('closingPrice');
    if (closeIdx !== -1) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) throw new Error("No 'closingPrice' column found in any rowsssss.");
  // Prepare output columns
  var afterColunm = 7
  var maCol = closeIdx + (afterColunm + 1);
  var stdCol = closeIdx + (afterColunm + 2);
  var signalCol = closeIdx + (afterColunm + 3);
  var buyCol = closeIdx + (afterColunm + 4);
  var tpCol = closeIdx + (afterColunm + 5);
  var slCol = closeIdx + (afterColunm + 6);

  // Set headers for new columns
  sheet.getRange(headerRowIdx + 1, maCol + 1).setValue('MA_20');
  sheet.getRange(headerRowIdx + 1, stdCol + 1).setValue('STD_20');
  sheet.getRange(headerRowIdx + 1, signalCol + 1).setValue('Signal');
  sheet.getRange(headerRowIdx + 1, buyCol + 1).setValue('Buy_Price');
  sheet.getRange(headerRowIdx + 1, tpCol + 1).setValue('Take_Profit');
  sheet.getRange(headerRowIdx + 1, slCol + 1).setValue('Stop_Loss');

  // Loop through data, starting after the header row
  for (var i = headerRowIdx + 20; i < data.length; i++) {
    var closes = [];
    for (var j = i - 19; j <= i; j++) {
      var val = Number(data[j][closeIdx]);
      if (!isNaN(val)) closes.push(val);
    }
    if (closes.length < 20) continue;

    var ma = average(closes);
    var std = stdev(closes);
    var close = Number(data[i][closeIdx]);
    var signal = '';
    var buyPrice = '';
    var tp = '';
    var sl = '';

    if (close < (ma - std)) {
      signal = 'BUY';
      buyPrice = close;
      tp = (buyPrice * 1.12).toFixed(2); // 12% above buy
      sl = (buyPrice * 0.93).toFixed(2); // 7% below buy
    }

    // Write results to sheet
    sheet.getRange(i + 1, maCol + 1).setValue(ma);
    sheet.getRange(i + 1, stdCol + 1).setValue(std);
    sheet.getRange(i + 1, signalCol + 1).setValue(signal);
    sheet.getRange(i + 1, buyCol + 1).setValue(buyPrice);
    sheet.getRange(i + 1, tpCol + 1).setValue(tp);
    sheet.getRange(i + 1, slCol + 1).setValue(sl);
  }
}

// Helper functions
function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function stdev(arr) {
  var m = average(arr);
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
}


