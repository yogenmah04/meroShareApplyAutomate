// Handler for news ingestion (called by master doPost in telegramWebhook.js)
function handlePerplexityNewsPost(e) {
  try {
    // Log the incoming data for debugging
    console.log("Raw postData contents:", e.postData.contents);
    
    // Parse incoming JSON
    const data = JSON.parse(e.postData.contents);
    console.log("Parsed data type:", typeof data, "Is array?", Array.isArray(data));
    console.log("Data:", JSON.stringify(data).substring(0, 500));
    
    // Get the 'news' sheet or create it
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('news');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('news');
      console.log("Created new 'news' sheet");
      // Add headers
      sheet.appendRow(['symbol', 'dateTimeNews', 'summarizedContent']);
      console.log("Added headers");
    }
    
    // Get last row for starting position
    const lastRow = sheet.getLastRow();
    console.log("Last row in sheet:", lastRow);
    
    // Check if data is an array or single object
    const dataArray = Array.isArray(data) ? data : [data];
    console.log("Processing", dataArray.length, "record(s)");
    
    // Prepare all row data
    const allRowData = [];
    
    dataArray.forEach((item, index) => {
      console.log(`Item ${index + 1}:`, JSON.stringify(item).substring(0, 200));
      allRowData.push([
        item.symbol || '',
        item.dateTimeNews || '',
        item.summarizedContent || ''
      ]);
    });
    
    // Write data to sheet
    if (allRowData.length > 0) {
      // Method 1: Using appendRow for each (simpler, handles any number of rows)
      allRowData.forEach(row => {
        sheet.appendRow(row);
      });
      console.log("Appended", allRowData.length, "rows to sheet");
      
      // OR Method 2: Using setValues (more efficient for large batches)
      // const startRow = lastRow + 1;
      // const numRows = allRowData.length;
      // const numColumns = allRowData[0].length;
      // sheet.getRange(startRow, 1, numRows, numColumns).setValues(allRowData);
      // console.log("Set", numRows, "rows starting from row", startRow);
    } else {
      console.log("No data to append");
    }
    
    // Verify data was written
    const newLastRow = sheet.getLastRow();
    console.log("New last row after appending:", newLastRow);
    
    // Return success
    const response = {
      success: true,
      message: `${allRowData.length} record(s) stored. Sheet now has ${newLastRow} rows (including header).`
    };
    console.log("Returning response:", response);
    
    return ContentService.createTextOutput(
      JSON.stringify(response)
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Error in doPost:", error);
    // Return error
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.toString(),
        stack: error.stack
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
