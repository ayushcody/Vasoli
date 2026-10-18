import { describe, expect, it } from "vitest";

import { computeCashflow, applyWhatIf, simulateIncomeDelay, simulateNewSubscription } from "./cashflow";

describe("computeCashflow", () => {
  const today = new Date("2026-01-01T00:00:00.000Z");
  const todayIso = today.toISOString();

  it("treats income events as incoming cash even when callers pass uppercase types", () => {
    const result = computeCashflow({
      startDate: todayIso,
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
      startDate: todayIso,
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
  it("computes minimum safe balance and risk reasons", () => {
    const result = computeCashflow({
      startDate: todayIso,
      currentBalance: 1000,
      daysToProject: 2,
      minimumSafeBalance: 800,
      recurringRules: [
        {
          amount: 500,
          type: "bill",
          cadence: "monthly",
          nextDueDate: todayIso,
          merchant: "Rent",
        },
      ],
    });

    expect(result.safeToSpendToday).toBe(0); // 1000 - 500 - 850 < 0
    expect(result.minSafeBalance).toBe(500);
    expect(result.riskReasons).toContain("Projected balance falls below minimum safe threshold.");
    expect(result.riskReasons.some(r => r.includes("gap days detected"))).toBe(true);
  });

  it("simulates a major purchase", () => {
    const base = computeCashflow({
      startDate: todayIso,
      currentBalance: 1000,
      daysToProject: 2,
      recurringRules: [],
    });

    const sim = applyWhatIf(base, 300, todayIso);
    expect(sim.projections[0]?.projectedBalance).toBe(700);
    expect(sim.safeToSpendToday).toBe(600); // retain the low-balance reserve
  });
});


describe("forecast calendar and liquidity safety", () => {
  const startDate = "2026-01-01";
  it("does not fund today's spending with later income", () => {
    const result = computeCashflow({ currentBalance: 1000, startDate, daysToProject: 10, recurringRules: [
      { amount: 900, type: "bill", cadence: "monthly", nextDueDate: "2026-01-02" },
      { amount: 10000, type: "income", cadence: "monthly", nextDueDate: "2026-01-05" },
    ] });
    expect(result.minSafeBalance).toBe(100);
    expect(result.safeToSpendToday).toBe(0);
  });
  it("never spends more than the currently available balance", () => {
    const result = computeCashflow({ currentBalance: 100, startDate, daysToProject: 2, recurringRules: [
      { amount: 10000, type: "income", cadence: "monthly", nextDueDate: startDate },
    ] });
    expect(result.safeToSpendToday).toBe(90);
  });
  it("treats signed RPC bill amounts as outgoing", () => {
    const result = computeCashflow({ currentBalance: 1000, startDate, daysToProject: 1, recurringRules: [
      { amount: -200, type: "bill", cadence: "monthly", nextDueDate: startDate },
    ] });
    expect(result.projections[0].projectedBalance).toBe(800);
  });
  it("retains month-end recurrence anchors and exactly the requested horizon", () => {
    const result = computeCashflow({ currentBalance: 1000, startDate: "2026-01-31", daysToProject: 61, recurringRules: [
      { amount: 100, type: "bill", cadence: "monthly", nextDueDate: "2025-12-31" },
    ] });
    expect(result.projections.filter(p => p.events.length).map(p => p.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(result.projections).toHaveLength(61);
  });
  it("does not drop an event due today in an Indian timezone", () => {
    const result = computeCashflow({ currentBalance: 1000, startDate, daysToProject: 1, recurringRules: [
      { amount: 100, type: "bill", cadence: "monthly", nextDueDate: "2026-01-01T00:00:00Z" },
    ] });
    expect(result.projections[0].date).toBe(startDate);
    expect(result.totalUpcomingBills).toBe(100);
  });
  it("recalculates scenario warnings and preserves the reserve threshold", () => {
    const base = computeCashflow({ currentBalance: 1000, minimumSafeBalance: 800, startDate, daysToProject: 2, recurringRules: [] });
    const result = applyWhatIf(base, 300, startDate);
    expect(result.gapDays).toBe(2);
    expect(result.riskReasons).toContain("Projected balance falls below minimum safe threshold.");
    expect(base.gapDays).toBe(0);
    expect(applyWhatIf(base, 300, "2027-01-01")).toEqual(base);
  });
  it("honors a weekly subscription cadence and recalculates all totals", () => {
    const base = computeCashflow({ currentBalance: 1000, startDate, daysToProject: 15, recurringRules: [] });
    const result = simulateNewSubscription(base, 100, startDate, "weekly");
    expect(result.totalUpcomingBills).toBe(300);
    expect(result.minSafeBalance).toBe(700);
    expect(result.safeToSpendToday).toBe(600);
    expect(base.totalUpcomingBills).toBe(0);
  });
  it("moves income without counting it twice or inventing a bill", () => {
    const base = computeCashflow({ currentBalance: 100, startDate, daysToProject: 10, recurringRules: [
      { amount: 1000, type: "income", cadence: "monthly", nextDueDate: startDate },
    ] });
    const result = simulateIncomeDelay(base, 1000, startDate, "2026-01-05");
    expect(result.projections[0].projectedBalance).toBe(100);
    expect(result.projections[4].projectedBalance).toBe(1100);
    expect(result.totalUpcomingIncome).toBe(1000);
    expect(result.totalUpcomingBills).toBe(0);
    expect(result.safeToSpendToday).toBe(90);
  });
  it("rejects invalid dates, horizons and amounts instead of returning NaN", () => {
    const base = { currentBalance: 1000, startDate, recurringRules: [] };
    expect(() => computeCashflow({ ...base, daysToProject: 0 })).toThrow();
    expect(() => computeCashflow({ ...base, daysToProject: Infinity })).toThrow();
    expect(() => computeCashflow({ ...base, currentBalance: NaN })).toThrow();
    expect(() => computeCashflow({ ...base, startDate: "2026-02-30" })).toThrow();
  });
});

it("supports daily rules accepted by the backend", () => {
  const result = computeCashflow({ currentBalance: 1000, startDate: "2026-01-01", daysToProject: 3, recurringRules: [
    { amount: 100, type: "bill", cadence: "daily", nextDueDate: "2025-01-01" },
  ] });
  expect(result.projections.map(p => p.projectedBalance)).toEqual([900, 800, 700]);
  expect(result.totalUpcomingBills).toBe(300);
});

it("honors snoozes without shifting the original recurrence anchor", () => {
  const result = computeCashflow({ currentBalance: 1000, startDate: "2026-01-01", daysToProject: 15, recurringRules: [
    { amount: 100, type: "bill", cadence: "weekly", nextDueDate: "2026-01-01", notBefore: "2026-01-04" },
  ] });
  expect(result.projections.filter(p => p.events.length).map(p => p.date)).toEqual(["2026-01-08", "2026-01-15"]);
});

it("does not re-expand occurrences that the server has already expanded", () => {
  const result = computeCashflow({ currentBalance: 1000, startDate: "2026-01-01", daysToProject: 60, recurringRules: [
    { amount: 100, type: "bill", cadence: "once", nextDueDate: "2026-01-01" },
    { amount: 100, type: "bill", cadence: "once", nextDueDate: "2026-02-01" },
  ] });
  expect(result.totalUpcomingBills).toBe(200);
});
