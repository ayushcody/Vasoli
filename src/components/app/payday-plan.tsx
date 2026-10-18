"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useGoals, useAccounts, usePaydayPlan, useUpdatePaydayPlan } from "@/lib/hooks";
import { useSetPaydayActionState } from "@/lib/hooks/use-pilot";
import { formatCurrency } from "@/lib/utils";
import { PaydayPlanConfig } from "@/gen/vasoli/v1/pilot_pb";

function rupees(paise: bigint | number) {
  return formatCurrency(Number(paise) / 100);
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function PaydayPlan({ planning = false }: { planning?: boolean }) {
  const [scenarioInput, setScenarioInput] = useState("");
  const [scenarioPaise, setScenarioPaise] = useState(0n);
  const plan = usePaydayPlan(scenarioPaise);
  const accounts = useAccounts();
  const goals = useGoals();
  const savePlan = useUpdatePaydayPlan();
  const setActionState = useSetPaydayActionState();
  const config = plan.data?.config;
  const [allowance, setAllowance] = useState("");
  const [payday, setPayday] = useState("");
  const [reserve, setReserve] = useState("");
  const [goalId, setGoalId] = useState("");
  const [goalReserve, setGoalReserve] = useState("");
  const [payingIds, setPayingIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!config || dirty) return;
    setAllowance((Number(config.dailyAllowancePaise) / 100).toString());
    setPayday(config.nextPayday || "");
    setReserve((Number(config.minimumReservePaise) / 100).toString());
    setGoalId(config.selectedGoalId || "");
    setGoalReserve((Number(config.goalReservedPaise) / 100).toString());
    setPayingIds([...config.payingAccountIds]);
  }, [config, dirty]);

  const eligibleAccounts = (accounts.data || []).filter((account) => account.currency === "INR" && ["CASH", "SAVINGS", "CURRENT", "WALLET"].includes(account.accountType));
  const selectedGoal = useMemo(() => goals.data?.find((goal) => goal.id === goalId), [goalId, goals.data]);
  const today = todayInIndia();
  const todayProjection = plan.data?.dayProjections.find((projection) => projection.date === today);
  const nextGap = plan.data?.dayProjections.find((projection) => Number(projection.closingBalancePaise) < 0);
  const actionTitle = (code: string) => code.startsWith("ACCOUNT_SHORTFALL") ? "Move money to the account that needs it" : code.startsWith("IMPORT_RECONCILIATION") ? "Review a statement difference" : ({ PLAN_NOT_CONFIGURED: "Set up your payday plan", NO_PAYING_ACCOUNTS: "Choose your paying accounts", STALE_BALANCE: "Confirm your current balances", UNASSIGNED_TRANSACTIONS: "Connect transactions to accounts", INVALID_PLAN: "Update your payday plan", POOLED_SHORTFALL: "Review an approaching shortfall" }[code] || "Review your plan");
  const visibleActions = (plan.data?.actions || []).filter((action) => {
    if (action.state === "COMPLETED" || action.state === "DISMISSED") return false;
    if (action.state === "SNOOZED" && action.snoozedUntil && action.snoozedUntil.toDate().getTime() > Date.now()) return false;
    return true;
  }).slice(0, 3);

  function snoozeUntilTomorrow() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(tomorrow);
    return new Date(`${date}T09:00:00+05:30`);
  }

  function toggleAccount(accountId: string) {
    setDirty(true);
    setPayingIds((current) => current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payday) return;
    setValidationError("");
    const toPaise = (raw: string) => {
      const amount = raw.trim() ? Number(raw) : 0;
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter zero or a positive amount for each plan value.");
      return BigInt(Math.round(amount * 100));
    };
    try {
      await savePlan.mutateAsync(new PaydayPlanConfig({
        dailyAllowancePaise: toPaise(allowance),
        nextPayday: payday,
        minimumReservePaise: toPaise(reserve),
        selectedGoalId: goalId || undefined,
        goalReservedPaise: goalId ? toPaise(goalReserve) : 0n,
        payingAccountIds: payingIds,
      }));
      setDirty(false);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : "The plan could not be saved. Retry.");
    }
  }

  if (plan.isLoading || accounts.isLoading || goals.isLoading) return <div className="neo-surface p-6 text-sm text-taupe" aria-live="polite">Loading payday position…</div>;
  if (plan.isError || accounts.isError || goals.isError) return <div className="neo-surface p-6" role="alert">
    <p className="font-semibold text-ink">Payday position could not be loaded.</p>
    <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => { void plan.refetch(); void accounts.refetch(); void goals.refetch(); }}>Try again</button>
  </div>;

  return <div className="space-y-6">
    <section className="neo-surface-lg p-6">
      <h1 className="text-3xl font-bold text-ink">{planning ? "Payday planning" : "Today"}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-taupe">A payday position from the balances, bills, and spending plan you have recorded. Estimates can miss unrecorded everyday spending.</p>
      {!plan.data?.actionable ? <div className="mt-5 rounded-neo border-brutal bg-warning/10 p-4 text-sm text-ink">
        <strong>Review your inputs before relying on this plan.</strong>
        <ul className="mt-2 list-inside list-disc space-y-1">{(plan.data?.warnings || []).slice(0, 3).map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>
      </div> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-taupe">Daily allowance</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink">{rupees(config?.dailyAllowancePaise || 0n)}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-taupe">Next payday</p><p className="mt-1 text-2xl font-bold text-ink">{config?.nextPayday || "Not set"}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-taupe">Additional spending room</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink">{plan.data?.actionable && todayProjection ? rupees(todayProjection.safeToSpendPaise) : "Confirm inputs"}</p></div>
      </div>
      <p className="mt-4 text-xs leading-5 text-taupe">The estimate protects your daily allowance, minimum reserve and selected goal until the day before payday. Everyday spending is reserved from pooled cash; individual account forecasts cover account-linked bills and recorded movements. Future salary is excluded. Unrecorded spending and unconfirmed bills can change it.</p>
      {plan.data?.accounts.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{plan.data.accounts.map((account) => <div key={account.accountId} className="rounded-neo border-brutal bg-paper-1 p-3"><p className="font-semibold text-sm">{account.accountName}</p><p className="mt-1 text-sm text-taupe">Confirmed {rupees(account.confirmedBalancePaise)} · lowest projected {rupees(account.lowestProjectedBalancePaise)}</p><p className="mt-1 text-xs text-taupe">Balance as of {account.balanceAsOf ? account.balanceAsOf.toDate().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Not confirmed"}</p></div>)}</div> : null}
      {plan.data?.firstPooledShortfallDate ? <p className="mt-3 text-sm text-danger">Your protected reserve is first breached on {plan.data.firstPooledShortfallDate}.</p> : null}
      <p className="mt-3 text-sm text-taupe">Lowest projected pooled cash: {rupees(plan.data?.lowestPooledBalancePaise || 0n)}</p>
      {nextGap ? <p className="mt-4 rounded-neo bg-danger/10 px-4 py-3 text-sm text-ink">Recorded commitments project a negative balance by {nextGap.date}. Review the bills or account balances below.</p> : null}
    </section>

    <section className="neo-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold text-ink">Next useful steps</h2><p className="mt-1 text-sm text-taupe">Resolve the inputs that most affect your payday plan.</p></div>
        <div className="flex gap-3 text-sm font-semibold"><Link className="underline underline-offset-4" href="/app/settings">Confirm balances</Link><Link className="underline underline-offset-4" href="/app/transactions">Review Activity</Link><Link className="underline underline-offset-4" href="/app/obligations">Review bills</Link></div>
      </div>
      <div className="mt-4 space-y-3">
        {visibleActions.map((action, index) => <div key={action.actionId} className="flex flex-col items-stretch gap-3 rounded-neo border-brutal bg-paper-1 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-paper-2 text-sm font-bold text-ink">{index + 1}</span><div><p className="font-semibold text-ink">{actionTitle(action.title)}</p><Link className="text-xs font-semibold underline" href={action.actionId.includes("plan_not_configured") || action.actionId.includes("invalid_plan") ? "/app/cashflow" : action.actionId.includes("balance") || action.actionId.includes("account") ? "/app/settings" : action.actionId.includes("shortfall") ? "/app/obligations" : "/app/transactions"}>Review</Link><p className="mt-1 text-sm text-taupe">{action.description}</p></div></div>
          <div className="flex flex-wrap gap-2 sm:shrink-0"><button type="button" onClick={() => setActionState.mutate({ actionId: action.actionId, state: "COMPLETED" })} disabled={setActionState.isPending} className="rounded-neo border-brutal bg-paper-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Done</button><button type="button" onClick={() => setActionState.mutate({ actionId: action.actionId, state: "SNOOZED", snoozeUntil: snoozeUntilTomorrow() })} disabled={setActionState.isPending} className="rounded-neo border-brutal bg-paper-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Snooze 1 day</button><button type="button" onClick={() => setActionState.mutate({ actionId: action.actionId, state: "DISMISSED" })} disabled={setActionState.isPending} className="rounded-neo border-brutal bg-paper-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Dismiss</button></div>
        </div>)}
        {!visibleActions.length && plan.data?.actionable ? <p className="rounded-neo border-brutal bg-paper-1 p-4 text-sm text-ink">No open actions right now. Keep Activity and bills up to date as the month changes.</p> : null}
        {setActionState.isError ? <p className="text-sm text-danger" role="alert">That action could not be updated. Retry when connected.</p> : null}
      </div>
    </section>

    {planning ? <>
    <section className="neo-surface p-5">
      <h2 className="text-xl font-bold text-ink">Try an extra expense</h2>
      <p className="mt-1 text-sm text-taupe">Preview an additional expense today using the same payday calculation. This does not save a transaction or change your plan.</p>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const value = Number(scenarioInput); if (Number.isFinite(value) && value >= 0 && value <= 100000000) setScenarioPaise(BigInt(Math.round(value * 100))); }}>
        <label className="text-sm font-medium">Extra expense (₹)<input className="mt-1 block rounded-neo border-brutal bg-paper-1 px-3 py-2" type="number" min="0" max="100000000" step="0.01" value={scenarioInput} onChange={(event) => setScenarioInput(event.target.value)} /></label>
        <button className="rounded-neo border-brutal bg-paper-2 px-4 py-2 text-sm font-semibold">Preview expense</button>
        {scenarioPaise > 0n ? <button type="button" className="text-sm underline" onClick={() => { setScenarioPaise(0n); setScenarioInput(""); }}>Clear scenario</button> : null}
      </form>
      {scenarioPaise > 0n ? <p className="mt-3 text-sm font-semibold" role="status">Scenario active: the figures above include {rupees(scenarioPaise)} extra spending today.</p> : null}
    </section>

    <section className="neo-surface p-5">
      <h2 className="text-xl font-bold text-ink">Payday plan</h2>
      <p className="mt-1 text-sm text-taupe">Set the date, day-to-day allowance, protected reserve, goal contribution, and accounts used for this plan.</p>
      <form onSubmit={submit} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink">Next payday<input required type="date" min={today} value={payday} onChange={(e) => { setDirty(true); setPayday(e.target.value); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>
          <label className="text-sm font-medium text-ink">Daily spending allowance (₹)<input min="0" step="0.01" type="number" inputMode="decimal" value={allowance} onChange={(e) => { setDirty(true); setAllowance(e.target.value); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>
          <label className="text-sm font-medium text-ink">Minimum reserve (₹)<input min="0" step="0.01" type="number" inputMode="decimal" value={reserve} onChange={(e) => { setDirty(true); setReserve(e.target.value); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>
          <label className="text-sm font-medium text-ink">Goal to reserve for<select value={goalId} onChange={(e) => { setDirty(true); setGoalId(e.target.value); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="">No goal selected</option>{(goals.data || []).filter((goal) => goal.status === "ACTIVE").map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label>
          {goalId ? <label className="text-sm font-medium text-ink">Goal amount reserved (₹)<input min="0" step="0.01" type="number" inputMode="decimal" value={goalReserve} onChange={(e) => { setDirty(true); setGoalReserve(e.target.value); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" />{selectedGoal ? <span className="mt-1 block text-xs text-taupe">For {selectedGoal.name}; this is a plan reserve, not a transfer.</span> : null}</label> : null}
        </div>
        <fieldset><legend className="text-sm font-semibold text-ink">Accounts included in this plan</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{eligibleAccounts.map((account) => <label key={account.id} className="flex items-center gap-2 rounded-neo border-brutal bg-paper-1 p-3 text-sm text-ink"><input type="checkbox" checked={payingIds.includes(account.id)} onChange={() => toggleAccount(account.id)} />{account.accountName} · {rupees(account.balancePaise)}</label>)}</div>{!eligibleAccounts.length ? <p className="mt-2 text-sm text-taupe">Add an INR cash or bank account in <Link className="underline" href="/app/settings">Settings</Link>.</p> : null}</fieldset>
        {validationError || savePlan.isError ? <p className="text-sm text-danger" role="alert">{validationError || "The plan was not saved. Check the fields and retry."}</p> : null}
        {savePlan.isSuccess ? <p className="text-sm text-success" role="status">Payday plan saved.</p> : null}
        <button disabled={savePlan.isPending || !payday} className="rounded-neo border-brutal-thick bg-cta px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">{savePlan.isPending ? "Saving…" : "Save payday plan"}</button>
      </form>
    </section>
    </> : <Link className="inline-flex w-fit rounded-neo border-brutal bg-cta px-5 py-3 text-sm font-semibold" href="/app/cashflow">{config?.nextPayday ? "Review or edit payday plan" : "Set up payday plan"}</Link>}
  </div>;
}
