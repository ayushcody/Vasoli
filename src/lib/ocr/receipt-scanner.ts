/**
 * Receipt OCR Scanner — wraps Tesseract.js for local-first OCR.
 * Extracts structured fields from receipt images.
 */

import Tesseract from "tesseract.js";

export interface ReceiptData {
    merchant: string | null;
    amount: number | null;
    date: string | null;
    items: string[];
    returnBy: string | null;
    warrantyUntil: string | null;
    rawText: string;
}

export async function scanReceipt(imageFile: File): Promise<ReceiptData> {
    const {
        data: { text },
    } = await Tesseract.recognize(imageFile, "eng", {
        logger: () => { },
    });

    return extractReceiptFields(text);
}

export function extractReceiptFields(text: string): ReceiptData {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    const result: ReceiptData = {
        merchant: null,
        amount: null,
        date: null,
        items: [],
        returnBy: null,
        warrantyUntil: null,
        rawText: text,
    };

    // Merchant: usually first non-empty line
    if (lines.length > 0) {
        result.merchant = lines[0];
    }

    // Amount: look for total/grand total/amount patterns
    for (const line of lines) {
        const totalMatch = line.match(
            /(?:total|grand\s*total|amount|amt|net\s*amount|payable)[:\s]*[₹$]?\s*([\d,]+\.?\d{0,2})/i
        );
        if (totalMatch) {
            const val = parseFloat(totalMatch[1].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) {
                result.amount = val;
            }
        }
    }

    // If no total found, look for largest currency amount
    if (!result.amount) {
        let maxAmount = 0;
        for (const line of lines) {
            const amounts = line.match(/[₹$]?\s*([\d,]+\.\d{2})/g);
            if (amounts) {
                for (const a of amounts) {
                    const val = parseFloat(a.replace(/[₹$,\s]/g, ""));
                    if (val > maxAmount) maxAmount = val;
                }
            }
        }
        if (maxAmount > 0) result.amount = maxAmount;
    }

    // Date: look for common date patterns
    for (const line of lines) {
        const dateMatch = line.match(
            /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})/
        );
        if (dateMatch) {
            result.date = dateMatch[1];
            break;
        }
    }

    // Return policy
    for (const line of lines) {
        const returnMatch = line.match(
            /(?:return|exchange|refund)\s*(?:by|within|before|policy)[:\s]*(\d+\s*days?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
        );
        if (returnMatch) {
            result.returnBy = returnMatch[1];
            break;
        }
    }

    // Warranty
    for (const line of lines) {
        const warrantyMatch = line.match(
            /(?:warranty|guarantee)[:\s]*(\d+\s*(?:months?|years?|days?)|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
        );
        if (warrantyMatch) {
            result.warrantyUntil = warrantyMatch[1];
            break;
        }
    }

    // Items: lines that look like line items (contain a price)
    for (const line of lines) {
        if (line.match(/^\d+\s*[xX×]\s*/) || line.match(/\s+\d+\.\d{2}$/)) {
            result.items.push(line);
        }
    }

    return result;
}
