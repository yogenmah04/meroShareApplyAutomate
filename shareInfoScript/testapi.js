function testApiDoPost(e) {
  e = e || {};
  // Log the incoming request
  console.log("Incoming Request:", JSON.stringify(e));

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("test");
    if (!sheet) {
      Logger.log("Sheet 'test' not found.");
      return ContentService.createTextOutput("Sheet 'test' not found");
    }
    var contents = e.postData ? e.postData.contents : '{"timestamp":"' + new Date().toISOString() + '","value":"manual_run"}';
    var data = JSON.parse(contents);

    // Log the parsed data
    Logger.log("Parsed Data:", JSON.stringify(data));

    // Append data to the sheet
    sheet.appendRow([data.timestamp, data.value]);

    // Log success
    Logger.log("Data appended successfully");

    // Return a success response
    return ContentService.createTextOutput("Data added successfully");
  } catch (error) {
    // Log errors
    console.error("Error:", error.message);

    // Return an error response
    return ContentService.createTextOutput("Error: " + error.message);
  }
}

function testApiDoGet(e) {
  e = e || {};
  // Log the incoming request parameters (optional)
  console.log("Incoming Request Parameters:", JSON.stringify(e));

  // Create a response object
  var response = {
    status: "success",
    message: "Hello from Google Apps Script!",
    timestamp: new Date().toISOString(),
    parameters: e.parameters || {} // Include any query parameters from the request
  };

  // Return the response as JSON
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}