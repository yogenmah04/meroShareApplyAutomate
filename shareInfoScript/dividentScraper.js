function importNabilDividends() {
  var url = "https://hamroshare.com.np/company/NABIL/dividends";
  
  try {
    // Fetch the HTML content of the page
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var html = response.getContentText();
    console.log(html)
    
    // Extract table rows using regular expressions for lightweight parsing
    var rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
    var cellRegex = /<t[dh]>([\s\S]*?)<\/t[dh]>/g;
    
    var rows = [];
    var matchRow;
    
    while ((matchRow = rowRegex.exec(html)) !== null) {
      var rowHtml = matchRow[1];
      var cells = [];
      var matchCell;
      
      while ((matchCell = cellRegex.exec(rowHtml)) !== null) {
        // Strip HTML tags and clean whitespace
        var cellText = matchCell[1].replace(/<[^>]*>/g, "").trim();
        // Decode common HTML entities if present
        cellText = cellText.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    console.log(rows)
    return
    
    if (rows.length === 0) {
      Logger.log("No table data found. The site structure might require a headless browser.");
      return;
    }
    
    // Write data to the active Google Sheet tab
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear(); // Clear existing content
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    
    try {
      SpreadsheetApp.getUi().alert("Dividend history successfully imported!");
    } catch (e) {
      Logger.log("Dividend history successfully imported!");
    }
    
  } catch (error) {
    Logger.log("Error fetching data: " + error.toString());
  }
}