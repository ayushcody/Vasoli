"use client";

import { useRef, useState } from "react";
import { Download, Trash2 } from "lucide-react";

export function AccountLifecycleControls() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [requestId, setRequestId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  function responseError(result: unknown, fallback: string) {
    if (!result || typeof result !== "object") return fallback;
    const error = (result as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
    return fallback;
  }

  async function exportData() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/account/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error(await response.text() || "Your export could not be prepared.");
      const blob = new Blob([await response.text()], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vasoli-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your export could not be prepared.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setDeleting(true);
    setError("");
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey.current, confirm: "DELETE" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(result, "Deletion could not be started. Retry to continue safely."));
      setRequestId(result.requestId || "");
      setStatus(result.status || "PENDING");
      if (result.status === "COMPLETED") idempotencyKey.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deletion could not be started. Retry to continue safely.");
    } finally {
      setDeleting(false);
    }
  }

  async function refreshDeletionStatus() {
    if (!requestId) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/account/delete?requestId=${encodeURIComponent(requestId)}`, { credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseError(result, "Deletion status could not be refreshed."));
      setStatus(result.status || status);
      if (result.status === "COMPLETED") idempotencyKey.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deletion status could not be refreshed.");
    } finally {
      setDeleting(false);
    }
  }

  const terminal = status === "COMPLETED";

  return (
    <section className="space-y-5 rounded-neo border-brutal bg-paper-1 p-5" aria-labelledby="data-controls-heading">
      <div>
        <h2 id="data-controls-heading" className="font-serif text-xl font-bold text-ink">Your data</h2>
        <p className="mt-1 text-sm text-taupe">Download a copy of your records or request permanent account deletion.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={exportData} disabled={exporting} className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
          <Download size={16} /> {exporting ? "Preparing export…" : "Download my data"}
        </button>
      </div>
      <div className="space-y-3 border-t border-ink/15 pt-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-ink"><Trash2 size={16} /> Delete account</h3>
          <p className="mt-1 max-w-2xl text-sm text-taupe">This permanently removes your account and financial records. Type DELETE to confirm. A retry reuses the same request key, so it will not create a duplicate deletion request.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-taupe">Type DELETE to confirm
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-1 block w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm text-ink" />
          </label>
          <button type="button" onClick={deleteAccount} disabled={deleting || confirmation !== "DELETE" || terminal} className="rounded-neo border-brutal-thick bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {deleting ? "Working…" : status === "FAILED" ? "Retry deletion" : "Request deletion"}
          </button>
        </div>
        {requestId ? <div className="flex flex-wrap items-center gap-3 text-sm text-ink" role="status">
          <span>Deletion status: <strong>{status.replaceAll("_", " ")}</strong></span>
          {!terminal && <button type="button" onClick={refreshDeletionStatus} disabled={deleting} className="font-semibold underline underline-offset-4 disabled:opacity-50">Refresh status</button>}
        </div> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </section>
  );
}
