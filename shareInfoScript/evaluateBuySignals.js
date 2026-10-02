function evaluateBuySignals() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PriceHistory');
  var data = sheet.getDataRange().getValues();
  
  // Find header row and column indices
  var headerRowIdx = -1;
  var dateIdx = -1, closeIdx = -1, signalIdx = -1, tpIdx = -1, slIdx = -1, resultIdx = -1;
  
  for (var i = 0; i < data.length; i++) {
    dateIdx = data[i].indexOf('tradeDateString');
    closeIdx = data[i].indexOf('closingPrice');
    signalIdx = data[i].indexOf('Signal');
    tpIdx = data[i].indexOf('Take_Profit');
    slIdx = data[i].indexOf('Stop_Loss');
    resultIdx = data[i].indexOf('Result');
    
    if (dateIdx !== -1 && closeIdx !== -1 && signalIdx !== -1 && tpIdx !== -1 && slIdx !== -1) {
      headerRowIdx = i;
      break;
    }
  }
  
  if (headerRowIdx === -1) throw new Error("Required columns not found.");

  // Determine Result column: use existing or create new without shifting
  if (resultIdx === -1) {
    resultIdx = Math.max(dateIdx, closeIdx, signalIdx, tpIdx, slIdx) + 1;
    sheet.getRange(headerRowIdx + 1, resultIdx + 1).setValue('Result');
  } else {
    resultIdx = resultIdx; // Use existing Result column
  }

  // Clear existing data in Result column from row 10 to last row
  var lastRow = sheet.getLastRow();
  if (lastRow >= 10) {
    sheet.getRange(10, resultIdx + 1, lastRow - 9, 1).clearContent();
  }

  // Loop through data to find BUY signals
  for (var i = headerRowIdx + 1; i < data.length; i++) {
    if (data[i][signalIdx] === 'BUY') {
      var buyDate = new Date(data[i][dateIdx]);
      var tp = parseFloat(data[i][tpIdx]);
      var sl = parseFloat(data[i][slIdx]);
      var result = 'OPEN';
      
      // Look ahead in the data
      for (var j = i + 1; j < data.length; j++) {
        var currentDate = new Date(data[j][dateIdx]);
        if (currentDate <= buyDate) continue;
        
        var nextClose = parseFloat(data[j][closeIdx]);
        if (isNaN(nextClose)) continue;
        
        if (nextClose >= tp) {
          result = 'SUCCESS';
          break;
        }
        if (nextClose <= sl) {
          result = 'FAIL';
          break;
        }
      }
      sheet.getRange(i + 1, resultIdx + 1).setValue(result);
    }
  }
}