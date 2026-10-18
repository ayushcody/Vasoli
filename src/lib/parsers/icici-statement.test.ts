import { describe, it, expect } from "vitest";
import { parseICICIStatement } from "./icici-statement";

describe("parseICICIStatement", () => {
    it("parses ICICI statement format correctly", () => {
        const csv = `
Date,Narration,Withdrawal,Deposit,Closing Balance
01/03/2026,UPI-ZOMATO@paytm,150.00,,5000.00
02/03/2026,SALARY,,20000.00,25000.00
        `;
        const result = parseICICIStatement(csv);
        expect(result).toHaveLength(2);
        expect(result[0].amount).toBe(150);
        expect(result[0].type).toBe("EXPENSE");
        expect(result[0].merchantRaw).toBe("UPI-ZOMATO@paytm");

        expect(result[1].amount).toBe(20000);
        expect(result[1].type).toBe("INCOME");
    });
});
