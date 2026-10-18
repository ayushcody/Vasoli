import { parseGenericCSV } from "./csv-generic";
import type { ParsedTransaction } from "./merchant";

export function parseUPIPassbook(csvText: string): ParsedTransaction[] {
    return parseGenericCSV(csvText, {
        date: "Date",
        description: "Description",
        amount: "Amount",
        type: "Transaction Type"
    });
}
