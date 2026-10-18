import { parseGenericCSV } from "./csv-generic";
import type { ParsedTransaction } from "./merchant";

export function parseSBIStatement(csvText: string): ParsedTransaction[] {
    return parseGenericCSV(csvText, {
        date: "Txn Date",
        description: "Description",
        debit: "Debit",
        credit: "Credit"
    });
}
