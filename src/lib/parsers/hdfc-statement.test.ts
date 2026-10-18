import { describe, expect, it } from "vitest";

import { parseHDFCStatement } from "./hdfc-statement";

describe("parseHDFCStatement", () => {
  it("parses debit and credit rows into typed transactions", () => {
    const csv = [
      "Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance",
      "01/03/26,UPI-SWIGGY-SWIGGY@PAYTM,01/03/26,159.00,,000012345678,5432.10",
      "02/03/26,NEFT-ACME PAYROLL,02/03/26,,25000.00,000045678901,30432.10",
    ].join("\n");

    const parsed = parseHDFCStatement(csv);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      amount: 159,
      type: "EXPENSE",
      merchantRaw: "UPI-SWIGGY-SWIGGY@PAYTM",
      upiRef: "000012345678",
    });
    expect(parsed[0]?.date.getFullYear()).toBe(2026);
    expect(parsed[0]?.date.getMonth()).toBe(2);
    expect(parsed[0]?.date.getDate()).toBe(1);

    expect(parsed[1]).toMatchObject({
      amount: 25000,
      type: "INCOME",
      merchantRaw: "NEFT-ACME PAYROLL",
      upiRef: "000045678901",
    });
    expect(parsed[1]?.date.getFullYear()).toBe(2026);
    expect(parsed[1]?.date.getMonth()).toBe(2);
    expect(parsed[1]?.date.getDate()).toBe(2);
  });
});
