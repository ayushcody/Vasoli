"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSearch,
  Loader2,
  Lock,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Unlock,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { FirstRunHint, InlineErrorState, ScreenEmptyState, TableSkeleton } from "@/components/app/screen-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  decryptStringWithPassphrase,
  encryptStringWithPassphrase,
  isVaultPayload,
} from "@/lib/crypto/vault";
import { track } from "@/lib/analytics";
import {
  type ReceiptItem,
  useCreateReceipt,
  useExpiringReceipts,
  useReceipts,
  useUpdateReceipt,
} from "@/lib/hooks/use-receipts";
import { scanReceipt, type ReceiptData } from "@/lib/ocr/receipt-scanner";
import { formatCurrency, formatDate, formatPaise } from "@/lib/utils";

type Tab = "all" | "expiring" | "reimbursable";
type SortKey = "purchaseDate" | "amount" | "merchant";

function parseReceiptDate(value: string | null | undefined, fallback = new Date()) {
  if (!value) {
    return fallback;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const relativeMatch = value.match(/(\d+)\s*(day|month|year)s?/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const next = new Date(fallback);

    if (unit === "day") next.setDate(next.getDate() + amount);
    if (unit === "month") next.setMonth(next.getMonth() + amount);
    if (unit === "year") next.setFullYear(next.getFullYear() + amount);

    return next;
  }

  return fallback;
}

function receiptDeadline(receipt: ReceiptItem) {
  return receipt.returnBy || receipt.warrantyUntil;
}

function isSnoozed(receipt: ReceiptItem) {
  return Boolean(receipt.snoozedUntil && receipt.snoozedUntil > new Date());
}

function extractPreview(payload: string | null) {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as ReceiptData;
  } catch {
    return null;
  }
}

function exportReceiptsCsv(rows: ReceiptItem[]) {
  const header = ["Merchant", "Amount", "Purchase Date", "Return By", "Warranty Until", "Reimbursable"];
  const body = rows.map((row) =>
    [
      row.merchant,
      (Number(row.amountPaise) / 100).toString(),
      row.purchaseDate ? formatDate(row.purchaseDate) : "",
      row.returnBy ? formatDate(row.returnBy) : "",
      row.warrantyUntil ? formatDate(row.warrantyUntil) : "",
      row.reimbursable ? "Yes" : "No",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "vasoli-receipts.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const receiptsQuery = useReceipts();
  const expiringQuery = useExpiringReceipts(30);
  const createReceipt = useCreateReceipt();
  const updateReceipt = useUpdateReceipt();

  const [tab, setTab] = useState<Tab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("purchaseDate");
  const [search, setSearch] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [decryptedPayloads, setDecryptedPayloads] = useState<Record<string, string>>({});
  const [decryptingId, setDecryptingId] = useState<string | null>(null);

  const receipts = useMemo(() => receiptsQuery.data || [], [receiptsQuery.data]);
  const expiringIds = useMemo(
    () => new Set((expiringQuery.data || []).filter((receipt) => !isSnoozed(receipt)).map((receipt) => receipt.id)),
    [expiringQuery.data],
  );

  const filteredReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const next = receipts.filter((receipt) => {
      if (tab === "expiring" && !expiringIds.has(receipt.id)) return false;
      if (tab === "reimbursable" && !receipt.reimbursable) return false;

      if (!query) return true;

      return [receipt.merchant, receipt.reimbursable ? "reimbursable" : "personal", receipt.returnBy ? "return" : "", receipt.warrantyUntil ? "warranty" : ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    next.sort((left, right) => {
      if (sortKey === "amount") {
        return Number(right.amountPaise) - Number(left.amountPaise);
      }
      if (sortKey === "merchant") {
        return left.merchant.localeCompare(right.merchant);
      }
      return (right.purchaseDate?.getTime() || 0) - (left.purchaseDate?.getTime() || 0);
    });

    return next;
  }, [expiringIds, receipts, search, sortKey, tab]);

  const pageSize = 8;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
  const pagedReceipts = filteredReceipts.slice((page - 1) * pageSize, page * pageSize);
  const activeReceipt = receipts.find((receipt) => receipt.id === activeReceiptId) || pagedReceipts[0] || null;

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const summary = useMemo(() => {
    const totalValue = receipts.reduce((sum, receipt) => sum + Number(receipt.amountPaise), 0) / 100;
    return {
      totalReceipts: receipts.length,
      expiringCount: receipts.filter((receipt) => expiringIds.has(receipt.id)).length,
      reimbursableCount: receipts.filter((receipt) => receipt.reimbursable).length,
      totalValue,
    };
  }, [expiringIds, receipts]);

  async function handleUnlock() {
    if (!unlockInput) {
      return;
    }

    try {
      const sample = receipts.find((receipt) => isVaultPayload(receipt.ocrPayloadEncrypted));
      if (sample) {
        await decryptStringWithPassphrase(sample.ocrPayloadEncrypted, unlockInput);
      }

      setVaultPassphrase(unlockInput);
      setUnlockInput("");
      setShowUnlockModal(false);
      track("vault_unlocked", { encryptedItems: receipts.filter((receipt) => isVaultPayload(receipt.ocrPayloadEncrypted)).length });
      toast.success("Vault unlocked on this device");
    } catch {
      toast.error("That passphrase could not unlock your stored payloads");
    }
  }

  function handleLock() {
    setVaultPassphrase("");
    setDecryptedPayloads({});
    toast.success("Vault locked");
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const scanned = await scanReceipt(file);
      const purchaseDate = parseReceiptDate(scanned.date);
      const returnBy = scanned.returnBy ? parseReceiptDate(scanned.returnBy, purchaseDate) : undefined;
      const warrantyUntil = scanned.warrantyUntil ? parseReceiptDate(scanned.warrantyUntil, purchaseDate) : undefined;

      const rawPayload = JSON.stringify(scanned);
      const encryptedPayload = vaultPassphrase
        ? await encryptStringWithPassphrase(rawPayload, vaultPassphrase)
        : rawPayload;

      const created = await createReceipt.mutateAsync({
        merchant: scanned.merchant || file.name.replace(/\.[^.]+$/, ""),
        amountPaise: BigInt(Math.round((scanned.amount || 0) * 100)),
        purchaseDate,
        returnBy,
        warrantyUntil,
        reimbursable: false,
        ocrPayloadEncrypted: encryptedPayload,
      });

      if (vaultPassphrase) {
        setDecryptedPayloads((current) => ({
          ...current,
          [created.id]: rawPayload,
        }));
      }

      setActiveReceiptId(created.id);
      track("receipt_created", { source: "scan" });
      toast.success("Receipt scanned and stored", {
        description: scanned.amount ? `Captured ${formatCurrency(scanned.amount)}` : "OCR finished",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to scan or store receipt");
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  async function showPreview(receipt: ReceiptItem) {
    setActiveReceiptId(receipt.id);

    if (decryptedPayloads[receipt.id]) {
      return;
    }

    if (isVaultPayload(receipt.ocrPayloadEncrypted)) {
      if (!vaultPassphrase) {
        setShowUnlockModal(true);
        return;
      }

      try {
        setDecryptingId(receipt.id);
        const decrypted = await decryptStringWithPassphrase(receipt.ocrPayloadEncrypted, vaultPassphrase);
        setDecryptedPayloads((current) => ({
          ...current,
          [receipt.id]: decrypted,
        }));
      } catch {
        toast.error("Could not decrypt this receipt on this device");
      } finally {
        setDecryptingId(null);
      }
      return;
    }

    setDecryptedPayloads((current) => ({
      ...current,
      [receipt.id]: receipt.ocrPayloadEncrypted,
    }));
  }

  async function toggleReimbursable(receipt: ReceiptItem) {
    await updateReceipt.mutateAsync({
      id: receipt.id,
      reimbursable: !receipt.reimbursable,
    });
    track("receipt_reimbursable_toggled", { reimbursable: !receipt.reimbursable });
  }

  async function snoozeReceipt(receipt: ReceiptItem) {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);
    await updateReceipt.mutateAsync({
      id: receipt.id,
      snoozedUntil,
    });
  }

  const previewPayload = activeReceipt
    ? decryptedPayloads[activeReceipt.id] || (!isVaultPayload(activeReceipt.ocrPayloadEncrypted) ? activeReceipt.ocrPayloadEncrypted : null)
    : null;
  const preview = extractPreview(previewPayload);
  const hasNoReceipts = !receiptsQuery.isLoading && !receipts.length;

  return (
    <div className="space-y-6">
      <section className="neo-surface-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Receipt Vault</p>
            <div>
              <h1 className="text-4xl font-black">Keep receipts useful after the purchase high wears off.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-taupe">
                Search the vault, export the current table, unlock encrypted payloads locally, and keep return windows visible before they expire.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Stored receipts</p>
              <p className="mt-2 text-2xl font-black">{summary.totalReceipts}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Need attention</p>
              <p className="mt-2 text-2xl font-black">{summary.expiringCount}</p>
            </div>
            <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-taupe">Tracked value</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(summary.totalValue)}</p>
            </div>
          </div>
        </div>
      </section>

      <FirstRunHint
        title="Unlock the vault only on trusted devices."
        description="If you store OCR payloads encrypted, keep the passphrase client-side and use previews only when you need them."
      />

      <section className="neo-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by merchant, return, warranty, or reimbursement"
                className="pl-9"
                aria-label="Search receipts"
              />
            </label>
            <Select value={sortKey} onValueChange={(value: SortKey) => setSortKey(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchaseDate">Newest purchase</SelectItem>
                <SelectItem value="amount">Largest amount</SelectItem>
                <SelectItem value="merchant">Merchant A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all" as const, label: "All" },
                { value: "expiring" as const, label: "Expiring" },
                { value: "reimbursable" as const, label: "Reimbursable" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={tab === option.value ? "default" : "outline"}
                  onClick={() => {
                    setTab(option.value);
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                exportReceiptsCsv(filteredReceipts);
                track("receipts_exported", { rows: filteredReceipts.length });
                toast.success("Receipt CSV export ready");
              }}
              disabled={!filteredReceipts.length}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
            <Button onClick={() => fileRef.current?.click()} disabled={createReceipt.isPending}>
              {createReceipt.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Scan receipt
            </Button>
            {vaultPassphrase ? (
              <Button variant="outline" onClick={handleLock}>
                <Lock className="size-4" />
                Lock vault
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setShowUnlockModal(true)}>
                <Unlock className="size-4" />
                Unlock vault
              </Button>
            )}
          </div>
        </div>
      </section>

      {receiptsQuery.error || expiringQuery.error ? (
        <InlineErrorState
          title="Receipt vault could not be loaded"
          description="Retry the vault and expiring queries from here."
          onRetry={() => {
            receiptsQuery.refetch();
            expiringQuery.refetch();
          }}
        />
      ) : null}

      {receiptsQuery.isLoading ? (
        <TableSkeleton rows={8} />
      ) : hasNoReceipts ? (
        <ScreenEmptyState
          icon={FileSearch}
          title="No receipts stored yet"
          description="Scan your first receipt to start tracking returns, warranties, and reimbursable purchases in one place."
          cta={{ label: "Scan first receipt", onClick: () => fileRef.current?.click() }}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="neo-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedReceipts.map((receipt) => {
                  const deadline = receiptDeadline(receipt);
                  const expiringSoon = expiringIds.has(receipt.id);
                  return (
                    <TableRow
                      key={receipt.id}
                      className={activeReceiptId === receipt.id ? "outline outline-2 outline-border" : ""}
                      onClick={() => showPreview(receipt)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold">{receipt.merchant}</p>
                          <p className="text-xs text-main-foreground/70">{receipt.reimbursable ? "Reimbursable" : "Personal"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{receipt.purchaseDate ? formatDate(receipt.purchaseDate) : "Not set"}</TableCell>
                      <TableCell>{deadline ? formatDate(deadline) : "Not set"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPaise(receipt.amountPaise)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {expiringSoon ? <Badge>Expiring</Badge> : null}
                          {isVaultPayload(receipt.ocrPayloadEncrypted) ? <Badge variant="neutral">Encrypted</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                            <Button variant="ghost" size="icon" aria-label={`Open actions for ${receipt.merchant}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => showPreview(receipt)}>
                              <FileSearch className="size-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleReimbursable(receipt)}>
                              <ShieldCheck className="size-4" />
                              {receipt.reimbursable ? "Mark personal" : "Mark reimbursable"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => snoozeReceipt(receipt)}>
                              <Lock className="size-4" />
                              Snooze 7 days
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-3 border-t-brutal bg-paper-1 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-taupe">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredReceipts.length)} of {filteredReceipts.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>

          <aside className="neo-surface-lg p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-taupe">Receipt preview</p>
            {activeReceipt ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h2 className="text-2xl font-black">{activeReceipt.merchant}</h2>
                  <p className="mt-1 text-sm text-taupe">{formatPaise(activeReceipt.amountPaise)}</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4 text-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-taupe">Purchase</p>
                    <p className="mt-2 font-semibold">{activeReceipt.purchaseDate ? formatDate(activeReceipt.purchaseDate) : "Not set"}</p>
                  </div>
                  <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4 text-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-taupe">Return / Warranty</p>
                    <p className="mt-2 font-semibold">
                      {receiptDeadline(activeReceipt) ? formatDate(receiptDeadline(activeReceipt)!) : "No deadline captured"}
                    </p>
                  </div>
                </div>
                {decryptingId === activeReceipt.id ? (
                  <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4 text-sm text-taupe">Decrypting payload...</div>
                ) : preview ? (
                  <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4 text-sm leading-7 text-taupe">
                    <p><span className="font-semibold text-ink">Merchant:</span> {preview.merchant || activeReceipt.merchant}</p>
                    <p><span className="font-semibold text-ink">Amount:</span> {preview.amount ? formatCurrency(preview.amount) : "Unknown"}</p>
                    <p><span className="font-semibold text-ink">Date:</span> {preview.date || "Unknown"}</p>
                    <p><span className="font-semibold text-ink">Raw text:</span></p>
                    <p className="rounded-neo border-brutal bg-paper-2 p-3 text-xs leading-6 text-ink/80">
                      {preview.rawText || "No OCR text captured"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border-brutal bg-paper-1 p-4 text-sm text-taupe">
                    Select a receipt row to preview the OCR payload. Encrypted entries need the vault unlocked first.
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-taupe">Select a receipt to inspect it.</p>
            )}
          </aside>
        </div>
      )}

      <Dialog open={showUnlockModal} onOpenChange={setShowUnlockModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock vault preview</DialogTitle>
            <DialogDescription>Decrypt stored payloads only on a device you trust.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={unlockInput}
              onChange={(event) => setUnlockInput(event.target.value)}
              placeholder="Vault passphrase"
            />
            <Button onClick={handleUnlock} className="w-full">
              Unlock vault
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
