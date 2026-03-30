"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { Shield, AlertTriangle, TrendingUp, DollarSign, Calendar } from "lucide-react";
import {
    computeCashflow, applyWhatIf,
    type RecurringEvent
} from "@/lib/engine/cashflow";
import { InlineErrorState, ScreenEmptyState } from "@/components/app/screen-states";
import { NeoButton } from "@/components/ui/neo-button";
import { recurringClient, insightsClient } from "@/lib/rpc/clients";

const CONFIDENCE_CONFIG = {
    high: { label: "High Confidence", color: "bg-success/15 text-success border-success/30", icon: Shield },
    medium: { label: "Medium", color: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
    low: { label: "Low", color: "bg-danger/15 text-danger border-danger/30", icon: AlertTriangle },
};

export default function CashflowPage() {
    const [rules, setRules] = useState<RecurringEvent[]>([]);
    const [balance, setBalance] = useState(0);
    const [whatIfAmount, setWhatIfAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        let active = true;

        setLoading(true);
        setError(null);

        Promise.all([
            recurringClient.listUpcoming({ daysAhead: 60 }),
            insightsClient.getSummary({ monthYear: currentMonth }),
        ]).then(([upcoming, summary]) => {
            if (!active) {
                return;
            }
            const mapped: RecurringEvent[] = (upcoming.rules || []).map((r) => ({
                amount: Number(r.amountPaise) / 100,
                type: r.amountPaise < BigInt(0) ? "bill" : "income",
                cadence: r.cadence as any,
                nextDueDate: r.nextDueDate?.toDate().toISOString() || new Date().toISOString(),
                merchant: r.merchantNorm,
            }));
            setRules(mapped);
            setBalance(Number(summary.balancePaise) / 100);
            setLoading(false);
        }).catch(err => {
            if (!active) {
                return;
            }
            setError(err instanceof Error ? err.message : "Failed to load cashflow data.");
            setLoading(false);
        });

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const baseResult = useMemo(() => {
        return computeCashflow({
            currentBalance: balance,
            recurringRules: rules,
            daysToProject: 60,
        });
    }, [balance, rules]);

    const result = useMemo(() => {
        if (whatIfAmount <= 0) return baseResult;
        const today = new Date().toISOString().slice(0, 10);
        return applyWhatIf(baseResult, whatIfAmount, today);
    }, [baseResult, whatIfAmount]);

    const conf = CONFIDENCE_CONFIG[result.forecastConfidence];
    const ConfIcon = conf.icon;

    const chartData = result.projections.map((p) => ({
        date: p.date.slice(5), // MM-DD
        balance: p.projectedBalance,
        isGap: p.isGapDay ? p.projectedBalance : null,
    }));

    if (loading) {
        return (
            <div className="neo-surface-lg p-8 text-center text-taupe">Loading cashflow data...</div>
        );
    }

    if (error) {
        return (
            <InlineErrorState
                title="Cashflow data is unavailable"
                description={error}
                onRetry={() => setReloadKey((value) => value + 1)}
            />
        );
    }

    if (rules.length === 0) {
        return (
            <ScreenEmptyState
                icon={Calendar}
                title="No recurring events yet"
                description="Add recurring income and bills to unlock a real 60-day forecast."
                cta={{
                    label: "Retry",
                    onClick: () => setReloadKey((value) => value + 1),
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-serif text-3xl font-bold text-ink mb-1">Cashflow Radar</h1>
                <p className="text-taupe mb-6">Your 60-day financial forecast</p>
            </motion.div>

            {/* Hero Stats */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
                {[
                    {
                        label: "Safe to Spend Today",
                        value: `₹${result.safeToSpendToday.toLocaleString("en-IN")}`,
                        icon: DollarSign,
                        color: "bg-success",
                    },
                    {
                        label: "Min Safe Balance",
                        value: `₹${result.minSafeBalance.toLocaleString("en-IN")}`,
                        icon: Shield,
                        color: result.minSafeBalance < 0 ? "bg-danger" : "bg-teal",
                    },
                    {
                        label: "Gap Days",
                        value: result.gapDays.toString(),
                        icon: Calendar,
                        color: result.gapDays > 0 ? "bg-danger" : "bg-success",
                    },
                    {
                        label: "Upcoming Bills",
                        value: `₹${result.totalUpcomingBills.toLocaleString("en-IN")}`,
                        icon: TrendingUp,
                        color: "bg-cta",
                    },
                ].map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="border-brutal-thick rounded-neo-md bg-paper-2 p-5 shadow-brutal"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-taupe">{card.label}</span>
                            <div className={`p-1.5 rounded-neo ${card.color}`}>
                                <card.icon className="h-3.5 w-3.5 text-ink" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold font-serif text-ink tabular-nums">{card.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Forecast Confidence Badge */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`inline-flex items-center gap-2 border-brutal rounded-neo px-3 py-1.5 text-sm font-medium mb-6 ${conf.color}`}
            >
                <ConfIcon size={14} />
                Forecast: {conf.label}
                {result.forecastConfidence === "low" && (
                    <span className="text-xs opacity-75">— Add recurring bills & income to improve</span>
                )}
            </motion.div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal mb-8"
            >
                <h2 className="font-serif text-lg font-bold text-ink mb-4">Projected Balance (60 days)</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--taupe)" opacity={0.2} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "var(--taupe)" }}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: "var(--taupe)" }}
                            tickLine={false}
                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "var(--paper-2)",
                                border: "1.5px solid var(--ink)",
                                borderRadius: "8px",
                                fontSize: "12px",
                            }}
                            formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Balance"]}
                        />
                        <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="var(--cobalt)"
                            fill="var(--cobalt)"
                            fillOpacity={0.15}
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="isGap"
                            stroke="var(--danger)"
                            fill="var(--danger)"
                            fillOpacity={0.3}
                            strokeWidth={0}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </motion.div>

            {/* What-if Slider */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
            >
                <h2 className="font-serif text-lg font-bold text-ink mb-2">What-if Simulator</h2>
                <p className="text-sm text-taupe mb-4">
                    Slide to see how spending ₹X today affects your forecast.
                </p>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min={0}
                        max={Math.max(balance, 10000)}
                        step={100}
                        value={whatIfAmount}
                        onChange={(e) => setWhatIfAmount(Number(e.target.value))}
                        className="flex-1 accent-cta"
                    />
                    <div className="border-brutal rounded-neo bg-paper-1 px-4 py-2 font-bold font-serif tabular-nums text-ink min-w-[100px] text-center">
                        ₹{whatIfAmount.toLocaleString("en-IN")}
                    </div>
                </div>
                <div className="mt-4">
                    <NeoButton variant="secondary" size="sm" onClick={() => setWhatIfAmount(0)}>
                        Reset scenario
                    </NeoButton>
                </div>
                {whatIfAmount > 0 && (
                    <div className="mt-3 text-sm text-taupe">
                        Gap days would change to{" "}
                        <span className={result.gapDays > baseResult.gapDays ? "text-danger font-medium" : "text-success font-medium"}>
                            {result.gapDays}
                        </span>{" "}
                        (was {baseResult.gapDays})
                    </div>
                )}
            </motion.div>
        </div>
    );
}
