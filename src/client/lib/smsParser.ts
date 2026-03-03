export interface ParsedSMS {
    amount: number;
    type: "DEBIT" | "CREDIT";
    accountNumber?: string;
    merchant?: string;
    date?: Date;
    rawText: string;
    bank?: string;
}

// Regex patterns tuned for common Indian Bank SMS formats
const SMS_PATTERNS = [
    {
        bank: "HDFC",
        // Example: "Rs.500.00 has been debited from a/c **1234 on 28-02-26 to VPA foo@bar. UPI Ref 12345."
        // Example: "UPDATE: INR 1,500.00 debited from HDFC Bank A/c xx1234 on 28-Feb-26. Info: Swiggy. Avl Bal: INR 10,000.00."
        regex: /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(debited|credited|spent|withdrawn).*?(?:a\/c|account) [x\*]*(\d+)[^\.]*\.?\s*(?:Info|to VPA|at)?\s*:?\s*([^\.]+)?/i,
    },
    {
        bank: "SBI",
        // Example: "Dear SBI User, your A/c X1234-debited by Rs100.00 on 28Feb26. Ref No 1234"
        regex: /(?:A\/c\s*[Xx\*]+(\d+)).*?(debited|credited).*?(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    },
    {
        bank: "ICICI",
        // Example: "Acct XX1234 debited with INR 500.00 on 28-Feb-26. Info: Amazon."
        regex: /(?:Acct\s*[Xx\*]+(\d+))\s*(debited|credited).*?(?:INR|Rs\.?)\s*([\d,]+\.?\d*).*?(?:Info|Remarks)\s*:?\s*([^\.]+)?/i,
    }
];

export function parseBankSMS(smsText: string): ParsedSMS | null {
    for (const pattern of SMS_PATTERNS) {
        const match = smsText.match(pattern.regex);
        if (!match) continue;

        let amount = 0;
        let type: "DEBIT" | "CREDIT" = "DEBIT";
        let accountNumber = "";
        let merchant = "";

        if (pattern.bank === "HDFC") {
            amount = parseFloat(match[1].replace(/,/g, ""));
            type = match[2].toLowerCase() === "credited" ? "CREDIT" : "DEBIT";
            accountNumber = match[3];
            merchant = match[4]?.trim() || "Unknown";
        } else if (pattern.bank === "SBI") {
            accountNumber = match[1];
            type = match[2].toLowerCase() === "credited" ? "CREDIT" : "DEBIT";
            amount = parseFloat(match[3].replace(/,/g, ""));
            merchant = "Unknown"; // SBI often puts it later, needs more complex parsing
        } else if (pattern.bank === "ICICI") {
            accountNumber = match[1];
            type = match[2].toLowerCase() === "credited" ? "CREDIT" : "DEBIT";
            amount = parseFloat(match[3].replace(/,/g, ""));
            merchant = match[4]?.trim() || "Unknown";
        }

        return {
            amount,
            type,
            accountNumber,
            merchant,
            rawText: smsText,
            bank: pattern.bank,
            date: new Date() // Ideally parse from regex too, simplifying for MVP
        };
    }

    // Generic fallback parser for UPI
    const genericMatch = smsText.match(/(?:Rs\.?|INR)\s*([\d,]+\.?\d*).*?(debited|credited).*?VPA\s*([^\s]+)/i);
    if (genericMatch) {
        return {
            amount: parseFloat(genericMatch[1].replace(/,/g, "")),
            type: genericMatch[2].toLowerCase() === "credited" ? "CREDIT" : "DEBIT",
            merchant: genericMatch[3],
            rawText: smsText,
            bank: "UPI Generic"
        };
    }

    return null;
}
