import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Building2, CreditCard, Landmark, PiggyBank, Plus, Trash2, Wallet } from "lucide-react"
import { useAccounts, useCreateAccount, useDeleteAccount, useLiabilities, useCreateLiability, useDeleteLiability } from "@/lib/hooks/use-accounts"
import { formatCurrency } from "@/lib/utils"
import { useConfirmAccountBalance } from "@/lib/hooks/use-pilot"

function balanceFreshness(balanceAsOf?: { toDate(): Date }) {
  if (!balanceAsOf) return "Balance not confirmed";
  const date = balanceAsOf.toDate();
  const ageDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  return ageDays > 7 ? `Needs review · ${ageDays} days old` : `Confirmed ${date.toLocaleDateString("en-IN")}`;
}

function AddAccountForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const createAccount = useCreateAccount()
  const [formData, setFormData] = useState({
    accountType: "SAVINGS",
    institutionName: "",
    accountName: "",
    balance: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createAccount.mutate({
      accountType: formData.accountType,
      institutionName: formData.institutionName,
      accountName: formData.accountName,
      balancePaise: BigInt(Math.round(parseFloat(formData.balance || "0") * 100)),
      currency: "INR"
    }, {
      onSuccess: () => {
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-neo border-brutal bg-paper-1 p-4 mb-6">
      <h3 className="font-semibold text-ink">Add New Account</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Type</label>
          <select
            value={formData.accountType}
            onChange={(e) => setFormData(s => ({ ...s, accountType: e.target.value }))}
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          >
            <option value="SAVINGS">Savings</option>
            <option value="CURRENT">Current</option>
            <option value="CASH">Cash</option>
            <option value="WALLET">Wallet</option>
            <option value="CREDIT_CARD">Credit card ledger</option>
            <option value="INVESTMENT">Investment</option>
            <option value="PF">Provident Fund</option>
            <option value="PPF">PPF</option>
            <option value="FD">Fixed Deposit</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Institution / Bank</label>
          <input
            type="text"
            value={formData.institutionName}
            onChange={(e) => setFormData(s => ({ ...s, institutionName: e.target.value }))}
            placeholder="e.g. HDFC Bank"
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Account Name</label>
          <input
            type="text"
            value={formData.accountName}
            onChange={(e) => setFormData(s => ({ ...s, accountName: e.target.value }))}
            placeholder="e.g. Salary Account"
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Current Balance (₹)</label>
          {formData.accountType === "CREDIT_CARD" ? <p className="mb-2 text-xs text-taupe">Enter an outstanding card balance as a negative amount. Record card payments as transfers from your bank account, so purchases are not counted twice.</p> : null}
          <input
            type="number"
            step="0.01"
            value={formData.balance}
            onChange={(e) => setFormData(s => ({ ...s, balance: e.target.value }))}
            placeholder="0.00"
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-taupe hover:text-ink">Cancel</button>
        <button type="submit" disabled={createAccount.isPending} className="rounded-neo border-brutal-thick bg-cta px-4 py-2 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:shadow-brutal-sm transition-all disabled:opacity-50">
          Save Account
        </button>
      </div>
    </form>
  )
}

function AddLiabilityForm({ accounts, onSuccess, onCancel }: { accounts: any[], onSuccess: () => void, onCancel: () => void }) {
  const createLiability = useCreateLiability()
  const [formData, setFormData] = useState({
    accountId: "",
    liabilityType: "CREDIT_CARD",
    outstanding: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createLiability.mutate({
      accountId: formData.accountId || undefined,
      liabilityType: formData.liabilityType,
      principalPaise: BigInt(0),
      outstandingPaise: BigInt(Math.round(parseFloat(formData.outstanding || "0") * 100)),
    }, {
      onSuccess: () => {
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-neo border-brutal bg-paper-1 p-4 mb-6">
      <h3 className="font-semibold text-ink">Add New Liability</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Type</label>
          <select
            value={formData.liabilityType}
            onChange={(e) => setFormData(s => ({ ...s, liabilityType: e.target.value }))}
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          >
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="PERSONAL_LOAN">Personal Loan</option>
            <option value="HOME_LOAN">Home Loan</option>
            <option value="VEHICLE_LOAN">Vehicle Loan</option>
            <option value="BNPL">Buy Now Pay Later</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Linked Account (Optional)</label>
          <select
            value={formData.accountId}
            onChange={(e) => setFormData(s => ({ ...s, accountId: e.target.value }))}
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
          >
            <option value="">-- None --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} ({a.institutionName})</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-taupe">Outstanding Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            value={formData.outstanding}
            onChange={(e) => setFormData(s => ({ ...s, outstanding: e.target.value }))}
            placeholder="0.00"
            className="w-full rounded-neo border-brutal bg-paper-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-taupe hover:text-ink">Cancel</button>
        <button type="submit" disabled={createLiability.isPending} className="rounded-neo border-brutal-thick bg-danger px-4 py-2 text-sm font-semibold text-paper-1 hover:-translate-y-0.5 hover:shadow-brutal-sm transition-all disabled:opacity-50">
          Save Liability
        </button>
      </div>
    </form>
  )
}

export function AccountsManager() {
  const accounts = useAccounts()
  const liabilities = useLiabilities()
  const deleteAccount = useDeleteAccount()
  const deleteLiability = useDeleteLiability()

  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddLiability, setShowAddLiability] = useState(false)
  const [confirmingAccountId, setConfirmingAccountId] = useState<string | null>(null)
  const [confirmedAmount, setConfirmedAmount] = useState("")
  const confirmBalance = useConfirmAccountBalance()

  const getIcon = (type: string) => {
    switch (type) {
      case "SAVINGS": case "CURRENT": return <Landmark size={18} />
      case "CASH": return <Wallet size={18} />
      case "CREDIT_CARD": return <CreditCard size={18} />
      case "PF": case "PPF": case "FD": case "INVESTMENT": return <PiggyBank size={18} />
      default: return <Building2 size={18} />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Assets & Accounts</h3>
          <button
            onClick={() => setShowAddAccount(true)}
            className="inline-flex items-center gap-1 rounded-neo border-brutal bg-paper-1 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-2"
          >
            <Plus size={14} /> Add Asset
          </button>
        </div>

        <AnimatePresence>
          {showAddAccount && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <AddAccountForm onSuccess={() => setShowAddAccount(false)} onCancel={() => setShowAddAccount(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {accounts.isLoading ? (
          <div className="text-sm text-taupe">Loading...</div>
        ) : !accounts.data?.length ? (
          <div className="rounded-neo border-dashed border-brutal-thick p-6 text-center text-taupe text-sm">
            No accounts added. Start by adding your bank accounts or cash.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.data.map(account => (
              <div key={account.id} className="flex items-center justify-between rounded-neo border-brutal bg-paper-1 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-neo border-brutal bg-paper-2 text-ink">
                    {getIcon(account.accountType)}
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm leading-tight">{account.accountName}</p>
                    <p className="text-xs text-taupe">{account.institutionName}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-serif font-bold text-ink">{formatCurrency(Number(account.balancePaise)/100)}</p>
                  <p className={`text-[11px] ${!account.balanceAsOf || Date.now() - account.balanceAsOf.toDate().getTime() > 7 * 86400000 ? "text-warning" : "text-taupe"}`}>{balanceFreshness(account.balanceAsOf)}</p>
                  {confirmingAccountId === account.id ? (
                    <form className="mt-1 flex items-center gap-1" onSubmit={(event) => {
                      event.preventDefault()
                      if (!confirmedAmount || !Number.isFinite(Number(confirmedAmount)) || Number(confirmedAmount) < 0) return
                      confirmBalance.mutate({ accountId: account.id, balancePaise: BigInt(Math.round(Number(confirmedAmount) * 100)) }, {
                        onSuccess: () => { setConfirmingAccountId(null); setConfirmedAmount("") },
                      })
                    }}>
                      <label className="sr-only" htmlFor={`balance-${account.id}`}>Confirmed balance in rupees</label>
                      <input id={`balance-${account.id}`} autoFocus type="number" step="0.01" inputMode="decimal" value={confirmedAmount} onChange={(event) => setConfirmedAmount(event.target.value)} placeholder="₹ balance" className="w-24 rounded border-brutal bg-paper-2 px-2 py-1 text-xs" />
                      <button type="submit" disabled={confirmBalance.isPending || !confirmedAmount} className="text-xs font-semibold underline disabled:opacity-50">{confirmBalance.isPending ? "Saving…" : "Confirm"}</button>
                      <button type="button" onClick={() => { setConfirmingAccountId(null); setConfirmedAmount("") }} className="text-xs text-taupe">Cancel</button>
                      {confirmBalance.isError ? <span role="alert" className="basis-full text-xs text-danger">Balance could not be confirmed. Retry.</span> : null}
                    </form>
                  ) : <button type="button" onClick={() => { setConfirmedAmount((Number(account.balancePaise) / 100).toString()); setConfirmingAccountId(account.id) }} className="text-xs font-semibold underline underline-offset-4">Confirm balance</button>}
                  <button onClick={() => deleteAccount.mutate(account.id)} className="text-taupe hover:text-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 mt-6">
          <h3 className="font-semibold text-ink">Debts & Liabilities</h3>
          <button
            onClick={() => setShowAddLiability(true)}
            className="inline-flex items-center gap-1 rounded-neo border-brutal bg-paper-1 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-2"
          >
            <Plus size={14} /> Add Liability
          </button>
        </div>

        <AnimatePresence>
          {showAddLiability && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <AddLiabilityForm accounts={accounts.data || []} onSuccess={() => setShowAddLiability(false)} onCancel={() => setShowAddLiability(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {liabilities.isLoading ? (
          <div className="text-sm text-taupe">Loading...</div>
        ) : !liabilities.data?.length ? (
          <div className="rounded-neo border-dashed border-brutal-thick p-6 text-center text-taupe text-sm">
            No liabilities tracked. Good job!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {liabilities.data.map(liab => (
              <div key={liab.id} className="flex items-center justify-between rounded-neo border-brutal bg-danger/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-neo border-brutal bg-paper-1 text-danger">
                    {getIcon(liab.liabilityType)}
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm leading-tight">{liab.liabilityType.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-serif font-bold text-danger">{formatCurrency(Number(liab.outstandingPaise)/100)}</p>
                  <button onClick={() => deleteLiability.mutate(liab.id)} className="text-taupe hover:text-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
