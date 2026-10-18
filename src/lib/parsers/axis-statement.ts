import { parseGenericCSV } from "./csv-generic";
import type { ParsedTransaction } from "./merchant";

export function parseAxisStatement(csvText: string): ParsedTransaction[] {
    return parseGenericCSV(csvText, {
        date: "Tran Date",
        description: "Particulars",
        debit: "Debit",
        credit: "Credit"
    });
}
