function swingBuyToday() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const startRow = 10;
  const lastRow = sheet.getLastRow();

  if (lastRow < startRow + 1) return; // Not enough data

  const data = sheet.getRange(`A${startRow}:K${lastRow}`).getValues();
  const i = data.length - 2; // Second last row index

  const close = parseFloat(data[i][4]);     // Column E: Closing Price
  const prevClose = parseFloat(data[i][8]); // Column I: Prev Close
  const volume = parseFloat(data[i][6]);    // Column G: Volume

  const avgVol = i >= 20
    ? average(data.slice(i - 20, i).map(r => parseFloat(r[6])))
    : null;

  const rsi = i >= 14 ? calculateRSI(data, i, 14) : null;

  const support = i >= 20
    ? Math.min(...data.slice(i - 20, i).map(r => parseFloat(r[4])))
    : null;

  let buyToday = '';
  let sl = '';
  let tp = '';

  if (
    avgVol && rsi && support &&
    close > prevClose &&
    rsi < 40 &&
    volume > avgVol * 1.2 &&
    close <= support * 1.03
  ) {
    buyToday = "✅ BUY TODAY";
    sl = Math.round(close * 0.96 * 100) / 100;
    tp = Math.round(close * 1.08 * 100) / 100;
  }

  const outputRow = startRow + i + 1;
  sheet.getRange(`L${outputRow}`).setValue(avgVol || '');
  sheet.getRange(`M${outputRow}`).setValue(rsi || '');
  sheet.getRange(`N${outputRow}`).setValue(support || '');
  sheet.getRange(`O${outputRow}`).setValue(sl);
  sheet.getRange(`P${outputRow}`).setValue(tp);
  sheet.getRange(`Q${outputRow}`).setValue(buyToday);
}

function average(arr) {
  const sum = arr.reduce((a, b) => a + (b || 0), 0);
  return arr.length ? sum / arr.length : null;
}

function calculateRSI(data, index, period) {
  let gain = 0, loss = 0;
  for (let j = index - period + 1; j <= index; j++) {
    const change = parseFloat(data[j][4]) - parseFloat(data[j - 1][4]);
    if (change > 0) gain += change;
    else loss -= change;
  }
  const rs = gain / (loss || 1);
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}
