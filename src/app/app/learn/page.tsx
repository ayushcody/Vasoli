"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    BookOpen, Calculator, ShieldAlert, GraduationCap,
    PiggyBank, Receipt, TrendingUp, HandCoins,
    AlertTriangle, ChevronDown, ChevronUp, ArrowRight
} from "lucide-react";
import {
    calculateEmergencyFund,
    calculateGoalContribution,
    estimateRetirementCorpus,
    calculateSubscriptionLeak,
    analyzeDebtStrategy
} from "@/lib/engine/finance-calculators";
import { formatCurrency } from "@/lib/utils";
import { WellnessMilestones } from "@/components/app/wellness-milestones";

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-brutal-thick rounded-neo-md bg-paper-2 overflow-hidden shadow-brutal mb-6">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-6 bg-paper-2 hover:bg-paper-1 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-neo border-brutal bg-mustard text-ink">
                        <Icon size={20} />
                    </div>
                    <h2 className="font-serif text-xl font-bold text-ink">{title}</h2>
                </div>
                {open ? <ChevronUp className="text-taupe" /> : <ChevronDown className="text-taupe" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t-2 border-border/10 bg-paper-1"
                    >
                        <div className="p-6">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function LearnPage() {
    // Calculator States
    const [efExpenses, setEfExpenses] = useState("50000");
    const [efMonths, setEfMonths] = useState("6");

    const [goalTarget, setGoalTarget] = useState("100000");
    const [goalCurrent, setGoalCurrent] = useState("20000");
    const [goalMonths, setGoalMonths] = useState("12");

    const [subAmount, setSubAmount] = useState("999");

    const [retireCurrentAge, setRetireCurrentAge] = useState("30");
    const [retireRetireAge, setRetireRetireAge] = useState("60");
    const [retireExpenses, setRetireExpenses] = useState("50000");

    // Derived
    const efResult = calculateEmergencyFund(Number(efExpenses) || 0, Number(efMonths) || 0);
    const goalResult = calculateGoalContribution(Number(goalTarget) || 0, Number(goalCurrent) || 0, Number(goalMonths) || 0);
    const subResult = calculateSubscriptionLeak(Number(subAmount) || 0);
    const retireResult = estimateRetirementCorpus(
        Number(retireCurrentAge) || 0,
        Number(retireRetireAge) || 0,
        Number(retireExpenses) || 0,
        0.06, 0.08, 85
    );

    return (
        <div className="max-w-4xl pb-12">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cobalt/10 text-cobalt text-xs font-bold uppercase tracking-wider mb-4 border border-cobalt/20">
                    <GraduationCap size={14} /> Vasoli Academy
                </div>
                <h1 className="font-serif text-4xl font-black text-ink mb-3">Financial Education Hub</h1>
                <p className="text-taupe text-lg">Build wealth, kill debt, and master your money with these tools and guides.</p>
                <div className="flex items-start gap-2 mt-4 p-3 rounded-neo bg-mustard/20 border-brutal-sm text-sm text-ink max-w-2xl">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-mustard" />
                    <p><strong>Educational only, not financial advice.</strong> Returns and inflation are assumptions based on historical averages. Always consult a registered advisor for personalized guidance.</p>
                </div>
            </motion.div>

            <div className="mb-8">
                <WellnessMilestones />
            </div>

            {/* 1. Emergency Fund */}
            <Section title="Emergency Fund Basics" icon={ShieldAlert} defaultOpen>
                <p className="text-sm text-taupe mb-4">An emergency fund is your financial shock absorber. It protects you from unexpected expenses like medical emergencies or job loss.</p>

                <div className="grid md:grid-cols-2 gap-6 bg-paper-2 p-5 rounded-neo border-brutal mb-4">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-ink flex items-center gap-2"><Calculator size={16} /> Calculator</h3>
                        <div>
                            <label className="text-xs font-semibold text-taupe mb-1 block">Monthly Living Expenses (₹)</label>
                            <input type="number" value={efExpenses} onChange={(e) => setEfExpenses(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-taupe mb-1 block">Target Months (Typically 3 to 6)</label>
                            <input type="number" value={efMonths} onChange={(e) => setEfMonths(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                        </div>
                    </div>
                    <div className="bg-mustard/10 border-brutal-sm rounded-neo p-4 flex flex-col justify-center">
                        <p className="text-sm text-taupe mb-2">Required Emergency Fund:</p>
                        <p className="font-serif text-3xl font-black text-ink">{formatCurrency(efResult.target)}</p>
                        <p className="text-xs text-taupe mt-3">{efResult.explanation}</p>
                    </div>
                </div>

                <Link href="/app/goals" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Create an Emergency Fund Goal <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 2. Debt Payoff */}
            <Section title="Debt Payoff Strategies" icon={HandCoins}>
                <p className="text-sm text-taupe mb-4">Should you pay off your smallest debt first, or your highest interest debt first? Here are the two main methods:</p>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-paper-2 border-brutal-sm p-4 rounded-neo">
                        <h4 className="font-bold text-ink mb-2">Debt Snowball</h4>
                        <p className="text-xs text-taupe mb-2">Pay off debts from smallest balance to largest balance, regardless of interest rate.</p>
                        <ul className="text-xs list-disc pl-4 text-ink space-y-1">
                            <li>Provides quick psychological wins</li>
                            <li>Frees up cashflow faster</li>
                            <li>Mathematically costs slightly more</li>
                        </ul>
                    </div>
                    <div className="bg-paper-2 border-brutal-sm p-4 rounded-neo">
                        <h4 className="font-bold text-ink mb-2">Debt Avalanche</h4>
                        <p className="text-xs text-taupe mb-2">Pay off debts from highest interest rate to lowest interest rate.</p>
                        <ul className="text-xs list-disc pl-4 text-ink space-y-1">
                            <li>Mathematically saves the most money</li>
                            <li>Pays off debt faster overall</li>
                            <li>Can take longer to see the first debt disappear</li>
                        </ul>
                    </div>
                </div>

                <Link href="/app/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Log your Liabilities <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 3. Budgeting Basics */}
            <Section title="Budgeting Basics" icon={Calculator}>
                <p className="text-sm text-taupe mb-4">Budgeting isn&apos;t about restriction; it&apos;s about intentional spending. Try the <strong>50/30/20 Rule</strong> as a starting point:</p>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-4 border-brutal-sm rounded-neo p-3 bg-paper-2">
                        <div className="w-12 text-center font-black font-serif text-xl text-danger">50%</div>
                        <div>
                            <h4 className="font-bold text-ink text-sm">Needs</h4>
                            <p className="text-xs text-taupe">Rent, groceries, utilities, EMI, health insurance.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 border-brutal-sm rounded-neo p-3 bg-paper-2">
                        <div className="w-12 text-center font-black font-serif text-xl text-mustard">30%</div>
                        <div>
                            <h4 className="font-bold text-ink text-sm">Wants</h4>
                            <p className="text-xs text-taupe">Dining out, entertainment, shopping, vacations.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 border-brutal-sm rounded-neo p-3 bg-paper-2">
                        <div className="w-12 text-center font-black font-serif text-xl text-success">20%</div>
                        <div>
                            <h4 className="font-bold text-ink text-sm">Savings & Investing</h4>
                            <p className="text-xs text-taupe">Emergency fund, retirement, debt payoff, stocks.</p>
                        </div>
                    </div>
                </div>

                <Link href="/app/budgets" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Set up your Budgets <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 4. Goal Contribution */}
            <Section title="Goal Contribution Calculator" icon={PiggyBank}>
                <p className="text-sm text-taupe mb-4">Calculate how much you need to save monthly to hit a financial target.</p>

                <div className="grid md:grid-cols-2 gap-6 bg-paper-2 p-5 rounded-neo border-brutal mb-4">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-taupe mb-1 block">Target Amount (₹)</label>
                            <input type="number" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-semibold text-taupe mb-1 block">Already Saved (₹)</label>
                                <input type="number" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-taupe mb-1 block">Months left</label>
                                <input type="number" value={goalMonths} onChange={(e) => setGoalMonths(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-success/10 border-success/30 border-brutal-sm rounded-neo p-4 flex flex-col justify-center">
                        <p className="text-sm text-taupe mb-2">Monthly Contribution Needed:</p>
                        <p className="font-serif text-3xl font-black text-success">{formatCurrency(goalResult.monthly)}</p>
                        <p className="text-xs text-taupe mt-3">You need to save ₹{goalResult.shortfall.toLocaleString("en-IN")} over {goalMonths} months.</p>
                    </div>
                </div>

                <Link href="/app/goals" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Track your Goals <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 5. Subscription Leak */}
            <Section title="Subscription Leaks" icon={TrendingUp}>
                <p className="text-sm text-taupe mb-4">Small recurring payments add up surprisingly fast. Check the true cost of that subscription.</p>

                <div className="grid md:grid-cols-2 gap-6 bg-paper-2 p-5 rounded-neo border-brutal mb-4">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-taupe mb-1 block">Monthly Subscription Amount (₹)</label>
                            <input type="number" value={subAmount} onChange={(e) => setSubAmount(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                        </div>
                    </div>
                    <div className="bg-danger/10 border-danger/30 border-brutal-sm rounded-neo p-4 flex flex-col justify-center">
                        <p className="text-sm text-taupe mb-2">5-Year Impact:</p>
                        <p className="font-serif text-3xl font-black text-danger">{formatCurrency(subResult.fiveYear)}</p>
                        <p className="text-xs text-taupe mt-3">{subResult.explanation}</p>
                    </div>
                </div>

                <Link href="/app/obligations" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Review your Subscriptions <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 6. Retirement Corpus */}
            <Section title="Retirement Corpus Estimator" icon={TrendingUp}>
                <p className="text-sm text-taupe mb-4">A rough calculation of what you&apos;ll need to retire based on inflation and return assumptions.</p>

                <div className="grid md:grid-cols-2 gap-6 bg-paper-2 p-5 rounded-neo border-brutal">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-semibold text-taupe mb-1 block">Current Age</label>
                                <input type="number" value={retireCurrentAge} onChange={(e) => setRetireCurrentAge(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-taupe mb-1 block">Retirement Age</label>
                                <input type="number" value={retireRetireAge} onChange={(e) => setRetireRetireAge(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-taupe mb-1 block">Current Monthly Expenses (₹)</label>
                            <input type="number" value={retireExpenses} onChange={(e) => setRetireExpenses(e.target.value)} className="w-full rounded-neo border-brutal px-3 py-2 text-sm focus:ring-2 focus:ring-ink" />
                        </div>
                        <p className="text-xs text-taupe italic">{retireResult.assumptions}</p>
                    </div>
                    <div className="bg-cobalt/10 border-cobalt/30 border-brutal-sm rounded-neo p-4 flex flex-col justify-center">
                        <p className="text-sm text-taupe mb-2">Estimated Corpus Needed:</p>
                        <p className="font-serif text-3xl font-black text-cobalt">{formatCurrency(retireResult.corpusNeeded)}</p>
                        <div className="text-xs text-taupe mt-3 space-y-1">
                            <p>Years to invest: {retireResult.yearsToRetirement}</p>
                            <p>Years in retirement: {retireResult.yearsInRetirement}</p>
                            <p>Your ₹{Number(retireExpenses).toLocaleString("en-IN")}/mo lifestyle will cost ₹{Math.round(retireResult.inflatedMonthlyExpense).toLocaleString("en-IN")}/mo due to inflation when you retire.</p>
                        </div>
                    </div>
                </div>
            </Section>

            {/* 7. Receipt & Warranty Habits */}
            <Section title="Receipt & Warranty Habits" icon={Receipt}>
                <p className="text-sm text-taupe mb-4">Losing receipts costs you money in missed warranties, returns, and reimbursements.</p>
                <ul className="text-sm list-disc pl-4 text-ink space-y-2 mb-4">
                    <li><strong>Always snap a picture:</strong> Ink fades. A digital copy of a thermal receipt is better than the original.</li>
                    <li><strong>Log the return window:</strong> Stores usually offer 15 to 30 days. Log it as a reminder so you don&apos;t miss the deadline.</li>
                    <li><strong>Tag warranty items:</strong> Electronics and appliances should have their receipts tagged and warranty expiration logged.</li>
                </ul>

                <Link href="/app/receipts" className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline">
                    Scan a Receipt <ArrowRight size={14} />
                </Link>
            </Section>

            {/* 8. Tax Planning & Investing Basics */}
            <Section title="Investing & Tax Basics" icon={BookOpen}>
                <p className="text-sm text-taupe mb-4">Taxes and investments go hand in hand. Always maximize tax-advantaged accounts first.</p>

                <div className="space-y-4">
                    <div className="bg-paper-2 border-brutal-sm p-4 rounded-neo">
                        <h4 className="font-bold text-ink mb-1">Section 80C (India)</h4>
                        <p className="text-xs text-taupe">Invest up to ₹1.5 Lakhs per year in PPF, ELSS, EPF, or LIC to reduce your taxable income under the old tax regime.</p>
                    </div>
                    <div className="bg-paper-2 border-brutal-sm p-4 rounded-neo">
                        <h4 className="font-bold text-ink mb-1">Diversification</h4>
                        <p className="text-xs text-taupe">Don&apos;t put all eggs in one basket. Mix equities (stocks/mutual funds) for growth with fixed income (FDs/PPF) for stability.</p>
                    </div>
                    <div className="bg-paper-2 border-brutal-sm p-4 rounded-neo">
                        <h4 className="font-bold text-ink mb-1">Power of Compounding</h4>
                        <p className="text-xs text-taupe">Starting early is more important than starting big. A small amount invested monthly over 20 years will beat a large amount invested over 5 years.</p>
                    </div>
                </div>
            </Section>
        </div>
    );
}
