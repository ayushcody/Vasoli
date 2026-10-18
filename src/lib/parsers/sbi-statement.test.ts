import { describe, it, expect } from "vitest";
import { parseSBIStatement } from "./sbi-statement";

describe("parseSBIStatement", () => {
    it("parses SBI statement format correctly", () => {
        const csv = `
Txn Date,Description,Ref No,Debit,Credit,Balance
01-03-2026,UPI/ZOMATO/1234567,1234567,150.00,,5000.00
02-03-2026,SALARY,7654321,,20000.00,25000.00
        `;
        const result = parseSBIStatement(csv);
        expect(result).toHaveLength(2);
        expect(result[0].amount).toBe(150);
        expect(result[0].type).toBe("EXPENSE");
        expect(result[0].merchantNorm).toBe("zomato");

        expect(result[1].amount).toBe(20000);
        expect(result[1].type).toBe("INCOME");
    });
});
