function fetchStockHistory() {
  // Get the spreadsheet and the "Settings" sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = spreadsheet.getSheetByName('PriceHistory'); // Ensure sheet is named "Settings"
  
  // Read parameters from the Settings sheet
  var params = {
    stockSymbol: settingsSheet.getRange('B2').getValue(),
    fromDate: settingsSheet.getRange('B3').getValue(),
    toDate: settingsSheet.getRange('B4').getValue(),
    pageNo: settingsSheet.getRange('B5').getValue(),
    itemsPerPage: settingsSheet.getRange('B6').getValue(),
    pagePerDisplay: settingsSheet.getRange('B7').getValue()
  };
  
  // Validate parameters
  if (!params.stockSymbol || !params.fromDate || !params.toDate) {
    Logger.log('Error: Missing required parameters (stockSymbol, fromDate, or toDate).');
    return;
  }
  
  // Format dates to yyyy-mm-dd
  function formatDate(dateInput) {
    var date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      throw new Error('Invalid date format');
    }
    if (isNaN(date)) throw new Error('Invalid date');
    var year = date.getFullYear();
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }
  
  try {
    // Convert dates to yyyy-mm-dd
    params.fromDate = formatDate(params.fromDate);
    params.toDate = formatDate(params.toDate);
  } catch (e) {
    Logger.log('Date formatting error: ' + e.message);
    return;
  }
  
  // Construct the API URL dynamically with encoded dates
  var url = `https://www.nepalipaisa.com/api/GetStockHistory?stockSymbol=${encodeURIComponent(params.stockSymbol)}&fromDate=${encodeURIComponent(params.fromDate)}&toDate=${encodeURIComponent(params.toDate)}&pageNo=${params.pageNo}&itemsPerPage=${params.itemsPerPage}&pagePerDisplay=${params.pagePerDisplay}&_=1750239452929`;
  
  // Set up headers
  var headers = {
    'Accept': 'application/json'
  };
  
  // Set up options for the HTTP request
  var options = {
    'method': 'get',
    'headers': headers,
    'muteHttpExceptions': true // Prevents script from stopping on HTTP errors
  };
  
  try {
    // Make the API request
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      // Parse the JSON response
      var json = JSON.parse(response.getContentText());
      
      // Extract data from json.result.data
      var data = json.result.data;
      
      if (data && data.length > 0) {
        // Get or create the "Data" sheet
        var dataSheet = spreadsheet.getSheetByName('PriceHistory') || spreadsheet.insertSheet('PriceHistory');
        
        // Clear existing content (optional)
        // dataSheet.clear();
        
        // Define desired headers in the preferred order
        var headers = [
          'sn', 'tradeDateString', 'maxPrice', 'minPrice', 'closingPrice',
          'noOfTransactions', 'volume', 'amount', 'previousClosing',
          'differenceRs', 'percentChange'
        ];
        
        // Write headers to the sheet
        dataSheet.getRange(9, 1, 1, headers.length).setValues([headers]);
        
        // Prepare data for the sheet
        var rows = data.map(function(item) {
          return headers.map(function(key) {
            return item[key] || ''; // Handle missing values
          });
        });
        
        // Write data to the sheet
        dataSheet.getRange(10, 1, rows.length, headers.length).setValues(rows);
        
        Logger.log('Data successfully imported to the Data sheet.');
      } else {
        Logger.log('No data found in the response.');
      }
    } else {
      Logger.log('HTTP Error: ' + responseCode + ' - ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Error: ' + e.message);
  }
}
// function onOpen() {
//   const ui = SpreadsheetApp.getUi();
//   ui.createMenu('📈 NEPSE Trader')
//     .addItem('Get price history', 'fetchStockHistory')
//     .addItem('Analysis', 'analyzeBuyTpSl')
//     .addItem('Evaluate', 'evaluateBuySignals')
//     .addItem('Generate Trading Signals', 'generateSignalsNew')
//     .addToUi();
// }


