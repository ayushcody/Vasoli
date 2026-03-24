import { normalizeMerchant, extractUpiVpa, type ParsedTransaction } from "./merchant";

/**
 * Parse HDFC Bank statement CSV.
 *
 * HDFC statement format (typically):
 * Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, Closing Balance
 *
 * Example row:
 * 01/03/26, UPI-SWIGGY-SWIGGY@PAYTM-HDFC..., 01/03/26, 159.00, , 000012345678, 5432.10
 */
export function parseHDFCStatement(csvText: string): ParsedTransaction[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const results: ParsedTransaction[] = [];

    // Find the header line
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes("date") && lower.includes("narration")) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) {
        // Try without explicit header — assume standard HDFC format
        headerIdx = -1;
    }

    const startLine = headerIdx >= 0 ? headerIdx + 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;

        // Skip summary/total rows
        if (cols[0].toLowerCase().includes("statement") || cols[0] === "") continue;

        const dateStr = cols[0].trim();
        const narration = cols[1]?.trim() || "";
        const debitStr = cols[3]?.trim();
        const creditStr = cols[4]?.trim();
        const refNum = cols[5]?.trim();

        const date = parseHDFCDate(dateStr);
        if (!date) continue;

        const debit = parseAmount(debitStr);
        const credit = parseAmount(creditStr);

        let amount: number;
        let type: "EXPENSE" | "INCOME";

        if (credit > 0) {
            amount = credit;
            type = "INCOME";
        } else if (debit > 0) {
            amount = debit;
            type = "EXPENSE";
        } else {
            continue; // skip zero-amount rows
        }

        const upiVpa = extractUpiVpa(narration);

        results.push({
            date,
            amount,
            type,
            merchantRaw: narration,
            merchantNorm: normalizeMerchant(narration),
            description: narration,
            upiRef: refNum || undefined,
            upiVpa: upiVpa || undefined,
        });
    }

    return results;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseAmount(s: string | undefined): number {
    if (!s) return 0;
    const cleaned = s.replace(/[₹,\s]/g, "");
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

/** Parse HDFC date format: DD/MM/YY or DD/MM/YYYY */
function parseHDFCDate(s: string): Date | null {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    const day = parseInt(m[1]);
    const month = parseInt(m[2]) - 1;
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
}
