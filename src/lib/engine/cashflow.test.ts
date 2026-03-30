import { describe, expect, it } from "vitest";

import { computeCashflow } from "./cashflow";

describe("computeCashflow", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  it("treats income events as incoming cash even when callers pass uppercase types", () => {
    const result = computeCashflow({
      currentBalance: 1000,
      daysToProject: 2,
      recurringRules: [
        {
          amount: 500,
          type: "INCOME" as unknown as "income",
          cadence: "monthly",
          nextDueDate: todayIso,
          merchant: "Salary",
        },
      ],
    });

    expect(result.projections[0]?.projectedBalance).toBe(1500);
    expect(result.totalUpcomingIncome).toBe(500);
    expect(result.totalUpcomingBills).toBe(0);
  });

  it("decreases projected balance for bill events", () => {
    const result = computeCashflow({
      currentBalance: 1000,
      daysToProject: 2,
      recurringRules: [
        {
          amount: 250,
          type: "bill",
          cadence: "monthly",
          nextDueDate: todayIso,
          merchant: "Rent",
        },
      ],
    });

    expect(result.projections[0]?.projectedBalance).toBe(750);
    expect(result.totalUpcomingBills).toBe(250);
    expect(result.totalUpcomingIncome).toBe(0);
  });
});
