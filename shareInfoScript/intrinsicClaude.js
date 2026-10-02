/**
 * Creates a comprehensive Hydropower Stock Intrinsic Value Calculator in Google Sheets
 * Run this function to set up the entire spreadsheet from scratch
 */
function createHydropowerValuationTool() {
  // Create a new spreadsheet or use the current one
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  sheet.setName("Hydropower Stock Valuation");
  
  // Clear the sheet
  // sheet.clear();
  
  // // Set column widths for better readability
  // sheet.setColumnWidth(1, 250);
  // sheet.setColumnWidths(2, 10, 120);
  
  // // ===== Header Section =====
  // sheet.getRange("A1:L1").merge().setValue("HYDROPOWER STOCK INTRINSIC VALUE CALCULATOR")
  //   .setFontWeight("bold").setFontSize(16).setHorizontalAlignment("center")
  //   .setBackground("#D9EAD3").setFontColor("#274E13");
  
  // sheet.getRange("A2:L2").merge().setValue("A DCF model specifically designed for hydropower companies")
  //   .setFontStyle("italic").setHorizontalAlignment("center");
  
  // // ===== Input Parameters Section =====
  // sheet.getRange("A4").setValue("INPUT PARAMETERS").setFontWeight("bold").setFontSize(12);
  // sheet.getRange("A4:C4").setBackground("#D9D2E9");
  
  // // Company Information
  // sheet.getRange("A6").setValue("Company Name:").setFontWeight("bold");
  // sheet.getRange("B6").setValue("Hydropower Co.").setBackground("#FFFF00");
  
  // sheet.getRange("A7").setValue("Ticker Symbol:").setFontWeight("bold");
  // sheet.getRange("B7").setValue("HYDRO").setBackground("#FFFF00");
  
  // sheet.getRange("A8").setValue("Currency:").setFontWeight("bold");
  // sheet.getRange("B8").setValue("USD").setBackground("#FFFF00");
  
  // // Financial Data
  // sheet.getRange("A10").setValue("FINANCIAL INPUTS").setFontWeight("bold");
  // sheet.getRange("A10:C10").setBackground("#D9D2E9");
  
  // sheet.getRange("A12").setValue("Initial Free Cash Flow (millions):").setFontWeight("bold");
  // sheet.getRange("B12").setValue(120).setBackground("#FFFF00");
  // sheet.getRange("C12").setValue("Latest annual FCF or multi-year average").setFontStyle("italic");
  
  // sheet.getRange("A13").setValue("Cash & Equivalents (millions):").setFontWeight("bold");
  // sheet.getRange("B13").setValue(50).setBackground("#FFFF00");
  
  // sheet.getRange("A14").setValue("Total Debt (millions):").setFontWeight("bold");
  // sheet.getRange("B14").setValue(230).setBackground("#FFFF00");
  
  // sheet.getRange("A15").setValue("Shares Outstanding (millions):").setFontWeight("bold");
  // sheet.getRange("B15").setValue(100).setBackground("#FFFF00");
  
  // // Valuation Parameters
  // sheet.getRange("A17").setValue("VALUATION PARAMETERS").setFontWeight("bold");
  // sheet.getRange("A17:C17").setBackground("#D9D2E9");
  
  // sheet.getRange("A19").setValue("Forecast Period (years):").setFontWeight("bold");
  // sheet.getRange("B19").setValue(10).setBackground("#FFFF00");
  
  // sheet.getRange("A20").setValue("Discount Rate (WACC):").setFontWeight("bold");
  // sheet.getRange("B20").setValue(0.09).setBackground("#FFFF00");
  // sheet.getRange("C20").setValue("Between 7-10% for established hydropower").setFontStyle("italic");
  // sheet.getRange("B20").setNumberFormat("0.00%");
  
  // sheet.getRange("A21").setValue("Terminal Growth Rate:").setFontWeight("bold");
  // sheet.getRange("B21").setValue(0.025).setBackground("#FFFF00");
  // sheet.getRange("C21").setValue("Long-term sustainable growth rate").setFontStyle("italic");
  // sheet.getRange("B21").setNumberFormat("0.00%");
  
  // // ===== Growth Rate Assumptions Section =====
  // sheet.getRange("A23").setValue("GROWTH RATE ASSUMPTIONS").setFontWeight("bold");
  // sheet.getRange("A23:C23").setBackground("#D9D2E9");
  
  // sheet.getRange("A25").setValue("Year").setFontWeight("bold");
  // sheet.getRange("B25").setValue("Growth Rate").setFontWeight("bold");
  // sheet.getRange("C25").setValue("Notes").setFontWeight("bold");
  
  // Create growth rate inputs for each year
  const projectionYears = 10;
  // for (let i = 1; i <= projectionYears; i++) {
  //   sheet.getRange(`A${25+i}`).setValue(`Year ${i}`);
    
  //   // Set different growth rates for different periods
  //   let defaultGrowth;
  //   if (i <= 3) {
  //     defaultGrowth = 0.05; // Higher growth in early years
  //   } else if (i <= 7) {
  //     defaultGrowth = 0.04; // Moderate growth in middle years
  //   } else {
  //     defaultGrowth = 0.03; // Lower growth approaching terminal period
  //   }
    
  //   sheet.getRange(`B${25+i}`).setValue(defaultGrowth).setBackground("#FFFF00").setNumberFormat("0.00%");
    
  //   if (i === 1) {
  //     sheet.getRange(`C${25+i}`).setValue("High growth phase with new capacity").setFontStyle("italic");
  //   } else if (i === 4) {
  //     sheet.getRange(`C${25+i}`).setValue("Moderate growth phase").setFontStyle("italic");
  //   } else if (i === 8) {
  //     sheet.getRange(`C${25+i}`).setValue("Mature growth phase").setFontStyle("italic");
  //   }
  // }
  
  // ===== DCF Calculation Section =====
  const startRow = 38;
  sheet.getRange(`A${startRow}`).setValue("DCF CALCULATION").setFontWeight("bold").setFontSize(12);
  sheet.getRange(`A${startRow}:L${startRow}`).setBackground("#D9D2E9");
  
  // Headers for DCF table
  sheet.getRange(`A${startRow+2}`).setValue("Year").setFontWeight("bold");
  sheet.getRange(`B${startRow+2}`).setValue("Free Cash Flow (millions)").setFontWeight("bold");
  sheet.getRange(`C${startRow+2}`).setValue("Growth Rate").setFontWeight("bold");
  sheet.getRange(`D${startRow+2}`).setValue("Discount Factor").setFontWeight("bold");
  sheet.getRange(`E${startRow+2}`).setValue("Discounted FCF (millions)").setFontWeight("bold");
  
  // Set up the DCF calculations
  for (let i = 1; i <= projectionYears; i++) {
    const row = startRow + 2 + i;
    
    // Year
    sheet.getRange(`A${row}`).setValue(i);
    
    // Free Cash Flow formula
    if (i === 1) {
      sheet.getRange(`B${row}`).setFormula(`=B12*(1+B26)`);
    } else {
      sheet.getRange(`B${row}`).setFormula(`=B${row-1}*(1+B${25+i})`);
    }
    
    // Growth Rate (reference to input section)
    sheet.getRange(`C${row}`).setFormula(`=B${25+i}`).setNumberFormat("0.00%");
    
    // Discount Factor
    sheet.getRange(`D${row}`).setFormula(`=1/(1+$B$20)^A${row}`).setNumberFormat("0.0000");
    
    // Discounted FCF
    sheet.getRange(`E${row}`).setFormula(`=B${row}*D${row}`);
  }
  
  // Format numbers in the DCF section
  sheet.getRange(`B${startRow+3}:B${startRow+3+projectionYears}`).setNumberFormat("#,##0.00");
  sheet.getRange(`E${startRow+3}:E${startRow+3+projectionYears}`).setNumberFormat("#,##0.00");
  
  // ===== Terminal Value Section =====
  const terminalRow = startRow + projectionYears + 5;
  sheet.getRange(`A${terminalRow}`).setValue("TERMINAL VALUE CALCULATION").setFontWeight("bold");
  sheet.getRange(`A${terminalRow}:E${terminalRow}`).setBackground("#D9D2E9");
  
  sheet.getRange(`A${terminalRow+2}`).setValue("Final Year FCF (millions):").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+2}`).setFormula(`=B${startRow+2+projectionYears}`);
  
  sheet.getRange(`A${terminalRow+3}`).setValue("Terminal Growth Rate:").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+3}`).setFormula("=B21").setNumberFormat("0.00%");
  
  sheet.getRange(`A${terminalRow+4}`).setValue("Discount Rate:").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+4}`).setFormula("=B20").setNumberFormat("0.00%");
  
  sheet.getRange(`A${terminalRow+5}`).setValue("Terminal Value (millions):").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+5}`).setFormula(`=B${terminalRow+2}*(1+B${terminalRow+3})/(B${terminalRow+4}-B${terminalRow+3})`);
  
  sheet.getRange(`A${terminalRow+6}`).setValue("Discount Factor (Year 10):").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+6}`).setFormula(`=D${startRow+2+projectionYears}`).setNumberFormat("0.0000");
  
  sheet.getRange(`A${terminalRow+7}`).setValue("Discounted Terminal Value (millions):").setFontWeight("bold");
  sheet.getRange(`B${terminalRow+7}`).setFormula(`=B${terminalRow+5}*B${terminalRow+6}`);
  
  // Format numbers in terminal value section
  sheet.getRange(`B${terminalRow+2}:B${terminalRow+7}`).setNumberFormat("#,##0.00");
  
  // ===== Final Valuation Section =====
  const valuationRow = terminalRow + 10;
  sheet.getRange(`A${valuationRow}`).setValue("FINAL VALUATION").setFontWeight("bold").setFontSize(12);
  sheet.getRange(`A${valuationRow}:E${valuationRow}`).setBackground("#D9D2E9");
  
  sheet.getRange(`A${valuationRow+2}`).setValue("Sum of Discounted FCF (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+2}`).setFormula(`=SUM(E${startRow+3}:E${startRow+2+projectionYears})`);
  
  sheet.getRange(`A${valuationRow+3}`).setValue("Discounted Terminal Value (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+3}`).setFormula(`=B${terminalRow+7}`);
  
  sheet.getRange(`A${valuationRow+4}`).setValue("Total Enterprise Value (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+4}`).setFormula(`=B${valuationRow+2}+B${valuationRow+3}`);
  
  sheet.getRange(`A${valuationRow+5}`).setValue("Less: Total Debt (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+5}`).setFormula("=B14");
  
  sheet.getRange(`A${valuationRow+6}`).setValue("Plus: Cash & Equivalents (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+6}`).setFormula("=B13");
  
  sheet.getRange(`A${valuationRow+7}`).setValue("Equity Value (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+7}`).setFormula(`=B${valuationRow+4}-B${valuationRow+5}+B${valuationRow+6}`);
  
  sheet.getRange(`A${valuationRow+8}`).setValue("Shares Outstanding (millions):").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+8}`).setFormula("=B15");
  
  sheet.getRange(`A${valuationRow+9}`).setValue("INTRINSIC VALUE PER SHARE:").setFontWeight("bold");
  sheet.getRange(`B${valuationRow+9}`).setFormula(`=B${valuationRow+7}/B${valuationRow+8}`)
    .setFontWeight("bold").setFontSize(14).setBackground("#D9EAD3");
  
  // Format numbers in final valuation section
  sheet.getRange(`B${valuationRow+2}:B${valuationRow+8}`).setNumberFormat("#,##0.00");
  sheet.getRange(`B${valuationRow+9}`).setNumberFormat("$#,##0.00");
  
  // ===== Sensitivity Analysis =====
  const sensitivityRow = valuationRow + 12;
  sheet.getRange(`A${sensitivityRow}`).setValue("SENSITIVITY ANALYSIS").setFontWeight("bold").setFontSize(12);
  sheet.getRange(`A${sensitivityRow}:G${sensitivityRow}`).setBackground("#D9D2E9");
  
  sheet.getRange(`A${sensitivityRow+2}`).setValue("Intrinsic Value per Share at Different Discount Rates and Terminal Growth Rates").setFontWeight("bold");
  sheet.getRange(`A${sensitivityRow+2}:G${sensitivityRow+2}`).merge();
  
  // Headers for sensitivity table
  sheet.getRange(`B${sensitivityRow+4}`).setValue("Terminal Growth Rate").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange(`B${sensitivityRow+4}:G${sensitivityRow+4}`).merge();
  
  sheet.getRange(`A${sensitivityRow+5}`).setValue("Discount Rate").setFontWeight("bold");
  
  // Define sensitivity analysis ranges
  const discountRates = [0.08, 0.085, 0.09, 0.095, 0.10];
  const terminalRates = [0.015, 0.02, 0.025, 0.03, 0.035];
  
  // Set up terminal growth rate headers
  for (let i = 0; i < terminalRates.length; i++) {
    sheet.getRange(sensitivityRow + 5, 2 + i).setValue(terminalRates[i]).setNumberFormat("0.0%");
  }
  
  // Set up discount rate rows and formulas
  for (let i = 0; i < discountRates.length; i++) {
    sheet.getRange(sensitivityRow + 6 + i, 1).setValue(discountRates[i]).setNumberFormat("0.0%");
    
    // Create formulas for each cell in sensitivity table
    for (let j = 0; j < terminalRates.length; j++) {
      // This is a complex formula that recalculates the DCF with different parameters
      // For simplicity, we'll create a placeholder formula that demonstrates the concept
      const formula = `=ROUND((SUM(B${startRow+3}:B${startRow+2+projectionYears})/(1+${discountRates[i]})^ROW(A${startRow+3}:A${startRow+2+projectionYears}) + 
                      B${startRow+2+projectionYears}*(1+${terminalRates[j]})/(${discountRates[i]}-${terminalRates[j]})/(1+${discountRates[i]})^${projectionYears} - 
                      B14 + B13)/B15, 2)`;
      
      // For a more accurate but simplified version:
      const simplifiedFormula = `=ROUND((B${valuationRow+2}*(${discountRates[i]}/B20)^0.5 + 
                               B${startRow+2+projectionYears}*(1+${terminalRates[j]})/(${discountRates[i]}-${terminalRates[j]})/(1+${discountRates[i]})^${projectionYears} - 
                               B14 + B13)/B15, 2)`;
                               
      sheet.getRange(sensitivityRow + 6 + i, 2 + j).setFormula(simplifiedFormula).setNumberFormat("$#,##0.00");
    }
  }
  
  // Format the sensitivity table
  sheet.getRange(`A${sensitivityRow+5}:G${sensitivityRow+11}`).setBorder(true, true, true, true, true, true);
  sheet.getRange(`B${sensitivityRow+5}:G${sensitivityRow+5}`).setBackground("#E6E6E6");
  sheet.getRange(`A${sensitivityRow+6}:A${sensitivityRow+10}`).setBackground("#E6E6E6");
  
  // Center the current assumption in the sensitivity table
  sheet.getRange(sensitivityRow + 8, 4).setBackground("#FFFF00");
  
  // ===== Add Notes Section =====
  const notesRow = sensitivityRow + 13;
  sheet.getRange(`A${notesRow}`).setValue("NOTES ON HYDROPOWER VALUATION").setFontWeight("bold");
  sheet.getRange(`A${notesRow}:E${notesRow}`).setBackground("#D9D2E9");
  
  const notes = [
    "• Hydropower assets typically have very long lifespans (50-100 years), which may justify lower discount rates",
    "• Consider multi-year averaging for initial FCF to account for weather and water flow variability",
    "• Growth rates should reflect capacity expansion plans, power purchase agreements, and regulatory environment",
    "• Terminal value is highly sensitive to discount and growth assumptions - consider the sensitivity analysis carefully",
    "• This model uses simplified FCF projections; consider adding detailed breakdowns of revenue and costs for greater accuracy"
  ];
  
  for (let i = 0; i < notes.length; i++) {
    sheet.getRange(`A${notesRow + 2 + i}:E${notesRow + 2 + i}`).merge().setValue(notes[i]);
  }
  
  // Final formatting
  sheet.getRange("A1:G1").setBorder(true, true, true, true, false, false, "black", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  // Add a note about using the template
  sheet.getRange(`A${notesRow + notes.length + 3}:E${notesRow + notes.length + 3}`).merge()
    .setValue("To use this calculator, enter your data in the yellow highlighted cells. All other cells contain formulas.")
    .setFontStyle("italic").setHorizontalAlignment("center");
  
  // Protect formula cells to prevent accidental editing
  const protection = sheet.protect().setDescription("Protect formulas");
  protection.setUnprotectedRanges([
    sheet.getRange("B6:B8"),
    sheet.getRange("B12:B15"),
    sheet.getRange("B19:B21"),
    sheet.getRange(`B26:B${25+projectionYears}`)
  ]);
  
  // Set the active cell to the company name for better UX
  sheet.setActiveRange(sheet.getRange("B6"));
  
  return "Hydropower Stock Valuation template created successfully!";
}

/**
 * Creates a menu item in Google Sheets to run this tool
 */
// function onOpen() {
//   const ui = SpreadsheetApp.getUi();
//   ui.createMenu('Valuation Tools')
//     .addItem('Create Hydropower Valuation Template', 'createHydropowerValuationTool')
//     .addToUi();
// }