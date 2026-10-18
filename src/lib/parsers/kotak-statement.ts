import { parseGenericCSV } from "./csv-generic";
import type { ParsedTransaction } from "./merchant";

export function parseKotakStatement(csvText: string): ParsedTransaction[] {
    return parseGenericCSV(csvText, {
        date: "Date",
        description: "Narration",
        debit: "Withdrawal",
        credit: "Deposit"
    });
}
