"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Receipt, Plus, Filter, AlertTriangle, CheckCircle2,
    Clock, FileSpreadsheet, Smartphone, Camera, Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { format } from "date-fns";
import {
    transactionClient,
    insightsClient
} from "@/lib/rpc/clients";
import { Transaction } from "@/gen/vasoli/v1/transaction_pb";
import { GetSummaryResponse } from "@/gen/vasoli/v1/insights_pb";

interface TransactionData {
    id: string;
    date: string;
    amount: number;
    type: string;
    merchantRaw: string | null;
    merchantNorm: string | null;
    description: string | null;
    status: string;
    provenance: string;
    category: { name: string; icon: string; color: string } | null;
}

interface SummaryData {
    totalIncome: number;
    totalExpense: number;
    balance: number;
}

const PROVENANCE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    MANUAL: { label: "Manual", icon: Plus, color: "bg-paper-2 text-ink" },
    STATEMENT_IMPORT: { label: "Imported", icon: FileSpreadsheet, color: "bg-cobalt/15 text-cobalt" },
    UPI_PAYMENT_INITIATED: { label: "UPI", icon: Smartphone, color: "bg-grape/15 text-grape" },
    RECEIPT_DERIVED: { label: "Receipt", icon: Camera, color: "bg-teal/15 text-teal" },
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionData[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [filter, setFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentMonth = format(new Date(), "yyyy-MM");

        Promise.all([
            transactionClient.listTransactions({}),
            insightsClient.getSummary({ monthYear: currentMonth }),
        ]).then(([txnsRes, sumRes]) => {
            setTransactions(txnsRes.transactions.map(t => ({
                id: t.id,
                date: t.date?.toDate().toISOString() || new Date().toISOString(),
                amount: Number(t.amountPaise) / 100,
                type: t.type,
                merchantRaw: t.merchantRaw,
                description: t.description,
                status: t.status,
                provenance: t.provenance,
                category: t.categoryId ? { name: "Category", icon: "📝", color: "bg-taupe/20" } : null,
                merchantNorm: t.merchantNorm,
            })));

            if (sumRes) {
                setSummary({
                    totalIncome: Number(sumRes.totalIncomePaise) / 100,
                    totalExpense: Number(sumRes.totalExpensePaise) / 100,
                    balance: Number(sumRes.balancePaise) / 100,
                });
            }
            setLoading(false);
        }).catch(err => {
            console.error("RPC error:", err);
            setLoading(false);
        });
    }, []);

    const filtered = transactions.filter((t) => {
        if (filter === "all") return true;
        if (filter === "pending") return t.status === "pending";
        if (filter === "income") return t.type === "INCOME";
        if (filter === "expense") return t.type === "EXPENSE";
        return true;
    });

    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-serif text-3xl font-bold text-ink mb-1">Transactions</h1>
                <p className="text-taupe mb-6">All your financial activity with provenance tracking.</p>
            </motion.div>

            {/* Data Freshness Banner */}
            {summary && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-brutal rounded-neo bg-mustard/20 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
                >
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full bg-success`} />
                            <span className="text-ink font-medium">
                                Data is up to date
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-4 text-sm tabular-nums">
                        <span className="text-success font-medium">↑ ₹{summary.totalIncome.toLocaleString("en-IN")}</span>
                        <span className="text-danger font-medium">↓ ₹{summary.totalExpense.toLocaleString("en-IN")}</span>
                        <span className="text-ink font-bold">= ₹{summary.balance.toLocaleString("en-IN")}</span>
                    </div>
                </motion.div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {[
                    { key: "all", label: "All" },
                    { key: "expense", label: "Expenses" },
                    { key: "income", label: "Income" },
                    { key: "pending", label: "Pending" },
                ].map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`border-brutal rounded-neo px-4 py-2 text-sm font-medium transition-all ${filter === f.key
                            ? "bg-ink text-paper-1 shadow-brutal-sm"
                            : "bg-paper-2 text-taupe hover:bg-paper-2/80"
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Transaction List */}
            {loading ? (
                <div className="text-center py-12 text-taupe">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="border-brutal-thick rounded-neo-md bg-paper-2 p-12 shadow-brutal text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-taupe">No transactions found. Import a statement or add one manually.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {filtered.map((txn, i) => {
                            const prov = PROVENANCE_CONFIG[txn.provenance] || PROVENANCE_CONFIG.manual;
                            const ProvIcon = prov.icon;

                            return (
                                <motion.div
                                    key={txn.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                    className="border-brutal rounded-neo bg-paper-2 p-4 flex items-center gap-4 hover:shadow-brutal-sm transition-all"
                                >
                                    {/* Category emoji */}
                                    <div className="text-2xl flex-shrink-0 w-10 text-center">
                                        {txn.category?.icon || "📝"}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-ink text-sm truncate">
                                                {txn.merchantRaw || txn.description || "Unknown"}
                                            </span>
                                            {txn.status === "pending" && (
                                                <span className="text-xs border-brutal rounded-full px-2 py-0.5 bg-warning/20 text-ink flex items-center gap-1">
                                                    <Clock size={10} /> Pending
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-taupe">
                                                {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                            </span>
                                            {txn.category && (
                                                <span className="text-xs text-taupe">{txn.category.name}</span>
                                            )}
                                            <span className={`text-xs rounded-full px-2 py-0.5 flex items-center gap-1 ${prov.color}`}>
                                                <ProvIcon size={10} />
                                                {prov.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className={`text-right font-bold font-serif tabular-nums ${txn.type === "INCOME" ? "text-success" : "text-ink"}`}>
                                        {txn.type === "INCOME" ? "+" : "-"}₹{txn.amount.toLocaleString("en-IN")}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
