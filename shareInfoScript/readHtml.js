function readListSecurities() {
  var fileName = "listSecurities"; // Change to your HTML file name (without .html extension)
  var htmlContent = HtmlService.createHtmlOutputFromFile(fileName).getContent();
   var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("listSecuritiesData");
  
 // Extract table rows using regex
  var tableMatch = htmlContent.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    Logger.log("No table found!");
    return;
  }
  
  var tableContent = tableMatch[1];
  var rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  
  var data = [];
  var maxColumns = 0;

  rows.forEach(row => {
    var cols = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (cols) {
      var rowData = cols.map(col => col.replace(/<[^>]*>/g, "").trim()); // Remove HTML tags
      data.push(rowData);
      maxColumns = Math.max(maxColumns, rowData.length); // Track max column count
    }
  });

  // Normalize all rows to have the same column count by filling missing cells
  data = data.map(row => row.concat(Array(maxColumns - row.length).fill("")));

  // Insert data into Google Sheet starting from cell A1
  sheet.getRange(1, 1, data.length, maxColumns).setValues(data);
}


function readFundament() {
  var fileName = "fundamental"; // Change to your HTML file name (without .html extension)
  var htmlContent = HtmlService.createHtmlOutputFromFile(fileName).getContent();
   var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("fundamentalData");
  
 // Extract table rows using regex
  var tableMatch = htmlContent.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    Logger.log("No table found!");
    return;
  }
  
  var tableContent = tableMatch[1];
  var rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  
  var data = [];
  var maxColumns = 0;

  rows.forEach(row => {
    var cols = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (cols) {
      var rowData = cols.map(col => col.replace(/<[^>]*>/g, "").trim()); // Remove HTML tags
      data.push(rowData);
      maxColumns = Math.max(maxColumns, rowData.length); // Track max column count
    }
  });

  // Normalize all rows to have the same column count by filling missing cells
  data = data.map(row => row.concat(Array(maxColumns - row.length).fill("")));

  // Insert data into Google Sheet starting from cell A1
  sheet.getRange(1, 1, data.length, maxColumns).setValues(data);
}