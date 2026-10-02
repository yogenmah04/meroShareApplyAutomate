const notifier = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("notifier");


function notifiyShareSellDate() {
  var data = notifier.getRange("A2:E16").getValues();
  console.log(data)
}

function apiHit(){
  var url = "https://dummyjson.com/auth/login";
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        username: 'kminchelle',
        password: '0lelplR'
      })
  };

  var response = UrlFetchApp.fetch(url, options);

  console.log(JSON.parse(response.getContentText()));

}

function getData() {
  var sheetName=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("allData");
  var realData='=IMPORTHTML("https://www.sharesansar.com/today-share-price","table",1)';
  console.log('i mhere',realData);
  sheetName.getRange('A1').setValue(realData);
}

function fetchData(){
  var sheetName=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("data");
  const data=UrlFetchApp.fetch("https://nepstockapi.herokuapp.com/");
  var res=JSON.parse(data.getContentText());
  // for(var i=0;i<=res.length;i++){
  //     Logger.log(res[i])
  // }
  
  Logger.log(res[0])
  
}


function gg(input){
  // var cell = SpreadsheetApp.getActiveSheet().getActiveCell();
  // var a1 = cell.getA1Notation();
  // var val = cell.getValue();
  
  // SpreadsheetApp.getUi().alert("The active cell value is "+val);

  console.log(input);
  // onOpen(input);
  var sheetName=SpreadsheetApp.getActiveSpreadsheet();
  // sheetName.getRange('A10').setValue(input);
  
  try {
    SpreadsheetApp.getUi().alert("The active cell value is "+input);
  } catch (e) {
    Logger.log("The active cell value is " + input);
  }

}
