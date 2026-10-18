/** Calendar-day cashflow estimates from recorded recurring events, not a spending guarantee. */
export interface RecurringEvent {
    amount: number;
    type: "bill" | "income";
    cadence: string;
    nextDueDate: string;
    notBefore?: string;
    merchant?: string;
}
export interface CashflowInput {
    currentBalance: number;
    recurringRules: RecurringEvent[];
    daysToProject?: number;
    goalContributions?: number;
    minimumSafeBalance?: number;
    /** Injectable calendar start for repeatable forecasts. Defaults to the user's local day. */
    startDate?: string;
}
export interface DayProjection {
    date: string;
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
    riskReasons: string[];
    currentBalance?: number;
    minimumSafeBalance?: number;
    gapThreshold?: number;
}
const round = (value: number) => Math.round(value * 100) / 100;
function calendarDate(value: string): Date {
    const day = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Expected an ISO calendar date.");
    const date = new Date(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
        throw new Error("Invalid calendar date.");
    }
    return date;
}
function todayDay(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function money(value: number, name: string, allowNegative = false): number {
    if (!Number.isFinite(value) || (!allowNegative && value < 0)) throw new Error(`${name} must be a finite ${allowNegative ? "number" : "non-negative number"}.`);
    return value;
}

/** Recurrences retain the original day: January 31 -> February 28 -> March 31. */
function occurrences(rule: RecurringEvent, from: string, end: string): string[] {
    const anchor = calendarDate(rule.nextDueDate);
    const cadence = rule.cadence.trim().toLowerCase();
    if (cadence === "once") {
        const date = anchor.toISOString().slice(0, 10);
        return date >= from && date < end ? [date] : [];
    }
    const intervalDays = cadence === "daily" ? 1 : cadence === "weekly" ? 7 : cadence === "biweekly" ? 14 : 0;
    const intervalMonths = ({ monthly: 1, quarterly: 3, yearly: 12 } as Record<string, number>)[cadence];
    if (!intervalDays && !intervalMonths) throw new Error(`Unsupported recurring cadence: ${rule.cadence}`);
    const start = calendarDate(from);
    // Jump near the forecast start instead of walking years of historical occurrences.
    let index = intervalDays
        ? Math.max(0, Math.floor((start.getTime() - anchor.getTime()) / (86400000 * intervalDays)))
        : Math.max(0, Math.floor(((start.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + start.getUTCMonth() - anchor.getUTCMonth()) / intervalMonths));
    const dates: string[] = [];
    for (;; index++) {
        const next = new Date(anchor);
        if (intervalDays) next.setUTCDate(anchor.getUTCDate() + index * intervalDays);
        else {
            next.setUTCDate(1);
            next.setUTCMonth(anchor.getUTCMonth() + index * intervalMonths);
            const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
            next.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
        }
        const key = next.toISOString().slice(0, 10);
        if (key >= end) break;
        if (key >= from) dates.push(key);
    }
    return dates;
}

function summarize(result: CashflowResult): CashflowResult {
    const current = result.currentBalance ?? result.projections[0]?.projectedBalance ?? 0;
    const reserve = result.minimumSafeBalance ?? 0;
    const threshold = result.gapThreshold ?? Math.max(reserve, current * 0.1);
    result.minSafeBalance = result.projections.length ? Math.min(...result.projections.map(p => p.projectedBalance)) : current;
    result.gapDays = 0;
    result.totalUpcomingBills = 0;
    result.totalUpcomingIncome = 0;
    for (const day of result.projections) {
        day.isGapDay = day.projectedBalance < threshold;
        if (day.isGapDay) result.gapDays++;
        for (const event of day.events) {
            if (event.type === "income") result.totalUpcomingIncome += event.amount;
            else if (event.type === "bill") result.totalUpcomingBills += event.amount;
        }
    }
    result.totalUpcomingBills = round(result.totalUpcomingBills);
    result.totalUpcomingIncome = round(result.totalUpcomingIncome);
    // Spending now reduces every future balance: the lowest point limits today's headroom.
    // Never count money that is not currently available as spendable today.
    const margin = Math.max(threshold, result.totalUpcomingBills * 0.1 + reserve);
    result.safeToSpendToday = Math.max(0, round(Math.min(current, result.minSafeBalance) - margin));
    result.riskReasons = [];
    if (result.minSafeBalance < reserve) result.riskReasons.push("Projected balance falls below minimum safe threshold.");
    if (result.gapDays) result.riskReasons.push(`High risk: ${result.gapDays} gap days detected in the next ${result.projections.length} days.`);
    if (result.totalUpcomingBills > current + result.totalUpcomingIncome) result.riskReasons.push("Upcoming obligations exceed current balance and expected income.");
    return result;
}

export function computeCashflow(input: CashflowInput): CashflowResult {
    const days = input.daysToProject ?? 60;
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Forecast horizon must be between 1 and 366 days.");
    const currentBalance = money(input.currentBalance, "Current balance", true);
    const reserve = money(input.minimumSafeBalance ?? 0, "Minimum safe balance");
    const goal = money(input.goalContributions ?? 0, "Goal contributions");
    const from = calendarDate(input.startDate ?? todayDay());
    const end = new Date(from);
    end.setUTCDate(end.getUTCDate() + days);
    const events = new Map<string, DayProjection["events"]>();
    let hasBills = false, hasIncome = false;
    for (const rule of input.recurringRules) {
        // RPC amounts may be signed; direction is determined exclusively by the rule type.
        const amount = Math.abs(money(rule.amount, "Recurring amount", true));
        const type = rule.type.trim().toLowerCase() === "income" ? "income" : "bill";
        const notBefore = rule.notBefore ? calendarDate(rule.notBefore).toISOString().slice(0, 10) : "";
        for (const date of occurrences(rule, from.toISOString().slice(0, 10), end.toISOString().slice(0, 10))) {
            if (notBefore && date < notBefore) continue;
            events.set(date, [...(events.get(date) ?? []), { label: rule.merchant || (type === "income" ? "Income" : "Bill"), amount, type }]);
            if (amount > 0) { if (type === "income") hasIncome = true; else hasBills = true; }
        }
    }
    let balance = currentBalance;
    const projections: DayProjection[] = [];
    for (let d = 0; d < days; d++) {
        const date = new Date(from);
        date.setUTCDate(date.getUTCDate() + d);
        const key = date.toISOString().slice(0, 10);
        const dailyEvents = events.get(key) ?? [];
        if (goal) dailyEvents.push({ label: "Goal savings", amount: goal / 30, type: "goal" });
        for (const event of dailyEvents) balance += event.type === "income" ? event.amount : -event.amount;
        projections.push({ date: key, projectedBalance: round(balance), events: dailyEvents, isGapDay: false });
    }
    return summarize({ projections, currentBalance, minimumSafeBalance: reserve, gapThreshold: Math.max(reserve, currentBalance * 0.1), safeToSpendToday: 0, minSafeBalance: 0, gapDays: 0, totalUpcomingBills: 0, totalUpcomingIncome: 0, forecastConfidence: hasBills && hasIncome ? "high" : hasBills || hasIncome ? "medium" : "low", riskReasons: [] });
}

function scenario(result: CashflowResult, changes: { date: string; amount: number; label: string; type: "bill" | "income" }[]): CashflowResult {
    const modified = structuredClone(result);
    for (const change of changes) {
        const key = calendarDate(change.date).toISOString().slice(0, 10);
        const amount = money(change.amount, "Scenario amount");
        const first = modified.projections.findIndex(p => p.date >= key);
        if (first < 0) continue;
        modified.projections[first].events.push({ label: change.label, amount, type: change.type });
        for (let i = first; i < modified.projections.length; i++) modified.projections[i].projectedBalance = round(modified.projections[i].projectedBalance + (change.type === "income" ? amount : -amount));
    }
    return summarize(modified);
}
export function applyWhatIf(result: CashflowResult, spendAmount: number, spendDate: string): CashflowResult {
    return scenario(result, [{ date: spendDate, amount: money(spendAmount, "Spend amount"), label: "What-if spend", type: "bill" }]);
}
export function simulateMajorPurchase(result: CashflowResult, amount: number, date: string): CashflowResult {
    return applyWhatIf(result, amount, date);
}
export function simulateIncomeDelay(result: CashflowResult, incomeAmount: number, oldDate: string, newDate: string): CashflowResult {
    if (calendarDate(newDate) < calendarDate(oldDate)) throw new Error("Delayed income date must not precede the original date.");
    money(incomeAmount, "Income amount");
    const modified = structuredClone(result);
    const originalDay = calendarDate(oldDate).toISOString().slice(0, 10);
    const index = modified.projections.findIndex(p => p.date === originalDay);
    const eventIndex = index < 0 ? -1 : modified.projections[index].events.findIndex(e => e.type === "income" && e.amount === incomeAmount);
    if (eventIndex < 0) throw new Error("No matching income event exists on the original date.");
    modified.projections[index].events.splice(eventIndex, 1);
    for (let i = index; i < modified.projections.length; i++) modified.projections[i].projectedBalance = round(modified.projections[i].projectedBalance - incomeAmount);
    return scenario(modified, [{ date: newDate, amount: incomeAmount, label: "Delayed income received", type: "income" }]);
}
export function simulateNewSubscription(result: CashflowResult, amount: number, startDate: string, cadence = "monthly"): CashflowResult {
    money(amount, "Subscription amount");
    if (!result.projections.length) return structuredClone(result);
    const end = calendarDate(result.projections[result.projections.length - 1].date);
    end.setUTCDate(end.getUTCDate() + 1);
    return scenario(result, occurrences({ amount, type: "bill", nextDueDate: startDate, cadence }, result.projections[0].date, end.toISOString().slice(0, 10)).map(date => ({ date, amount, label: "New subscription", type: "bill" })));
}
