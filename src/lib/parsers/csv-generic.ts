import { normalizeMerchant, extractUpiVpa, type ParsedTransaction } from "./merchant";

export interface ColumnMapping {
    date: string;
    description: string;
    debit?: string;
    credit?: string;
    amount?: string; // single amount column (positive = credit, negative = debit)
}

/**
 * Parse a generic CSV string using user-provided column mapping.
 * Returns an array of ParsedTransaction objects.
 */
export function parseGenericCSV(
    csvText: string,
    mapping: ColumnMapping
): ParsedTransaction[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    // Parse header to find column indices
    const header = parseCSVLine(lines[0]);
    const indices: Record<string, number> = {};

    for (const [key, colName] of Object.entries(mapping)) {
        if (!colName) continue;
        const idx = header.findIndex(
            (h) => h.trim().toLowerCase() === colName.toLowerCase()
        );
        if (idx >= 0) indices[key] = idx;
    }

    if (indices.date === undefined || indices.description === undefined) {
        throw new Error(
            "Could not find date or description columns in CSV header."
        );
    }

    const results: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 2) continue;

        const rawDate = cols[indices.date]?.trim();
        const rawDesc = cols[indices.description]?.trim();
        if (!rawDate || !rawDesc) continue;

        const date = parseFlexDate(rawDate);
        if (!date) continue;

        let amount = 0;
        let type: "EXPENSE" | "INCOME" = "EXPENSE";

        if (indices.amount !== undefined) {
            const val = parseAmount(cols[indices.amount]);
            amount = Math.abs(val);
            type = val >= 0 ? "INCOME" : "EXPENSE";
        } else {
            const debit = indices.debit !== undefined ? parseAmount(cols[indices.debit]) : 0;
            const credit = indices.credit !== undefined ? parseAmount(cols[indices.credit]) : 0;
            if (credit > 0) {
                amount = credit;
                type = "INCOME";
            } else {
                amount = debit;
                type = "EXPENSE";
            }
        }

        if (amount === 0) continue;

        const upiVpa = extractUpiVpa(rawDesc);

        results.push({
            date,
            amount,
            type,
            merchantRaw: rawDesc,
            merchantNorm: normalizeMerchant(rawDesc),
            description: rawDesc,
            upiVpa: upiVpa || undefined,
        });
    }

    return results;
}

/** Parse a single CSV line, handling quoted fields */
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

/** Parse amount string, removing commas and currency symbols */
function parseAmount(s: string | undefined): number {
    if (!s) return 0;
    const cleaned = s.replace(/[₹,\s]/g, "").replace(/[()]/g, "-");
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

/** Parse date in multiple formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY */
function parseFlexDate(s: string): Date | null {
    // Try ISO format first
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY (Indian format — most common)
    const ddmmyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (ddmmyy) {
        const day = parseInt(ddmmyy[1]);
        const month = parseInt(ddmmyy[2]) - 1;
        let year = parseInt(ddmmyy[3]);
        if (year < 100) year += 2000;
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
    }

    return null;
}
