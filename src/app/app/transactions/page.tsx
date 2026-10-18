"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileSpreadsheet, Plus, Search, ArrowLeftRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FirstRunHint, InlineErrorState, ScreenEmptyState, TableSkeleton } from "@/components/app/screen-states";
import { useActivityTransactions, useCategories, useAccounts, useCreateTransaction, useDeleteTransaction, useTransactionSummary, useUpdateTransaction, type Transaction } from "@/lib/hooks";
import { useCreateTransfer, exportTransactionsCsv } from "@/lib/hooks/use-pilot";
import { formatCurrency, formatDate } from "@/lib/utils";

const StatementImporter = dynamic(() => import("@/components/import/statement-importer").then((module) => module.StatementImporter), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm text-taupe">Loading importer…</div>,
});

const PAGE_SIZE = 50;
type TypeFilter = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER" | "REFUND";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const categories = useCategories();
  const [type, setType] = useState<TypeFilter>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cursor, setCursor] = useState("");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [refundSource, setRefundSource] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [form, setForm] = useState({ description: "", amount: "", date: localDate(), type: "EXPENSE" as "INCOME" | "EXPENSE", accountId: "" });
  const [transfer, setTransfer] = useState({ fromAccountId: "", toAccountId: "", amount: "", date: localDate(), description: "Account transfer" });
  const [exporting, setExporting] = useState(false);
  const [formError, setFormError] = useState("");
  const transferIdempotencyKey = useRef<string | null>(null);

  const filters = useMemo(() => ({
    categoryId: categoryId === "ALL" ? undefined : categoryId,
    pageSize: PAGE_SIZE,
    pageToken: cursor,
    accountId: accountId === "ALL" ? undefined : accountId,
    search: search.trim(),
    type,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }), [accountId, categoryId, cursor, endDate, search, startDate, type]);
  const query = useActivityTransactions(filters);
  const summary = useTransactionSummary();
  const accounts = useAccounts();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const createTransfer = useCreateTransfer();
  const transactions = query.data?.transactions || [];
  const accountNames = useMemo(() => new Map((accounts.data || []).map((account) => [account.id, account.accountName])), [accounts.data]);
  const inrAccounts = (accounts.data || []).filter((account) => account.currency === "INR");
  const hasFilters = Boolean(search.trim() || categoryId !== "ALL" || accountId !== "ALL" || type !== "ALL" || startDate || endDate);

  function resetCursor() {
    setCursor("");
    setCursorHistory([]);
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const amount = Number(form.amount);
    if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date) {
      setFormError("Enter a description, positive amount, and date.");
      return;
    }
    try {
      await createTransaction.mutateAsync({ description: form.description.trim(), amount, date: form.date, type: form.type, accountId: form.accountId || undefined });
      setEditorOpen(false);
    } catch {
      setFormError("The transaction could not be saved. Check your connection and retry.");
    }
  }

  async function saveTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const amount = Number(transfer.amount);
    if (!transfer.fromAccountId || !transfer.toAccountId || transfer.fromAccountId === transfer.toAccountId || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Choose two different INR accounts and enter a positive amount.");
      return;
    }
    try {
      await createTransfer.mutateAsync({
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amountPaise: BigInt(Math.round(amount * 100)),
        date: new Date(`${transfer.date}T12:00:00+05:30`),
        description: transfer.description.trim() || "Account transfer",
        idempotencyKey: transferIdempotencyKey.current ?? (transferIdempotencyKey.current = crypto.randomUUID()),
      });
      transferIdempotencyKey.current = null;
      setTransferOpen(false);
    } catch {
      setFormError("The transfer could not be recorded. Check the accounts and retry.");
    }
  }

  async function saveRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundSource) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundSource.amount) {
      setFormError("Enter a positive refund no greater than the original expense.");
      return;
    }
    setFormError("");
    try {
      await createTransaction.mutateAsync({
        description: `Refund: ${refundSource.description}`,
        amount,
        date: localDate(),
        type: "REFUND",
        accountId: refundSource.accountId,
        refundOfTransactionId: refundSource.id,
      });
      setRefundSource(null);
      setRefundAmount("");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "The refund could not be recorded. Check prior refunds and retry.");
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const size = await exportTransactionsCsv({ accountId: filters.accountId, categoryId: filters.categoryId, type, search: filters.search, startDate, endDate });
      toast.success("Activity export ready", { description: `${Math.round(size / 1024)} KB downloaded from the server.` });
    } catch (cause) {
      toast.error("Activity export failed", { description: cause instanceof Error ? cause.message : "Please retry." });
    } finally {
      setExporting(false);
    }
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete “${transaction.description}”? This cannot be undone.`)) return;
    await deleteTransaction.mutateAsync(transaction.id);
  }

  const empty = !query.isLoading && !query.isError && !transactions.length;

  return <div className="space-y-6">
    <section className="neo-surface-lg p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-3xl font-bold text-ink">Activity</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-taupe">Review records from your accounts. Unassigned history stays visible until you assign it.</p></div>
        <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => { setFormError(""); setImportOpen(true); }}><FileSpreadsheet className="size-4" />Import statement</Button><Button variant="outline" onClick={() => { setFormError(""); setTransferOpen(true); }} disabled={inrAccounts.length < 2}><ArrowLeftRight className="size-4" />Transfer</Button><Button onClick={() => { setForm({ description: "", amount: "", date: localDate(), type: "EXPENSE", accountId: "" }); setFormError(""); setEditorOpen(true); }}><Plus className="size-4" />Add transaction</Button></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-neo border-brutal bg-paper-1 p-3"><p className="text-xs uppercase tracking-wide text-taupe">Month net flow</p><p className="mt-1 text-xl font-bold text-ink">{formatCurrency(summary.data?.balance || 0)}</p></div>
        <div className="rounded-neo border-brutal bg-paper-1 p-3"><p className="text-xs uppercase tracking-wide text-taupe">Income this month</p><p className="mt-1 text-xl font-bold text-ink">{formatCurrency(summary.data?.totalIncome || 0)}</p></div>
        <div className="rounded-neo border-brutal bg-paper-1 p-3"><p className="text-xs uppercase tracking-wide text-taupe">Expenses this month</p><p className="mt-1 text-xl font-bold text-ink">{formatCurrency(summary.data?.totalExpenses || 0)}</p></div>
      </div>
    </section>

    <FirstRunHint title="Import one statement first, then reconcile account and balance details." description="A server-checked preview lets you see duplicates and skip individual rows before anything is committed." />

    <section className="neo-surface p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative xl:col-span-2"><span className="sr-only">Search activity</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe" /><Input value={search} onChange={(event) => { setSearch(event.target.value); resetCursor(); }} placeholder="Search all activity" className="pl-9" /></label>
        <label className="sr-only" htmlFor="activity-account">Filter by account</label><Select value={accountId} onValueChange={(value) => { setAccountId(value); resetCursor(); }}><SelectTrigger id="activity-account"><SelectValue placeholder="All accounts" /></SelectTrigger><SelectContent><SelectItem value="ALL">All accounts</SelectItem>{inrAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>)}</SelectContent></Select>
        <label className="sr-only" htmlFor="activity-type">Filter by type</label><Select value={type} onValueChange={(value: TypeFilter) => { setType(value); resetCursor(); }}><SelectTrigger id="activity-type"><SelectValue placeholder="All activity types" /></SelectTrigger><SelectContent><SelectItem value="ALL">All activity types</SelectItem><SelectItem value="INCOME">Income</SelectItem><SelectItem value="EXPENSE">Expense</SelectItem><SelectItem value="TRANSFER">Transfer</SelectItem><SelectItem value="REFUND">Refund</SelectItem></SelectContent></Select>
        <label className="sr-only" htmlFor="activity-category">Filter by category</label><Select value={categoryId} onValueChange={(value) => { setCategoryId(value); resetCursor(); }}><SelectTrigger id="activity-category"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="ALL">All categories</SelectItem>{(categories.data || []).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
        <div className="flex gap-2"><label className="sr-only" htmlFor="activity-start">From date</label><Input id="activity-start" type="date" aria-label="From date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetCursor(); }} /><label className="sr-only" htmlFor="activity-end">To date</label><Input id="activity-end" type="date" aria-label="To date" value={endDate} onChange={(event) => { setEndDate(event.target.value); resetCursor(); }} /></div>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-3"><p className="text-xs text-taupe">Filters and search are applied on the server. Export downloads every matching record.</p><div className="flex gap-3"><Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting}>{exporting ? "Exporting…" : <><Download className="size-4" />Export filtered CSV</>}</Button>{hasFilters ? <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryId("ALL"); setAccountId("ALL"); setType("ALL"); setStartDate(""); setEndDate(""); resetCursor(); }}>Clear filters</Button> : null}</div></div>
    </section>

    {query.isError || summary.isError ? <InlineErrorState title="Activity could not be loaded" description="Retry the activity and monthly summary requests." onRetry={() => { void query.refetch(); void summary.refetch(); }} /> : null}
    {query.isLoading ? <TableSkeleton rows={8} /> : empty ? <ScreenEmptyState icon={Search} title={hasFilters ? "No matching activity" : "No activity yet"} description={hasFilters ? "Adjust or clear the filters to see more records." : "Import a statement or add a transaction to begin."} cta={hasFilters ? { label: "Clear filters", onClick: () => { setSearch(""); setCategoryId("ALL"); setAccountId("ALL"); setType("ALL"); setStartDate(""); setEndDate(""); resetCursor(); } } : { label: "Import statement", onClick: () => setImportOpen(true) }} /> : <section className="neo-surface overflow-hidden">
      <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-20"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>
        {transactions.map((transaction) => <TableRow key={transaction.id}>
          <TableCell className="whitespace-nowrap">{formatDate(transaction.date)}</TableCell>
          <TableCell><p className="font-semibold">{transaction.description}</p><p className="text-xs text-taupe">{transaction.category?.name || "Uncategorised"}{transaction.refundOfTransactionId ? " · linked refund" : ""}{transaction.transferGroupId ? ` · ${transaction.transferDirection === "OUT" ? "sent" : "received"} transfer` : ""}</p></TableCell>
          <TableCell className="text-sm">{transaction.accountId ? accountNames.get(transaction.accountId) || "Account" : <span className="text-taupe">Unassigned</span>}</TableCell>
          <TableCell><Badge variant={transaction.type === "INCOME" || transaction.type === "REFUND" ? "default" : "neutral"}>{transaction.type}</Badge></TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{transaction.type === "INCOME" || transaction.type === "REFUND" || transaction.transferDirection === "IN" ? "+" : transaction.transferGroupId ? "−" : ""}{formatCurrency(transaction.amount)}</TableCell>
          <TableCell className="text-right">
            {transaction.type === "EXPENSE" && !transaction.refundOfTransactionId ? <Button variant="ghost" size="icon" aria-label={`Record refund for ${transaction.description}`} onClick={() => { setRefundSource(transaction); setRefundAmount(""); setFormError(""); }}><RotateCcw className="size-4" /></Button> : null}
            {!transaction.accountId && inrAccounts.length ? <label className="sr-only" htmlFor={`assign-${transaction.id}`}>Assign {transaction.description} to an account</label> : null}
            {!transaction.accountId && inrAccounts.length ? <select id={`assign-${transaction.id}`} defaultValue="" aria-label={`Assign ${transaction.description} to an account`} onChange={async (event) => {
              const nextAccountId = event.target.value;
              if (!nextAccountId) return;
              try { await updateTransaction.mutateAsync({ id: transaction.id, data: { accountId: nextAccountId } }); }
              catch { toast.error("Account assignment failed", { description: "The record remains unassigned. Retry when connected." }); event.target.value = ""; }
            }} className="mb-1 block max-w-32 rounded border-brutal bg-paper-1 px-2 py-1 text-xs"><option value="">Assign account…</option>{inrAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select> : null}
            {!transaction.transferGroupId ? <Button variant="ghost" size="sm" onClick={() => void removeTransaction(transaction)}>Delete</Button> : <span className="text-xs text-taupe">Linked transfer</span>}
          </TableCell>
        </TableRow>)}
      </TableBody></Table>
      <div className="flex flex-col gap-3 border-t-brutal bg-paper-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-taupe">{transactions.length} records on this page · {cursorHistory.length + 1} page{cursorHistory.length === 0 ? "" : "s"} visited</p><div className="flex gap-2"><Button variant="outline" onClick={() => { const next = [...cursorHistory]; const previous = next.pop() || ""; setCursorHistory(next); setCursor(previous); }} disabled={!cursorHistory.length || query.isFetching}>Previous</Button><Button variant="outline" onClick={() => { const next = query.data?.nextPageToken; if (!next) return; setCursorHistory((history) => [...history, cursor]); setCursor(next); }} disabled={!query.data?.nextPageToken || query.isFetching}>Next</Button></div></div>
    </section>}

    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Import a statement</DialogTitle><DialogDescription>Preview the server-parsed rows and choose exactly which records to commit.</DialogDescription></DialogHeader><StatementImporter /></DialogContent></Dialog>
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Add transaction</DialogTitle><DialogDescription>Use a manual entry for a missed record or correction.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={saveTransaction}>
      <label className="block text-sm font-medium">Description<input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Amount (₹)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label><label className="block text-sm font-medium">Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label></div>
      <label className="block text-sm font-medium">Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "INCOME" | "EXPENSE" })} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select></label>
      <label className="block text-sm font-medium">Account<select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="">Leave unassigned</option>{inrAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></label>
      {formError ? <p role="alert" className="text-sm text-danger">{formError}</p> : null}<Button type="submit" disabled={createTransaction.isPending}>{createTransaction.isPending ? "Saving…" : "Save transaction"}</Button>
    </form></DialogContent></Dialog>
    <Dialog open={transferOpen} onOpenChange={setTransferOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Record an account transfer</DialogTitle><DialogDescription>This creates linked debit and credit entries. It does not move money.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={saveTransfer}>
      <label className="block text-sm font-medium">From account<select required value={transfer.fromAccountId} onChange={(e) => { transferIdempotencyKey.current = null; setTransfer({ ...transfer, fromAccountId: e.target.value }); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="">Choose account</option>{inrAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></label>
      <label className="block text-sm font-medium">To account<select required value={transfer.toAccountId} onChange={(e) => { transferIdempotencyKey.current = null; setTransfer({ ...transfer, toAccountId: e.target.value }); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="">Choose account</option>{inrAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Amount (₹)<input required type="number" min="0.01" step="0.01" value={transfer.amount} onChange={(e) => { transferIdempotencyKey.current = null; setTransfer({ ...transfer, amount: e.target.value }); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label><label className="block text-sm font-medium">Date<input required type="date" value={transfer.date} onChange={(e) => { transferIdempotencyKey.current = null; setTransfer({ ...transfer, date: e.target.value }); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label></div>
      <label className="block text-sm font-medium">Description<input value={transfer.description} onChange={(e) => { transferIdempotencyKey.current = null; setTransfer({ ...transfer, description: e.target.value }); }} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>
      {formError ? <p role="alert" className="text-sm text-danger">{formError}</p> : null}<Button type="submit" disabled={createTransfer.isPending}>{createTransfer.isPending ? "Recording…" : "Record transfer"}</Button>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(refundSource)} onOpenChange={(open) => { if (!open) setRefundSource(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Record a refund</DialogTitle><DialogDescription>This links the incoming refund to the original expense and assigns it to the same account.</DialogDescription></DialogHeader>{refundSource ? <form className="space-y-4" onSubmit={saveRefund}><p className="rounded-neo bg-paper-1 p-3 text-sm">{refundSource.description} · original {formatCurrency(refundSource.amount)}{refundSource.accountId ? ` · ${accountNames.get(refundSource.accountId) || "account"}` : " · unassigned"}</p><label className="block text-sm font-medium">Refund amount (₹)<input required type="number" min="0.01" max={refundSource.amount} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2" /></label>{formError ? <p role="alert" className="text-sm text-danger">{formError}</p> : null}<Button type="submit" disabled={createTransaction.isPending}>{createTransaction.isPending ? "Saving…" : "Save linked refund"}</Button></form> : null}</DialogContent></Dialog>
  </div>;
}
