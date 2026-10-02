function findSymbolsNearPoints() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet with resistance and support
  const pointsSheet = ss.getSheetByName("resistance and support");
  const pointsData = pointsSheet.getRange(2, 1, pointsSheet.getLastRow() - 1, 2).getValues();
  // Col A = Symbol, Col B = Points {603,627,698,737}
  
  // Sheet with live market data
  const marketSheet = ss.getSheetByName("live trading");
  const marketData = marketSheet.getRange(2, 2, marketSheet.getLastRow() - 1, 2).getValues();
  // Col B = Symbol, Col C = LTP
  
  let result = [];
  let seenSymbols = new Set();
  
  pointsData.forEach(([symbol, pointsString]) => {
    if (!symbol || !pointsString) return;
    
    // Extract numeric points from "{603,627,698,737}"
    let points = pointsString.replace(/[{} ]/g, '').split(',').map(Number);
    if (points.length < 2) return;
    
    let firstPoint = points[0];
    let lastPoint = points[points.length - 1];
    
    // Find LTP for this symbol in market data
    let marketRow = marketData.find(([mSymbol]) => mSymbol === symbol);
    if (!marketRow) return;
    
    let ltp = parseFloat(marketRow[1]);
    if (isNaN(ltp)) return;
    
    // Check if near or crossed first/last point
    let threshold = 5; // adjust closeness range
    if (Math.abs(ltp - firstPoint) <= threshold || Math.abs(ltp - lastPoint) <= threshold ||
        (ltp >= firstPoint && ltp <= lastPoint) || (ltp <= firstPoint && ltp >= lastPoint)) {
      if (!seenSymbols.has(symbol)) {
        result.push([symbol, ltp, firstPoint, lastPoint]);
        seenSymbols.add(symbol);
      }
    }
  });
  
  // Output results to a new sheet
  let outSheet = ss.getSheetByName("NearPoints") || ss.insertSheet("NearPoints");
  outSheet.clear();
  outSheet.appendRow(["Symbol", "LTP", "First Point", "Last Point"]);
  
  if (result.length > 0) {
    outSheet.getRange(2, 1, result.length, result[0].length).setValues(result);
  }
}
