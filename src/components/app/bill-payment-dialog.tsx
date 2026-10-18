"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePostedExpenseCandidates, useRecordObligationPayment } from "@/lib/hooks/use-pilot";
import type { RecurringTransaction } from "@/lib/hooks/use-recurring";
import { formatDate } from "@/lib/utils";

type PaymentMode = "existing" | "new";

function rupeesFromPaise(paise: bigint) {
  const whole = (paise / 100n).toLocaleString("en-IN");
  const fraction = (paise % 100n).toString().padStart(2, "0");
  return `₹${whole}.${fraction}`;
}

function ruleAmountPaise(amount: number) {
  const [whole, fraction = ""] = amount.toFixed(2).split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

export function BillPaymentDialog({
  rule,
  occurrenceDate,
  open,
  onOpenChange,
}: {
  rule: RecurringTransaction | null;
  occurrenceDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<PaymentMode>("existing");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [confirmedNewRecord, setConfirmedNewRecord] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const payment = useRecordObligationPayment();
  const expectedPaise = useMemo(() => rule ? ruleAmountPaise(rule.amount) : 0n, [rule]);
  const candidates = usePostedExpenseCandidates({
    accountId: rule?.accountId,
    search: debouncedSearch,
    pageToken,
    enabled: open && mode === "existing" && Boolean(rule?.accountId),
  });
  const exactAmountCandidates = (candidates.data?.transactions || []).filter((transaction) => transaction.amountPaise === expectedPaise);

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSearch("");
    setDebouncedSearch("");
    setPageToken("");
    setPageHistory([]);
    setSelectedTransactionId("");
    setConfirmedNewRecord(false);
    setSubmitError("");
  }, [open, rule?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function changeMode(nextMode: PaymentMode) {
    setMode(nextMode);
    setSubmitError("");
    if (nextMode === "existing") setConfirmedNewRecord(false);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPageToken("");
    setPageHistory([]);
    setSelectedTransactionId("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rule || !occurrenceDate) return;
    setSubmitError("");
    if (mode === "existing") {
      const selected = exactAmountCandidates.find((transaction) => transaction.id === selectedTransactionId);
      if (!selected) {
        setSubmitError("Choose a posted expense for the same account with the exact bill amount.");
        return;
      }
    } else if (!confirmedNewRecord) {
      setSubmitError("Confirm that this payment is not already in Activity before recording a new expense.");
      return;
    }

    try {
      await payment.mutateAsync({
        recurringRuleId: rule.id,
        occurrenceDate,
        ...(mode === "existing" ? { transactionId: selectedTransactionId } : {}),
      });
      toast.success("Bill marked paid", {
        description: mode === "existing" ? "Linked to the existing Activity record; no expense was added." : "A new expense record was added. No money was moved.",
      });
      onOpenChange(false);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "The bill payment could not be recorded. Please retry.");
    }
  }

  if (!rule) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark {rule.description} paid</DialogTitle>
          <DialogDescription>
            For {occurrenceDate}. Choose whether to link an expense already in Activity or explicitly add a new record.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-ink">How should this payment be recorded?</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-neo border-brutal bg-paper-1 p-3">
              <input className="mt-1 size-4 shrink-0" type="radio" name="bill-payment-mode" value="existing" checked={mode === "existing"} onChange={() => changeMode("existing")} />
              <span><span className="block font-semibold text-ink">Link an existing payment</span><span className="mt-1 block text-sm text-taupe">Choose a posted expense from this bill’s paying account. Linking does not add another expense.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-neo border-brutal bg-paper-1 p-3">
              <input className="mt-1 size-4 shrink-0" type="radio" name="bill-payment-mode" value="new" checked={mode === "new"} onChange={() => changeMode("new")} />
              <span><span className="block font-semibold text-ink">Record a new payment</span><span className="mt-1 block text-sm text-taupe">Adds a new expense record to Activity. This does not pay the bill or move money in your bank.</span></span>
            </label>
          </fieldset>

          {mode === "existing" ? (
            <section aria-label="Choose an existing expense" className="space-y-3">
              <p className="text-sm text-taupe">Only posted expenses from {rule.accountId ? "the assigned paying account" : "an assigned paying account"} with the exact amount {rupeesFromPaise(expectedPaise)} can be linked.</p>
              {!rule.accountId ? <p role="alert" className="rounded-neo bg-warning/15 p-3 text-sm text-ink">Assign a paying account to this bill before linking a payment.</p> : null}
              <label className="block text-sm font-medium text-ink" htmlFor="bill-payment-search">Search Activity
                <Input id="bill-payment-search" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Search description" className="mt-1" disabled={!rule.accountId} />
              </label>

              {candidates.isLoading ? <p role="status" aria-live="polite" className="py-4 text-center text-sm text-taupe">Loading posted expenses…</p> : null}
              {candidates.isError ? <div role="alert" className="rounded-neo bg-danger/10 p-3 text-sm"><p>Existing expenses could not be loaded.</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void candidates.refetch()}>Retry</Button></div> : null}
              {!candidates.isLoading && !candidates.isError && rule.accountId && !candidates.data?.transactions.length ? <p className="rounded-neo bg-paper-1 p-3 text-sm text-taupe">No posted expenses found for this account on this page. Search or browse more records.</p> : null}
              {candidates.data?.transactions.length ? (
                <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-neo border-brutal bg-paper-1 p-2">
                  <legend className="sr-only">Posted expenses. Only exact amount matches are selectable.</legend>
                  {candidates.data.transactions.map((transaction) => {
                    const exact = transaction.amountPaise === expectedPaise;
                    return (
                      <label key={transaction.id} className={`flex items-start gap-3 rounded-md p-3 ${exact ? "cursor-pointer hover:bg-paper-2" : "cursor-not-allowed opacity-60"}`}>
                        <input type="radio" name="existing-expense" className="mt-1 size-4 shrink-0" value={transaction.id} checked={selectedTransactionId === transaction.id} disabled={!exact || payment.isPending} onChange={() => { setSelectedTransactionId(transaction.id); setSubmitError(""); }} aria-label={`${formatDate(transaction.date)} ${transaction.description}, ${rupeesFromPaise(transaction.amountPaise)}${exact ? "" : ", amount differs"}`} />
                        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="font-semibold text-ink">{transaction.description}</span><span className="font-semibold tabular-nums text-ink">{rupeesFromPaise(transaction.amountPaise)}</span></span><span className="mt-1 block text-xs text-taupe">{formatDate(transaction.date)}{exact ? " · Exact amount" : " · Amount differs"}</span></span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-taupe">{candidates.data?.transactions.length || 0} posted expenses on this page</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={!pageHistory.length || candidates.isFetching} onClick={() => { const history = [...pageHistory]; const previous = history.pop() || ""; setPageHistory(history); setPageToken(previous); }}>Previous</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!candidates.data?.nextPageToken || candidates.isFetching} onClick={() => { const next = candidates.data?.nextPageToken; if (!next) return; setPageHistory((history) => [...history, pageToken]); setPageToken(next); }}>Next</Button>
                </div>
              </div>
            </section>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 rounded-neo border-brutal bg-warning/10 p-3 text-sm text-ink">
              <input type="checkbox" checked={confirmedNewRecord} onChange={(event) => { setConfirmedNewRecord(event.target.checked); setSubmitError(""); }} className="mt-0.5 size-4 shrink-0" />
              <span>I checked Activity and this payment is not already recorded. Add a new expense record for {rupeesFromPaise(expectedPaise)}.</span>
            </label>
          )}

          {submitError ? <p role="alert" className="rounded-neo bg-danger/10 p-3 text-sm text-danger">{submitError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={payment.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={payment.isPending || (mode === "existing" && (!selectedTransactionId || !exactAmountCandidates.some((transaction) => transaction.id === selectedTransactionId))) || (mode === "new" && !confirmedNewRecord)}>
              {payment.isPending ? "Saving payment…" : mode === "existing" ? "Link payment and mark paid" : "Record new payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
