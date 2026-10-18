export function autoDetectFormat(csvText: string): "hdfc" | "icici" | "sbi" | "axis" | "kotak" | "upi" | "generic" {
    const lines = csvText.split(/\r?\n/).slice(0, 30).map(l => l.toLowerCase());

    for (const line of lines) {
        if (line.includes("narration") && line.includes("withdrawal") && line.includes("deposit")) {
            if (line.includes("chq/ref no")) return "kotak";
            return "icici";
        }
        if (line.includes("txn date") && line.includes("description") && line.includes("ref no") && line.includes("debit") && line.includes("credit")) {
            return "sbi";
        }
        if (line.includes("tran date") && line.includes("particulars") && line.includes("debit") && line.includes("credit")) {
            return "axis";
        }
        if (line.includes("date") && line.includes("description") && line.includes("transaction type") && line.includes("amount")) {
            return "upi";
        }
        if (line.includes("date") && line.includes("narration") && line.includes("closing balance")) {
            return "hdfc"; // HDFC typically has Debit Amount, Credit Amount, but also Narration and Closing Balance
        }
    }

    return "generic";
}
