/**
 * Cashflow Gap Radar Engine
 *
 * Pure computation: given current balance, recurring rules, recent history,
 * produces a daily projection with safe-to-spend and gap day detection.
 */

export interface RecurringEvent {
    amount: number;
    type: "bill" | "income";
    cadence: string; // monthly | weekly | biweekly | quarterly | yearly
    nextDueDate: string;
    merchant?: string;
}

export interface CashflowInput {
    currentBalance: number;
    recurringRules: RecurringEvent[];
    daysToProject?: number;
    goalContributions?: number; // monthly total going toward goals
}

export interface DayProjection {
    date: string; // ISO date
    projectedBalance: number;
    events: { label: string; amount: number; type: "bill" | "income" | "goal" }[];
    isGapDay: boolean;
}

export interface CashflowResult {
    projections: DayProjection[];
    safeToSpendToday: number;
    minSafeBalance: number;
    gapDays: number;
    totalUpcomingBills: number;
    totalUpcomingIncome: number;
    forecastConfidence: "high" | "medium" | "low";
}

function normalizeRecurringType(type: string): "bill" | "income" {
    const normalized = type.trim().toLowerCase();
    if (normalized === "income") {
        return "income";
    }
    return "bill";
}

export function computeCashflow(input: CashflowInput): CashflowResult {
    const days = input.daysToProject || 60;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Expand recurring rules into daily events
    const dailyEvents: Map<string, DayProjection["events"]> = new Map();

    for (const rule of input.recurringRules) {
        const normalizedRuleType = normalizeRecurringType(rule.type);
        const occurrences = expandRecurring(rule, today, days);
        for (const occ of occurrences) {
            const key = occ.date;
            const existing = dailyEvents.get(key) || [];
            existing.push({
                label: rule.merchant || (normalizedRuleType === "bill" ? "Bill" : "Income"),
                amount: rule.amount,
                type: normalizedRuleType,
            });
            dailyEvents.set(key, existing);
        }
    }

    // Add monthly goal contribution if present
    if (input.goalContributions && input.goalContributions > 0) {
        const dailyGoal = input.goalContributions / 30;
        for (let d = 0; d < days; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() + d);
            const key = date.toISOString().slice(0, 10);
            const existing = dailyEvents.get(key) || [];
            existing.push({
                label: "Goal savings",
                amount: dailyGoal,
                type: "goal",
            });
            dailyEvents.set(key, existing);
        }
    }

    // Project daily balances
    let balance = input.currentBalance;
    const projections: DayProjection[] = [];
    let totalBills = 0;
    let totalIncome = 0;

    for (let d = 0; d < days; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const key = date.toISOString().slice(0, 10);
        const events = dailyEvents.get(key) || [];

        for (const e of events) {
            if (e.type === "income") {
                balance += e.amount;
                totalIncome += e.amount;
            } else {
                balance -= e.amount;
                totalBills += e.amount;
            }
        }

        projections.push({
            date: key,
            projectedBalance: Math.round(balance * 100) / 100,
            events,
            isGapDay: false, // computed below
        });
    }

    // Compute min safe balance (lowest point in projection)
    const minSafeBalance = Math.min(...projections.map((p) => p.projectedBalance));

    // Mark gap days (balance < 0 or < 10% of current)
    const gapThreshold = Math.max(0, input.currentBalance * 0.1);
    let gapDays = 0;
    for (const p of projections) {
        if (p.projectedBalance < gapThreshold) {
            p.isGapDay = true;
            gapDays++;
        }
    }

    // Safe to spend today = current balance - total upcoming bills + total upcoming income - safety margin
    const safetyMargin = totalBills * 0.1; // keep 10% buffer
    const safeToSpendToday = Math.max(
        0,
        Math.round((input.currentBalance - totalBills + totalIncome - safetyMargin) * 100) / 100
    );

    // Forecast confidence
    const hasBills = input.recurringRules.some((r) => normalizeRecurringType(r.type) === "bill");
    const hasIncome = input.recurringRules.some((r) => normalizeRecurringType(r.type) === "income");
    let forecastConfidence: "high" | "medium" | "low" = "low";
    if (hasBills && hasIncome) forecastConfidence = "high";
    else if (hasBills || hasIncome) forecastConfidence = "medium";

    return {
        projections,
        safeToSpendToday,
        minSafeBalance,
        gapDays,
        totalUpcomingBills: Math.round(totalBills * 100) / 100,
        totalUpcomingIncome: Math.round(totalIncome * 100) / 100,
        forecastConfidence,
    };
}

/** Apply a what-if scenario: spend ₹X on a date */
export function applyWhatIf(
    result: CashflowResult,
    spendAmount: number,
    spendDate: string
): CashflowResult {
    const modified = JSON.parse(JSON.stringify(result)) as CashflowResult;

    let applied = false;
    for (const p of modified.projections) {
        if (p.date >= spendDate && !applied) {
            p.projectedBalance -= spendAmount;
            p.events.push({ label: "What-if spend", amount: spendAmount, type: "bill" });
            applied = true;
        } else if (applied) {
            p.projectedBalance -= spendAmount;
        }
    }

    // Recalculate gap days
    const gapThreshold = Math.max(0, modified.projections[0]?.projectedBalance * 0.1 || 0);
    modified.gapDays = 0;
    for (const p of modified.projections) {
        p.isGapDay = p.projectedBalance < gapThreshold;
        if (p.isGapDay) modified.gapDays++;
    }

    modified.minSafeBalance = Math.min(...modified.projections.map((p) => p.projectedBalance));
    modified.safeToSpendToday = Math.max(0, modified.safeToSpendToday - spendAmount);

    return modified;
}

function expandRecurring(
    rule: RecurringEvent,
    from: Date,
    days: number
): { date: string; amount: number }[] {
    const results: { date: string; amount: number }[] = [];
    let current = new Date(rule.nextDueDate);
    const end = new Date(from);
    end.setDate(end.getDate() + days);

    // If nextDueDate is before today, advance it
    while (current < from) {
        current = advanceDate(current, rule.cadence);
    }

    while (current <= end) {
        results.push({
            date: current.toISOString().slice(0, 10),
            amount: rule.amount,
        });
        current = advanceDate(current, rule.cadence);
    }

    return results;
}

function advanceDate(date: Date, cadence: string): Date {
    const d = new Date(date);
    switch (cadence) {
        case "weekly":
            d.setDate(d.getDate() + 7);
            break;
        case "biweekly":
            d.setDate(d.getDate() + 14);
            break;
        case "monthly":
            d.setMonth(d.getMonth() + 1);
            break;
        case "quarterly":
            d.setMonth(d.getMonth() + 3);
            break;
        case "yearly":
            d.setFullYear(d.getFullYear() + 1);
            break;
        default:
            d.setMonth(d.getMonth() + 1);
    }
    return d;
}
