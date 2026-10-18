import { describe, expect, it } from "vitest";
import { getRecordedLiquidity } from "./liquidity";

describe("recorded forecast liquidity", () => {
    it("sums rupee liquid accounts, retaining negative balances", () => {
        expect(getRecordedLiquidity([
            { accountType: "SAVINGS", currency: "INR", balancePaise: BigInt(100050) },
            { accountType: "CURRENT", currency: "INR", balancePaise: BigInt(-20000) },
            { accountType: "CASH", currency: "INR", balancePaise: BigInt(100) },
        ])).toEqual({ balance: 801.5, accountCount: 3 });
    });
    it("excludes investments, credit limits, and foreign currency without inventing exchange rates", () => {
        expect(getRecordedLiquidity([
            { accountType: "BROKERAGE", currency: "INR", balancePaise: BigInt(900000) },
            { accountType: "CREDIT_CARD", currency: "INR", balancePaise: BigInt(100000) },
            { accountType: "SAVINGS", currency: "USD", balancePaise: BigInt(10000) },
        ])).toEqual({ balance: 0, accountCount: 0 });
    });
    it("does not treat an absent account as a known zero balance", () => {
        expect(getRecordedLiquidity([]).accountCount).toBe(0);
    });
});
