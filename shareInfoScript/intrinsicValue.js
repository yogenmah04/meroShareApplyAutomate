function calculateIntrinsicValue() {
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("intrinsic value");
   // Inputs (FCFs in millions, shares in units)
  const riskFreeRate = sheet.getRange("B2").getValue();       // 4.00%
  const equityRiskPremium = sheet.getRange("B3").getValue();  // 5.50%
  const beta = sheet.getRange("B4").getValue();               // 0.8
  const costOfDebt = sheet.getRange("B5").getValue();         // 6%
  const taxRate = sheet.getRange("B6").getValue();            // 25%
  const debtToEquity = sheet.getRange("B7").getValue();       // 40%
  const terminalGrowth = sheet.getRange("B8").getValue();     // 2%
  const sharesOutstanding = sheet.getRange("B9").getValue();  // 50,000,000

  // WACC
  const costOfEquity = riskFreeRate + (beta * equityRiskPremium);
  const wacc = (costOfEquity * (1 - debtToEquity)) + 
               (costOfDebt * (1 - taxRate) * debtToEquity);

  // FCF projections (in millions)
  const fcfProjections = sheet.getRange("B3:B7").getValues().flat(); // [100, 105, 110, 115, 120]

  // PV of FCFs (in millions)
  let pvFCFs = 0;
  fcfProjections.forEach((fcf, index) => {
    const year = index + 1;
    const discountFactor = 1 / Math.pow(1 + wacc, year);
    pvFCFs += fcf * discountFactor;
  });

  // Terminal Value (in millions)
  const finalFCF = fcfProjections[fcfProjections.length - 1]; // 120
  const terminalValue = (finalFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);

  // Intrinsic Value (shares in millions)
  const intrinsicValuePerShare = (pvFCFs + pvTerminalValue) / (sharesOutstanding / 1000000);

  // Output
  sheet.getRange("B12").setValue(wacc).setNumberFormat("0.00%");
  sheet.getRange("B13").setValue(pvFCFs).setNumberFormat("$#,##0.00");
  sheet.getRange("B14").setValue(pvTerminalValue).setNumberFormat("$#,##0.00");
  sheet.getRange("B15").setValue(intrinsicValuePerShare).setNumberFormat("$0.00");

  return intrinsicValuePerShare;
}


// function onOpen() {
//   const ui = SpreadsheetApp.getUi();
//   ui.createMenu('Valuation')
//     .addItem('Calculate Intrinsic Value', 'calculateIntrinsicValue')
//     .addToUi();
// }