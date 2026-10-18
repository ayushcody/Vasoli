import { describe, it, expect } from "vitest";
import { parseUPIPassbook } from "./upi-passbook";

describe("parseUPIPassbook", () => {
    it("parses UPI passbook format correctly", () => {
        const csv = `
Date,Description,Transaction Type,Amount,Ref No
01-03-2026,Paid to Zomato,DEBIT,150.00,1234567
02-03-2026,Received from Friend,CREDIT,500.00,7654321
        `;
        const result = parseUPIPassbook(csv);
        expect(result).toHaveLength(2);
        expect(result[0].amount).toBe(150);
        expect(result[0].type).toBe("EXPENSE");
        expect(result[0].merchantNorm).toBe("paid to zomato");

        expect(result[1].amount).toBe(500);
        expect(result[1].type).toBe("INCOME");
        expect(result[1].merchantNorm).toBe("received from friend");
    });
});
