import { parseGenericCSV } from "./csv-generic";
import type { ParsedTransaction } from "./merchant";

export function parseICICIStatement(csvText: string): ParsedTransaction[] {
    return parseGenericCSV(csvText, {
        date: "Date",
        description: "Narration",
        debit: "Withdrawal",
        credit: "Deposit"
    });
}
