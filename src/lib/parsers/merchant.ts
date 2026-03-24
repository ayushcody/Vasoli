/**
 * Normalize merchant strings from bank statements.
 * Strips UPI transaction prefixes, VPA suffixes, reference numbers, etc.
 */
export function normalizeMerchant(raw: string): string {
    if (!raw) return "";
    let s = raw.trim();

    // Remove common UPI prefixes
    s = s.replace(/^UPI[-/]/i, "").trim();
    s = s.replace(/^UPI\s+/i, "").trim();
    s = s.replace(/^IMPS[-/]/i, "").trim();
    s = s.replace(/^NEFT[-/]/i, "").trim();
    s = s.replace(/^RTGS[-/]/i, "").trim();

    // Remove reference numbers at end (e.g., /12345678/...)
    s = s.replace(/\/\d{6,}(\/.*)?$/g, "").trim();

    // Remove VPA patterns (something@bank)
    s = s.replace(/\s*[\w.+-]+@[\w]+$/i, "").trim();

    // Remove trailing dashes/slashes
    s = s.replace(/[-/]+$/, "").trim();

    // Collapse whitespace
    s = s.replace(/\s+/g, " ");

    return s.toLowerCase();
}

/**
 * Extract UPI VPA from a description string if present.
 * Looks for patterns like `user@bank`
 */
export function extractUpiVpa(description: string): string | null {
    const match = description.match(/([\w.+-]+@[a-zA-Z]{2,})/);
    return match ? match[1].toLowerCase() : null;
}

export interface ParsedTransaction {
    date: Date;
    amount: number;
    type: "EXPENSE" | "INCOME";
    merchantRaw: string;
    merchantNorm: string;
    description?: string;
    upiRef?: string;
    upiVpa?: string;
}
