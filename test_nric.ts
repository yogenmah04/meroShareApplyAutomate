import { initSheets, doc } from './googleSheetsService';

async function inspect() {
    await initSheets();

    const reportSheet = doc.sheetsByTitle["Report"];
    if (reportSheet) {
        await reportSheet.loadCells("A1:C2");
        console.log("Report!B1:", reportSheet.getCellByA1("B1").value);
    }

    const sltpSheet = doc.sheetsByTitle["SLTP-stocks"];
    if (!sltpSheet) {
        console.log("SLTP-stocks sheet not found!");
    } else {
        console.log("SLTP-stocks rowCount:", sltpSheet.rowCount, "colCount:", sltpSheet.columnCount);
        const rows = await sltpSheet.getRows();
        console.log("Total rows in SLTP-stocks:", rows.length);
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const r = rows[i];
            const raw = (r as any)._rawData || [];
            console.log(`SLTP Row ${i + 2}:`, {
                uniqueId: r.get('Unique ID') || raw[0],
                symbol: r.get('Symbol') || raw[1],
                stColM: r.get('ST (Stop Loss)') || raw[12],
                tpColN: r.get('TP (Take Profit)') || raw[13],
                raw11: raw[11],
                raw12: raw[12],
                raw13: raw[13]
            });
        }
    }

    const liveSheet = doc.sheetsByTitle["live trading"];
    if (liveSheet) {
        const rows = await liveSheet.getRows();
        const nric = rows.find((r: any) => (r.get("Symbol") || "").trim().toUpperCase() === "NRIC");
        if (nric) {
            console.log("Live trading NRIC:", {
                Symbol: nric.get("Symbol"),
                LTP: nric.get("LTP"),
                High: nric.get("High"),
                Low: nric.get("Low")
            });
        } else {
            console.log("NRIC not found in live trading sheet! Searching by substring...");
            const match = rows.find((r: any) => (r.get("Symbol") || "").includes("NRIC"));
            console.log("Substring match:", match ? match.get("Symbol") : "None");
        }
    }
}

inspect().catch(console.error);
