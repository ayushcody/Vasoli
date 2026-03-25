"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Target, Plus, Flame, Trophy, Loader2, Calendar,
    TrendingUp, X, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { goalClient } from "@/lib/rpc/clients";
import { Goal } from "@/gen/vasoli/v1/goal_pb";
import { Timestamp } from "@bufbuild/protobuf";

interface GoalData {
    id: string;
    name: string;
    description: string | null;
    targetAmount: number;
    currentAmount: number;
    cadence: string | null;
    dueDate: string | null;
    active: boolean;
    color: string | null;
    icon: string | null;
    createdAt: string;
    // contributions: { id: string; amount: number; note: string | null; createdAt: string }[];
}

const ICONS = ["🎯", "🏠", "✈️", "🚗", "💍", "📱", "🎓", "💰", "🏖️", "🎸"];
const COLORS = ["#E8B931", "#1A936F", "#6C63FF", "#E76F51", "#264653", "#2A9D8F", "#E9C46A", "#F4A261"];

export default function GoalsPage() {
    const [goals, setGoals] = useState<GoalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: "",
        description: "",
        targetAmount: "",
        dueDate: "",
        icon: "🎯",
        color: COLORS[0],
    });

    useEffect(() => {
        goalClient.listGoals({})
            .then((res) => {
                setGoals(res.goals.map(g => ({
                    id: g.id,
                    name: g.name,
                    description: g.description || null,
                    targetAmount: Number(g.targetAmountPaise) / 100,
                    currentAmount: Number(g.currentAmountPaise) / 100,
                    cadence: g.cadence || null,
                    dueDate: g.dueDate?.toDate().toISOString() || null,
                    active: g.active,
                    color: g.color || null,
                    icon: g.icon || null,
                    createdAt: g.createdAt?.toDate().toISOString() || new Date().toISOString(),
                })));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!form.name || !form.targetAmount) {
            toast.error("Name and target amount are required!");
            return;
        }
        setCreating(true);
        try {
            const dueDate = form.dueDate ? Timestamp.fromDate(new Date(form.dueDate)) : undefined;
            const res = await goalClient.createGoal({
                name: form.name,
                description: form.description || undefined,
                targetAmountPaise: BigInt(Math.round(parseFloat(form.targetAmount) * 100)),
                dueDate: dueDate,
                icon: form.icon,
                color: form.color,
            });

            const newGoal: GoalData = {
                id: res.goal!.id,
                name: res.goal!.name,
                description: res.goal!.description || null,
                targetAmount: Number(res.goal!.targetAmountPaise) / 100,
                currentAmount: Number(res.goal!.currentAmountPaise) / 100,
                cadence: res.goal!.cadence || null,
                dueDate: res.goal!.dueDate?.toDate().toISOString() || null,
                active: res.goal!.active,
                color: res.goal!.color || null,
                icon: res.goal!.icon || null,
                createdAt: res.goal!.createdAt?.toDate().toISOString() || new Date().toISOString(),
            };
            setGoals((prev) => [newGoal, ...prev]);
            setForm({ name: "", description: "", targetAmount: "", dueDate: "", icon: "🎯", color: COLORS[0] });
            setShowCreate(false);
            toast.success(`Goal "${newGoal.name}" created!`);
        } catch (err) {
            console.error("Create goal error:", err);
            toast.error("Failed to create goal");
        } finally {
            setCreating(false);
        }
    };

    const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
    const activeGoals = goals.filter((g) => g.active);
    const completedGoals = goals.filter((g) => !g.active);

    const totalTarget = activeGoals.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved = activeGoals.reduce((s, g) => s + g.currentAmount, 0);

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="font-serif text-3xl font-bold text-ink mb-1">Savings Goals</h1>
                        <p className="text-taupe">Track progress towards your financial goals</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreate(true)}
                        className="border-brutal-thick rounded-neo bg-cta text-ink px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-brutal-sm hover:shadow-brutal transition-all"
                    >
                        <Plus size={16} /> New Goal
                    </motion.button>
                </div>
            </motion.div>

            {/* Summary Strip */}
            {!loading && activeGoals.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-brutal rounded-neo bg-teal/10 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap"
                >
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <Flame size={16} className="text-cta" />
                            <span className="text-ink font-medium">{activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-taupe">•</span>
                        <span className="text-ink font-medium tabular-nums">{fmt(totalSaved)} saved of {fmt(totalTarget)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-40 h-2 bg-paper-1 rounded-full border border-taupe/20">
                            <div
                                className="h-full bg-teal rounded-full transition-all"
                                style={{ width: `${totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0}%` }}
                            />
                        </div>
                        <span className="text-xs text-taupe font-medium tabular-nums">
                            {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
                        </span>
                    </div>
                </motion.div>
            )}

            {/* Goals Grid */}
            {loading ? (
                <div className="text-center py-12 text-taupe">Loading goals...</div>
            ) : goals.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-12 shadow-brutal text-center"
                >
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="font-serif text-xl font-bold text-ink mb-2">No Goals Yet</h3>
                    <p className="text-taupe mb-6 max-w-md mx-auto">
                        Set a savings goal to start tracking your progress. Whether it&apos;s an emergency fund, a vacation, or a new gadget — Vasoli will help you get there.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCreate(true)}
                        className="border-brutal-thick rounded-neo bg-cta text-ink px-6 py-3 text-sm font-semibold flex items-center gap-2 shadow-brutal-sm hover:shadow-brutal transition-all mx-auto"
                    >
                        <Sparkles size={16} /> Create Your First Goal
                    </motion.button>
                </motion.div>
            ) : (
                <>
                    {/* Active Goals */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                        {activeGoals.map((goal, i) => {
                            const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                            const daysLeft = goal.dueDate ? Math.ceil((new Date(goal.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                            return (
                                <motion.div
                                    key={goal.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-5 shadow-brutal hover:shadow-brutal-hover transition-all relative overflow-hidden"
                                >
                                    {/* Color accent bar */}
                                    <div
                                        className="absolute top-0 left-0 right-0 h-1"
                                        style={{ backgroundColor: goal.color || COLORS[0] }}
                                    />

                                    <div className="flex items-start justify-between mb-3 mt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{goal.icon || "🎯"}</span>
                                            <div>
                                                <h3 className="font-medium text-ink text-sm">{goal.name}</h3>
                                                {goal.description && (
                                                    <p className="text-xs text-taupe mt-0.5 line-clamp-1">{goal.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        {progress >= 100 && (
                                            <Trophy size={18} className="text-cta flex-shrink-0" />
                                        )}
                                    </div>

                                    {/* Amount */}
                                    <div className="mb-3">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-xl font-bold font-serif text-ink tabular-nums">
                                                {fmt(goal.currentAmount)}
                                            </span>
                                            <span className="text-xs text-taupe tabular-nums">
                                                of {fmt(goal.targetAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-3 bg-paper-1 rounded-full border border-taupe/20 mb-3">
                                        <motion.div
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: goal.color || COLORS[0] }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                        />
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between text-xs text-taupe">
                                        <span className="font-medium tabular-nums">{progress}% complete</span>
                                        {daysLeft !== null && (
                                            <div className="flex items-center gap-1">
                                                <Calendar size={10} />
                                                {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Due today" : "Overdue"}
                                            </div>
                                        )}
                                    </div>

                                    {/* Contributions count stub */}
                                    {/* {goal.contributions && goal.contributions.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-taupe/10 text-xs text-taupe flex items-center gap-1">
                                            <TrendingUp size={10} />
                                            {goal.contributions.length} contribution{goal.contributions.length !== 1 ? "s" : ""}
                                        </div>
                                    )} */}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Completed Goals */}
                    {completedGoals.length > 0 && (
                        <div>
                            <h2 className="font-serif text-lg font-bold text-taupe mb-3 flex items-center gap-2">
                                <Trophy size={16} /> Completed
                            </h2>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {completedGoals.map((goal) => (
                                    <div
                                        key={goal.id}
                                        className="border-brutal rounded-neo bg-paper-2/60 p-4 flex items-center gap-3 opacity-70"
                                    >
                                        <span className="text-lg">{goal.icon || "🎯"}</span>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-ink">{goal.name}</p>
                                            <p className="text-xs text-taupe tabular-nums">{fmt(goal.targetAmount)} reached</p>
                                        </div>
                                        <Trophy size={14} className="text-cta" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Create Goal Modal */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowCreate(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="border-brutal-thick rounded-neo-md bg-paper-1 p-6 shadow-brutal w-full max-w-md"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-serif text-xl font-bold text-ink">🎯 New Goal</h3>
                                <button onClick={() => setShowCreate(false)} className="text-taupe hover:text-ink">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Icon picker */}
                                <div>
                                    <label className="text-xs font-medium text-taupe mb-1 block">Icon</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {ICONS.map((ic) => (
                                            <button
                                                key={ic}
                                                onClick={() => setForm({ ...form, icon: ic })}
                                                className={`text-xl p-1.5 rounded-neo transition-all ${form.icon === ic
                                                    ? "border-brutal bg-cta/20 shadow-brutal-sm scale-110"
                                                    : "hover:bg-paper-2"
                                                    }`}
                                            >
                                                {ic}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color picker */}
                                <div>
                                    <label className="text-xs font-medium text-taupe mb-1 block">Color</label>
                                    <div className="flex gap-2">
                                        {COLORS.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setForm({ ...form, color: c })}
                                                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-ink scale-110" : "border-transparent"
                                                    }`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Name */}
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Goal name (e.g. Emergency Fund)"
                                    className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-2 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink"
                                />

                                {/* Description */}
                                <input
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Short description (optional)"
                                    className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-2 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink"
                                />

                                {/* Target Amount */}
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-taupe font-medium">₹</span>
                                    <input
                                        type="number"
                                        value={form.targetAmount}
                                        onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                                        placeholder="Target amount"
                                        className="w-full border-brutal rounded-neo pl-8 pr-4 py-3 bg-paper-2 text-ink placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink tabular-nums"
                                    />
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className="text-xs font-medium text-taupe mb-1 block">Due date (optional)</label>
                                    <input
                                        type="date"
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        className="w-full border-brutal rounded-neo px-4 py-3 bg-paper-2 text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                                    />
                                </div>

                                <motion.button
                                    onClick={handleCreate}
                                    disabled={creating || !form.name || !form.targetAmount}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full border-brutal-thick rounded-neo bg-cta text-ink font-semibold py-3 flex items-center justify-center gap-2 shadow-brutal-sm disabled:opacity-40 transition-all"
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                                    {creating ? "Creating..." : "Create Goal"}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
