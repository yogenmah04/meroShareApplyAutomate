// ============================================================================

// =============================================================================
// Menu.gs — Consolidated Single onOpen Menu
// =============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu('📊 NEPSE Command Center')
    .addItem('1. Sync "yogen" -> "SLTP-stocks" (Stage 1)', 'syncYogenToSLTPStocksManual')
    .addItem('2. Scan "SLTP-stocks" for Hits (Stage 2)', 'scanSLTPStocksAgainstLiveManual')
    .addItem('Setup All Trading Automation Triggers (Hourly & 10-Min)', 'setupAllTradingAutomationTriggers')
    .addItem('Remove All Trading Automation Triggers', 'removeAllTradingAutomationTriggers')
    .addSeparator()
    .addItem('Refresh Signal Sheet', 'createSignalSheet')
    .addSeparator()
    .addItem('Calculate Intrinsic Value', 'calculateIntrinsicValue')
    .addItem('Create Hydropower Valuation Template', 'createHydropowerValuationTool')
    .addSeparator()
    .addItem('Get Price History', 'fetchStockHistory')
    .addItem('Analysis', 'analyzeBuyTpSl')
    .addItem('Evaluate', 'evaluateBuySignals')
    .addItem('Generate Trading Signals', 'generateSignalsNew')
    .addSeparator()
    .addItem('Run All Scans Now', 'runAll')
    .addItem('Setup Automated Triggers', 'setupTriggers')
    .addItem('Remove All Triggers', 'removeTriggers')
    .addItem('Clear Daily History', 'clearDailyHistory')
    .addSeparator()
    .addItem('fetch live trading data', 'fetchLiveTradingData')
    .addSeparator()
    .addItem('Update NEPSE Report (B1) Now', 'scrapeNepseStatusDaily')
    .addItem('Setup Both NEPSE Triggers (11:01 AM & 4:05 PM)', 'setupNepseAllTriggers')
    .addItem('Setup 11:01 AM NEPSE Trigger', 'setupNepse1101Trigger')
    .addItem('Setup 4:05 PM NEPSE Trigger', 'setupNepse1605Trigger')
    .addItem('Remove All NEPSE Triggers', 'removeNepseTriggers')
    .addSeparator()
    .addItem('Check Node.js App Status & Notify Telegram', 'checkNodeAppStatusDaily')
    .addItem('Setup 10:30 AM Status Trigger', 'setupDailyStatus1030Trigger')
    .addItem('Remove 10:30 AM Status Trigger', 'removeDailyStatusTrigger')
    .addToUi();
}