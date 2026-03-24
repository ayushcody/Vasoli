"use client"

import { useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  Download,
  FileSearch,
  Loader2,
  Lock,
  Package,
  ReceiptText,
  Scan,
  Search,
  Shield,
  Unlock,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  decryptStringWithPassphrase,
  encryptStringWithPassphrase,
  isVaultPayload,
} from "@/lib/crypto/vault"
import { scanReceipt, type ReceiptData } from "@/lib/ocr/receipt-scanner"
import {
  type ReceiptItem,
  useCreateReceipt,
  useExpiringReceipts,
  useReceipts,
  useUpdateReceipt,
} from "@/lib/hooks/use-receipts"
import { formatCurrency } from "@/lib/utils"

type Tab = "all" | "expiring" | "reimbursable"

function parseReceiptDate(value: string | null | undefined, fallback = new Date()) {
  if (!value) {
    return fallback
  }

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }

  const relativeMatch = value.match(/(\d+)\s*(day|month|year)s?/i)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1])
    const unit = relativeMatch[2].toLowerCase()
    const next = new Date(fallback)

    if (unit === "day") {
      next.setDate(next.getDate() + amount)
    } else if (unit === "month") {
      next.setMonth(next.getMonth() + amount)
    } else if (unit === "year") {
      next.setFullYear(next.getFullYear() + amount)
    }

    return next
  }

  return fallback
}

function receiptDeadline(receipt: ReceiptItem) {
  return receipt.returnBy || receipt.warrantyUntil
}

function isSnoozed(receipt: ReceiptItem) {
  return Boolean(receipt.snoozedUntil && receipt.snoozedUntil > new Date())
}

function withinDays(receipt: ReceiptItem, days: number) {
  const deadline = receiptDeadline(receipt)
  if (!deadline) {
    return false
  }

  const now = Date.now()
  const diff = deadline.getTime() - now
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

function toDisplayDate(date?: Date) {
  if (!date) {
    return "Not set"
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function extractPreview(payload: string | null) {
  if (!payload) {
    return null
  }

  try {
    const parsed = JSON.parse(payload) as ReceiptData
    return parsed
  } catch {
    return null
  }
}

export default function ReceiptsPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const receipts = useReceipts()
  const expiring = useExpiringReceipts(30)
  const createReceipt = useCreateReceipt()
  const updateReceipt = useUpdateReceipt()

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [unlockInput, setUnlockInput] = useState("")
  const [vaultPassphrase, setVaultPassphrase] = useState("")
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null)
  const [decryptedPayloads, setDecryptedPayloads] = useState<Record<string, string>>({})
  const [decryptingId, setDecryptingId] = useState<string | null>(null)

  const items = receipts.data || []
  const expiringIds = new Set((expiring.data || []).filter((receipt) => !isSnoozed(receipt)).map((receipt) => receipt.id))

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return items.filter((receipt) => {
      if (tab === "expiring" && !expiringIds.has(receipt.id)) {
        return false
      }
      if (tab === "reimbursable" && !receipt.reimbursable) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        receipt.merchant,
        receipt.reimbursable ? "reimbursable" : "personal",
        receipt.returnBy ? "return" : "",
        receipt.warrantyUntil ? "warranty" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [expiringIds, items, search, tab])

  const summary = useMemo(() => {
    const reimbursableCount = items.filter((receipt) => receipt.reimbursable).length
    const expiringCount = items.filter((receipt) => expiringIds.has(receipt.id)).length
    const totalValue = items.reduce((sum, receipt) => sum + Number(receipt.amountPaise), 0) / 100

    return {
      totalReceipts: items.length,
      reimbursableCount,
      expiringCount,
      totalValue,
    }
  }, [expiringIds, items])

  async function handleUnlock() {
    if (!unlockInput) {
      return
    }

    try {
      const sample = items.find((receipt) => isVaultPayload(receipt.ocrPayloadEncrypted))
      if (sample) {
        await decryptStringWithPassphrase(sample.ocrPayloadEncrypted, unlockInput)
      }

      setVaultPassphrase(unlockInput)
      setUnlockInput("")
      setShowUnlockModal(false)
      toast.success("Vault unlocked on this device")
    } catch {
      toast.error("That passphrase could not decrypt your vault payloads")
    }
  }

  function handleLock() {
    setVaultPassphrase("")
    setDecryptedPayloads({})
    setActiveReceiptId(null)
    toast.success("Vault locked")
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const scanned = await scanReceipt(file)
      const purchaseDate = parseReceiptDate(scanned.date)
      const returnBy = scanned.returnBy ? parseReceiptDate(scanned.returnBy, purchaseDate) : undefined
      const warrantyUntil = scanned.warrantyUntil
        ? parseReceiptDate(scanned.warrantyUntil, purchaseDate)
        : undefined

      const rawPayload = JSON.stringify(scanned)
      const encryptedPayload = vaultPassphrase
        ? await encryptStringWithPassphrase(rawPayload, vaultPassphrase)
        : rawPayload

      const created = await createReceipt.mutateAsync({
        merchant: scanned.merchant || file.name.replace(/\.[^.]+$/, ""),
        amountPaise: BigInt(Math.round((scanned.amount || 0) * 100)),
        purchaseDate,
        returnBy,
        warrantyUntil,
        reimbursable: false,
        ocrPayloadEncrypted: encryptedPayload,
      })

      if (vaultPassphrase) {
        setDecryptedPayloads((current) => ({
          ...current,
          [created.id]: rawPayload,
        }))
      }

      setActiveReceiptId(created.id)
      toast.success("Receipt scanned and stored", {
        description: scanned.amount ? `Captured ${formatCurrency(scanned.amount)}` : "OCR finished",
      })
    } catch (error) {
      console.error(error)
      toast.error("Failed to scan or save receipt")
    } finally {
      if (fileRef.current) {
        fileRef.current.value = ""
      }
    }
  }

  async function showPreview(receipt: ReceiptItem) {
    setActiveReceiptId((current) => (current === receipt.id ? null : receipt.id))

    if (decryptedPayloads[receipt.id]) {
      return
    }

    if (isVaultPayload(receipt.ocrPayloadEncrypted)) {
      if (!vaultPassphrase) {
        setShowUnlockModal(true)
        return
      }

      try {
        setDecryptingId(receipt.id)
        const decrypted = await decryptStringWithPassphrase(
          receipt.ocrPayloadEncrypted,
          vaultPassphrase,
        )
        setDecryptedPayloads((current) => ({
          ...current,
          [receipt.id]: decrypted,
        }))
      } catch {
        toast.error("Could not decrypt this receipt on this device")
      } finally {
        setDecryptingId(null)
      }

      return
    }

    setDecryptedPayloads((current) => ({
      ...current,
      [receipt.id]: receipt.ocrPayloadEncrypted,
    }))
  }

  async function toggleReimbursable(receipt: ReceiptItem) {
    await updateReceipt.mutateAsync({
      id: receipt.id,
      reimbursable: !receipt.reimbursable,
    })
  }

  async function snoozeReceipt(receipt: ReceiptItem) {
    const snoozedUntil = new Date()
    snoozedUntil.setDate(snoozedUntil.getDate() + 7)

    await updateReceipt.mutateAsync({
      id: receipt.id,
      snoozedUntil,
    })
  }

  async function exportVisibleReceipts() {
    const exportRows = await Promise.all(
      visibleReceipts.map(async (receipt) => {
        let payload = decryptedPayloads[receipt.id] || receipt.ocrPayloadEncrypted

        if (isVaultPayload(payload) && vaultPassphrase) {
          try {
            payload = await decryptStringWithPassphrase(payload, vaultPassphrase)
          } catch {
            payload = "[locked]"
          }
        } else if (isVaultPayload(payload)) {
          payload = "[locked]"
        }

        return {
          id: receipt.id,
          merchant: receipt.merchant,
          amount: Number(receipt.amountPaise) / 100,
          purchaseDate: receipt.purchaseDate?.toISOString() || null,
          returnBy: receipt.returnBy?.toISOString() || null,
          warrantyUntil: receipt.warrantyUntil?.toISOString() || null,
          reimbursable: receipt.reimbursable,
          snoozedUntil: receipt.snoozedUntil?.toISOString() || null,
          payload,
        }
      }),
    )

    const blob = new Blob([JSON.stringify(exportRows, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `receipt-vault-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Export prepared")
  }

  return (
    <div className="space-y-8 p-8">
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-neo-md border-brutal-thick bg-gradient-to-br from-paper-2 via-paper-1 to-teal/20 p-6 shadow-brutal"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              <Shield size={14} />
              Receipt Vault
            </div>
            <div>
              <h1 className="font-serif text-4xl font-bold text-ink">Receipts that can actually work for you</h1>
              <p className="mt-2 text-sm text-ink/70">
                OCR scan, local-first vault encryption, deadline reminders, reimbursement tracking,
                and export in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={createReceipt.isPending}
                className="inline-flex items-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-3 text-sm font-semibold text-ink shadow-brutal-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-60"
              >
                {createReceipt.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {createReceipt.isPending ? "Scanning..." : "Scan receipt"}
              </button>
              <button
                onClick={vaultPassphrase ? handleLock : () => setShowUnlockModal(true)}
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-paper-1"
              >
                {vaultPassphrase ? <Unlock size={16} /> : <Lock size={16} />}
                {vaultPassphrase ? "Lock vault" : "Unlock vault"}
              </button>
              <button
                onClick={exportVisibleReceipts}
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-paper-1"
              >
                <Download size={16} />
                Export visible
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Stored</p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">{summary.totalReceipts}</p>
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Need attention</p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">{summary.expiringCount}</p>
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Tracked value</p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">{formatCurrency(summary.totalValue)}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <div className="rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Watchlist</p>
            {expiring.isLoading ? (
              <div className="text-sm text-taupe">Checking deadlines...</div>
            ) : expiring.data?.filter((receipt) => !isSnoozed(receipt)).length ? (
              <div className="space-y-3">
                {expiring.data
                  ?.filter((receipt) => !isSnoozed(receipt))
                  .slice(0, 4)
                  .map((receipt) => (
                    <div key={receipt.id} className="rounded-neo border-brutal bg-paper-1 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{receipt.merchant}</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-taupe">
                          {withinDays(receipt, 7) ? "Urgent" : "Soon"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-taupe">
                        {receipt.returnBy ? "Return by" : "Warranty until"} {toDisplayDate(receiptDeadline(receipt) || undefined)}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-neo border-brutal bg-paper-1 p-6 text-center">
                <p className="font-serif text-xl font-bold text-ink">Quiet board</p>
                <p className="mt-2 text-sm text-taupe">
                  No return or warranty deadlines are due soon.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Vault state</p>
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <div className="mb-2 flex items-center gap-2 text-ink">
                {vaultPassphrase ? <Unlock size={16} /> : <Lock size={16} />}
                <p className="font-semibold">
                  {vaultPassphrase ? "Unlocked on this device" : "Locked"}
                </p>
              </div>
              <p className="text-sm text-taupe">
                New scans are {vaultPassphrase ? "stored with vault encryption" : "stored as readable OCR payloads until you unlock and rescan"}.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Library</p>
              <h2 className="font-serif text-2xl font-bold text-ink">Receipt vault</h2>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-taupe" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search merchants, return, warranty, reimbursable"
                className="w-full rounded-neo border-brutal bg-paper-1 py-3 pl-10 pr-4 text-sm text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {[
              { key: "all" as const, label: "All" },
              { key: "expiring" as const, label: `Expiring (${summary.expiringCount})` },
              { key: "reimbursable" as const, label: `Reimbursable (${summary.reimbursableCount})` },
            ].map((entry) => (
              <button
                key={entry.key}
                onClick={() => setTab(entry.key)}
                className={`rounded-neo border-brutal px-4 py-2 text-sm font-semibold transition-all ${
                  tab === entry.key
                    ? "bg-ink text-paper-1 shadow-brutal-sm"
                    : "bg-paper-1 text-ink hover:bg-paper-2"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {receipts.isLoading ? (
            <div className="py-10 text-center text-taupe">Loading receipts...</div>
          ) : !visibleReceipts.length ? (
            <div className="rounded-neo border-brutal bg-paper-1 p-10 text-center">
              <FileSearch className="mx-auto mb-3 text-taupe" size={30} />
              <p className="font-serif text-xl font-bold text-ink">Nothing matches this view</p>
              <p className="mt-2 text-sm text-taupe">
                Try another filter or scan a fresh receipt into the vault.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleReceipts.map((receipt, index) => {
                const payload = decryptedPayloads[receipt.id]
                const preview = extractPreview(payload)
                const open = activeReceiptId === receipt.id

                return (
                  <motion.div
                    key={receipt.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-neo-md border-brutal bg-paper-1 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-serif text-2xl font-bold text-ink">{receipt.merchant}</p>
                          {expiringIds.has(receipt.id) ? (
                            <span className="rounded-full border-brutal bg-danger/10 px-2 py-0.5 text-xs font-semibold text-ink">
                              Action soon
                            </span>
                          ) : null}
                          {receipt.reimbursable ? (
                            <span className="rounded-full border-brutal bg-cobalt/10 px-2 py-0.5 text-xs font-semibold text-ink">
                              Reimbursable
                            </span>
                          ) : null}
                          {isSnoozed(receipt) ? (
                            <span className="rounded-full border-brutal bg-mustard/20 px-2 py-0.5 text-xs font-semibold text-ink">
                              Snoozed
                            </span>
                          ) : null}
                        </div>
                        <p className="font-serif text-3xl font-bold text-ink">
                          {formatCurrency(Number(receipt.amountPaise) / 100)}
                        </p>
                        <div className="grid gap-1 text-sm text-taupe sm:grid-cols-3">
                          <p className="flex items-center gap-1">
                            <Calendar size={12} />
                            Bought {toDisplayDate(receipt.purchaseDate)}
                          </p>
                          <p className="flex items-center gap-1">
                            <Package size={12} />
                            Return {toDisplayDate(receipt.returnBy)}
                          </p>
                          <p className="flex items-center gap-1">
                            <Shield size={12} />
                            Warranty {toDisplayDate(receipt.warrantyUntil)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => showPreview(receipt)}
                          className="rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm font-semibold text-ink hover:bg-paper-1"
                        >
                          {open ? "Hide OCR" : "Show OCR"}
                        </button>
                        <button
                          onClick={() => toggleReimbursable(receipt)}
                          disabled={updateReceipt.isPending}
                          className="rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm font-semibold text-ink hover:bg-paper-1 disabled:opacity-60"
                        >
                          {receipt.reimbursable ? "Mark personal" : "Mark reimbursable"}
                        </button>
                        {(receipt.returnBy || receipt.warrantyUntil) && !isSnoozed(receipt) ? (
                          <button
                            onClick={() => snoozeReceipt(receipt)}
                            disabled={updateReceipt.isPending}
                            className="rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm font-semibold text-ink hover:bg-paper-1 disabled:opacity-60"
                          >
                            Snooze 7 days
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {open ? (
                      <div className="mt-4 rounded-neo border-brutal bg-paper-2 p-4">
                        {decryptingId === receipt.id ? (
                          <div className="flex items-center gap-2 text-sm text-taupe">
                            <Loader2 size={14} className="animate-spin" />
                            Unlocking payload...
                          </div>
                        ) : preview ? (
                          <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-neo border-brutal bg-paper-1 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taupe">Merchant</p>
                                <p className="mt-1 text-sm text-ink">{preview.merchant || receipt.merchant}</p>
                              </div>
                              <div className="rounded-neo border-brutal bg-paper-1 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taupe">OCR amount</p>
                                <p className="mt-1 text-sm text-ink">
                                  {preview.amount ? formatCurrency(preview.amount) : "Not found"}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-neo border-brutal bg-paper-1 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taupe">Items</p>
                              {preview.items.length ? (
                                <ul className="mt-2 space-y-1 text-sm text-ink">
                                  {preview.items.slice(0, 6).map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-sm text-taupe">No line items extracted.</p>
                              )}
                            </div>
                          </div>
                        ) : isVaultPayload(receipt.ocrPayloadEncrypted) && !vaultPassphrase ? (
                          <div className="flex items-center gap-2 text-sm text-taupe">
                            <Lock size={14} />
                            Unlock the vault to inspect OCR details.
                          </div>
                        ) : (
                          <p className="text-sm text-taupe">No preview data available for this receipt.</p>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {showUnlockModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4"
            onClick={() => setShowUnlockModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-neo-md border-brutal-thick bg-paper-1 p-6 shadow-brutal"
            >
              <h3 className="font-serif text-2xl font-bold text-ink">Unlock vault</h3>
              <p className="mt-2 text-sm text-taupe">
                The passphrase never leaves this browser session. It only decrypts local receipt payloads on demand.
              </p>
              <input
                type="password"
                value={unlockInput}
                onChange={(event) => setUnlockInput(event.target.value)}
                placeholder="Vault passphrase"
                className="mt-5 w-full rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleUnlock()
                  }
                }}
              />
              <button
                onClick={() => void handleUnlock()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-3 text-sm font-semibold text-ink shadow-brutal-sm disabled:opacity-60"
                disabled={!unlockInput}
              >
                <Unlock size={16} />
                Unlock on this device
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
