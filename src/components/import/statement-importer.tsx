"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Loader2, Upload } from "lucide-react";
import { importClient } from "@/lib/rpc/clients";
import { useAccounts } from "@/lib/hooks/use-accounts";
import { formatCurrency } from "@/lib/utils";
import { logError } from "@/lib/logger";
import type { PreviewStatementResponse } from "@/gen/vasoli/v1/import_pb";

const FORMATS = [
  ["hdfc_statement", "HDFC"],
  ["icici", "ICICI"],
  ["sbi", "SBI"],
  ["axis", "Axis"],
  ["kotak", "Kotak"],
  ["upi", "UPI passbook"],
] as const;

function amount(value: bigint | number) {
  return formatCurrency(Number(value) / 100);
}

export function StatementImporter() {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [format, setFormat] = useState<string>(FORMATS[0][0]);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [preview, setPreview] = useState<PreviewStatementResponse | null>(null);
  const [skipRows, setSkipRows] = useState<number[]>([]);
  const [confirmedRejectedRows, setConfirmedRejectedRows] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; duplicates: number; skipped: number } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const duplicateRowNumbers = useMemo(() => new Set((preview?.duplicates || []).map((row) => row.rowNumber)), [preview]);
  const selectableRows = preview?.rows || [];
  const readyAccounts = (accounts.data || []).filter((account) => account.currency === "INR");

  async function generatePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !accountId) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose a CSV under 10 MB.");
      return;
    }
    setPreviewing(true);
    setError("");
    setResult(null);
    setPreview(null);
    setConfirmedRejectedRows(false);
    try {
      const res = await importClient.previewStatement({
        accountId,
        fileName: file.name,
        file: new Uint8Array(await file.arrayBuffer()),
        format,
        openingBalancePaise: openingBalance !== "" ? BigInt(Math.round(Number(openingBalance) * 100)) : undefined,
        closingBalancePaise: closingBalance !== "" ? BigInt(Math.round(Number(closingBalance) * 100)) : undefined,
      });
      setPreview(res);
      setSkipRows([...new Set(res.duplicates.map((row) => row.rowNumber))]);
      setConfirmedRejectedRows(false);
      setIdempotencyKey(crypto.randomUUID());
    } catch (cause) {
      logError("statement_importer.preview", cause);
      setError(cause instanceof Error ? cause.message : "The statement could not be previewed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function commitImport() {
    if (!preview || !idempotencyKey) return;
    setCommitting(true);
    setError("");
    try {
      const res = await importClient.commitStatementImport({
        previewToken: preview.previewToken,
        idempotencyKey,
        skipRowNumbers: [...skipRows, ...(confirmedRejectedRows ? preview.rejected.map((row) => row.rowNumber) : [])],
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["pilot", "payday-plan"] }),
      ]);
      setResult({ created: res.createdCount, duplicates: res.duplicateCount, skipped: res.skippedCount });
      setPreview(null);
      setIdempotencyKey("");
    } catch (cause) {
      logError("statement_importer.commit", cause);
      setError(cause instanceof Error ? `${cause.message} You can retry this preview safely.` : "Import did not complete. Retry this preview safely.");
    } finally {
      setCommitting(false);
    }
  }

  function toggleSkip(rowNumber: number) {
    setSkipRows((rows) => rows.includes(rowNumber) ? rows.filter((row) => row !== rowNumber) : [...rows, rowNumber]);
  }

  return <div className="space-y-5">
    {accounts.isError ? <p role="alert" className="text-sm text-danger">Accounts could not be loaded. Retry before importing so the statement is assigned correctly.</p> : null}
    {!accounts.isLoading && readyAccounts.length === 0 ? <p className="rounded-neo border-brutal bg-paper-1 p-4 text-sm text-ink">Add an INR account in Settings before importing a statement.</p> : null}
    <form className="space-y-4" onSubmit={generatePreview}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">Statement account<select required value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2"><option value="">Choose an account…</option>{readyAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName} · {account.institutionName}</option>)}</select></label>
        <label className="text-sm font-medium text-ink">CSV format<select value={format} onChange={(event) => setFormat(event.target.value)} className="mt-1 block w-full rounded-neo border-brutal bg-paper-1 px-3 py-2">{FORMATS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-ink">Opening balance (optional)<span className="relative mt-1 block"><span className="absolute left-3 top-2 text-taupe">₹</span><input type="number" step="0.01" inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} className="w-full rounded-neo border-brutal bg-paper-1 py-2 pl-8 pr-3" /></span></label>
        <label className="text-sm font-medium text-ink">Closing balance (optional)<span className="relative mt-1 block"><span className="absolute left-3 top-2 text-taupe">₹</span><input type="number" step="0.01" inputMode="decimal" value={closingBalance} onChange={(event) => setClosingBalance(event.target.value)} className="w-full rounded-neo border-brutal bg-paper-1 py-2 pl-8 pr-3" /></span></label>
      </div>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-neo border-brutal-thick border-dashed bg-paper-1 p-5 text-center text-sm text-taupe hover:bg-paper-2">
        <Upload size={22} />
        <span>{file ? file.name : "Choose a bank CSV statement"}</span>
        <span className="text-xs">CSV only · maximum 10 MB</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setConfirmedRejectedRows(false); setResult(null); setError(""); }} />
      </label>
      <p className="text-xs leading-5 text-taupe">The server parses and checks the statement before anything is added. Preview values are estimates until you commit.</p>
      <button type="submit" disabled={!file || !accountId || previewing || readyAccounts.length === 0} className="inline-flex items-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">{previewing ? <Loader2 className="size-4 animate-spin" /> : null}{previewing ? "Checking statement…" : "Preview statement"}</button>
    </form>

    {preview ? <section className="space-y-4 border-t border-ink/15 pt-5" aria-labelledby="statement-preview-heading">
      <div><h3 id="statement-preview-heading" className="text-lg font-bold text-ink">Server-checked preview</h3><p className="text-sm text-taupe">Select the rows to import. Duplicate rows start excluded; you can also skip any other row.</p></div>
      {preview.reconciliation ? <div className={`rounded-neo border-brutal p-4 text-sm ${preview.reconciliation.matches ? "bg-success/10" : "bg-warning/10"}`}><p className="font-semibold text-ink">Balance check {preview.reconciliation.matches ? "matches" : "needs review"}</p><p className="mt-1 text-taupe">Calculated closing balance: {amount(preview.reconciliation.calculatedClosingBalancePaise)}{preview.reconciliation.differencePaise !== undefined ? ` · Difference: ${amount(preview.reconciliation.differencePaise)}` : ""}</p></div> : null}
      {preview.rejected.length ? <div className="rounded-neo border-brutal bg-warning/10 p-4"><details><summary className="cursor-pointer text-sm font-semibold text-ink">Review {preview.rejected.length} rejected rows</summary><ul className="mt-2 space-y-1 text-sm text-taupe">{preview.rejected.map((row) => <li key={row.rowNumber}>Row {row.rowNumber}: {row.reason}</li>)}</ul></details><label className="mt-3 flex items-start gap-2 text-sm text-ink"><input type="checkbox" aria-label={`Skip ${preview.rejected.length} rejected rows`} checked={confirmedRejectedRows} onChange={(event) => setConfirmedRejectedRows(event.target.checked)} /><span>I reviewed these rows and confirm they should be skipped.</span></label></div> : null}
      <div className="max-h-[28rem] overflow-auto rounded-neo border-brutal">
        <table className="w-full min-w-[42rem] text-left text-sm"><thead className="sticky top-0 bg-paper-2 text-xs uppercase text-taupe"><tr><th className="p-3">Import</th><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>
          {selectableRows.map((row) => {
            const duplicate = duplicateRowNumbers.has(row.rowNumber);
            const skipped = skipRows.includes(row.rowNumber);
            return <tr key={row.rowNumber} className="border-t border-ink/10"><td className="p-3"><input type="checkbox" aria-label={`Import row ${row.rowNumber}`} checked={!skipped} onChange={() => toggleSkip(row.rowNumber)} /></td><td className="p-3 whitespace-nowrap">{row.date?.toDate().toLocaleDateString("en-IN") || "—"}</td><td className="p-3">{row.description}{duplicate ? <span className="ml-2 rounded bg-warning/20 px-2 py-0.5 text-xs">Possible duplicate</span> : null}</td><td className="p-3">{row.type}</td><td className="p-3 text-right tabular-nums">{amount(row.amountPaise)}</td></tr>;
          })}
          {!selectableRows.length ? <tr><td colSpan={5} className="p-5 text-center text-taupe">No importable rows found. Check the file format.</td></tr> : null}
        </tbody></table>
      </div>
      {preview.duplicates.length ? <p className="text-sm text-taupe">{preview.duplicates.length} possible duplicates are excluded by default.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-taupe">{selectableRows.length - skipRows.length} rows selected · {skipRows.length} skipped{preview.rejected.length ? ` · ${preview.rejected.length} rejected` : ""}</p><button type="button" onClick={commitImport} disabled={committing || !selectableRows.length || selectableRows.length === skipRows.length || (preview.rejected.length > 0 && !confirmedRejectedRows)} className="inline-flex items-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">{committing ? <Loader2 className="size-4 animate-spin" /> : null}{committing ? "Importing…" : "Import selected rows"}</button></div>
    </section> : null}

    {result ? <div role="status" className="flex gap-2 rounded-neo border-brutal bg-success/10 p-4 text-sm text-ink"><CheckCircle className="size-5 shrink-0 text-success" /><p>Import complete: {result.created} added, {result.duplicates} duplicates detected, {result.skipped} skipped.</p></div> : null}
    {error ? <div role="alert" className="flex gap-2 rounded-neo border-brutal bg-danger/10 p-4 text-sm text-danger"><AlertCircle className="size-5 shrink-0" /><p>{error}</p></div> : null}
  </div>;
}
