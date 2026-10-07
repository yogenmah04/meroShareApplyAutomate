import { formatPurchaseDate, generateUniqueStockId, syncYogenToSLTPStocks, scanSLTPStocksAgainstLive } from './sltpMonitorService';
import { initSheets, doc } from './googleSheetsService';

async function testSLTPAutomation() {
    console.log('=====================================================');
    console.log('🧪 SL/TP Automation & Unique ID Test Suite');
    console.log('=====================================================\n');

    // 1. Verify Date Parsing & Unique ID Generation
    console.log('1️⃣ Testing Date Formats & Unique ID Consistency:');
    const testCases = [
        { label: 'Numeric Excel serial (46296)', input: 46296 },
        { label: 'String Excel serial ("46296")', input: '46296' },
        { label: 'US date format ("10/01/26")', input: '10/01/26' },
        { label: 'US date format ("10/1/2026")', input: '10/1/2026' },
        { label: 'ISO date format ("2026-10-01")', input: '2026-10-01' },
        { label: 'Date Object', input: new Date('2026-10-01T00:00:00Z') }
    ];

    let allPassed = true;
    for (const tc of testCases) {
        const formattedDate = formatPurchaseDate(tc.input);
        const uniqueId = generateUniqueStockId('NRIC', 20, 800, formattedDate);
        const passed = uniqueId === 'NRIC-20-800-2026-10-01';
        console.log(`   ${passed ? '✅' : '❌'} ${tc.label.padEnd(34)} -> Date: ${formattedDate} | UID: ${uniqueId}`);
        if (!passed) allPassed = false;
    }

    if (!allPassed) {
        console.error('\n❌ Date parsing test failed. Aborting further steps.');
        return;
    }
    console.log('   🎉 All date formats produced the exact same Unique ID: NRIC-20-800-2026-10-01\n');

    // 2. Stage 1: Sync 'yogen' -> 'SLTP-stocks'
    console.log('2️⃣ Testing Stage 1: syncYogenToSLTPStocks()...');
    const stage1Res = await syncYogenToSLTPStocks();
    console.log('   Result:', stage1Res);

    // 3. Stage 2: Live Price Scan & Duplicate Prevention in 'SL-TP-Hits'
    console.log('\n3️⃣ Testing Stage 2: scanSLTPStocksAgainstLive(false)...');
    const stage2Res = await scanSLTPStocksAgainstLive(false);
    console.log('   Result: New Hits Added:', stage2Res.newTriggersCount, '| Matched Stocks:', stage2Res.matchedStocks);

    // 4. Verify Google Sheet Content
    console.log('\n4️⃣ Inspecting Google Sheet Tabs:');
    await initSheets();

    const sltpSheet = doc.sheetsByTitle['SLTP-stocks'];
    if (sltpSheet) {
        const rows = await sltpSheet.getRows();
        console.log(`   • 'SLTP-stocks' total rows: ${rows.length}`);
        rows.slice(0, 3).forEach((r, idx) => {
            console.log(`     [Row ${idx + 2}] Symbol: ${r.get('Symbol')} | UID: ${r.get('Unique ID')} | Purchase Date: ${r.get('purchase date')}`);
        });
    }

    const hitsSheet = doc.sheetsByTitle['SL-TP-Hits'];
    if (hitsSheet) {
        const rows = await hitsSheet.getRows();
        console.log(`   • 'SL-TP-Hits' total rows: ${rows.length}`);
        rows.slice(0, 3).forEach((r, idx) => {
            console.log(`     [Row ${idx + 2}] Symbol: ${r.get('Symbol')} | UID: ${r.get('Unique ID')} | Event: ${r.get('Trigger Event')} | Status: ${r.get('Status')}`);
        });
    }

    console.log('\n=====================================================');
    console.log('✅ SL/TP Test Completed Successfully');
    console.log('=====================================================');
}

testSLTPAutomation().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
