"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  IndianRupee,
  Package,
  ReceiptText,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { createClient } from "@/lib/supabase/browser"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { useExpiringReceipts, useGoals, useHealthScore, useTransactionSummary, useTransactions } from "@/lib/hooks"
import { cn, formatCurrency } from "@/lib/utils"

function SectionShell({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string
  eyebrow?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-taupe">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [userName, setUserName] = useState<string>("")

  const summary = useTransactionSummary()
  const transactions = useTransactions({ pageSize: 6 })
  const goals = useGoals()
  const health = useHealthScore()
  const expiringReceipts = useExpiringReceipts(21)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserName(user?.user_metadata?.name || "")
    }

    loadUser()
  }, [supabase.auth])

  const expenseCoverage = useMemo(() => {
    if (!summary.data || summary.data.totalExpenses <= 0) {
      return 0
    }

    return Math.round((summary.data.balance / summary.data.totalExpenses) * 100)
  }, [summary.data])

  const activeGoals = useMemo(
    () => (goals.data || []).filter((goal) => goal.status === "ACTIVE"),
    [goals.data],
  )

  const nearestGoal = useMemo(() => {
    return [...activeGoals]
      .filter((goal) => goal.deadline)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0]
  }, [activeGoals])

  const topExpense = useMemo(() => {
    return (transactions.data || [])
      .filter((transaction) => transaction.type === "EXPENSE")
      .sort((a, b) => b.amount - a.amount)[0]
  }, [transactions.data])

  const recentIncome = useMemo(() => {
    return (transactions.data || [])
      .filter((transaction) => transaction.type === "INCOME")
      .sort((a, b) => b.amount - a.amount)[0]
  }, [transactions.data])

  const cards = [
    {
      label: "Balance",
      value: summary.data ? formatCurrency(summary.data.balance) : "₹0",
      icon: IndianRupee,
      variant: "balance" as const,
      subtitle: expenseCoverage > 0 ? `${expenseCoverage}% of this month's spend covered` : "Waiting for transaction history",
    },
    {
      label: "Income",
      value: summary.data ? formatCurrency(summary.data.totalIncome) : "₹0",
      icon: TrendingUp,
      variant: "income" as const,
      subtitle: recentIncome ? `Latest: ${recentIncome.description || "Income"}` : "No income logged recently",
    },
    {
      label: "Expenses",
      value: summary.data ? formatCurrency(summary.data.totalExpenses) : "₹0",
      icon: TrendingDown,
      variant: "expense" as const,
      subtitle: topExpense ? `Largest spend: ${formatCurrency(topExpense.amount)}` : "No expense recorded yet",
    },
    {
      label: "Health",
      value: health.data ? `${health.data.score}/100` : "0/100",
      icon: HeartPulse,
      variant: "default" as const,
      subtitle: health.data ? health.data.insights[0]?.tip || "Score recalculates from live data" : "Loading health factors",
    },
  ]

  return (
    <div className="space-y-8 p-8">
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-neo-md border-brutal-thick bg-gradient-to-br from-mustard via-paper-1 to-paper-2 p-6 shadow-brutal"
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              <Sparkles size={14} />
              Daily money room
            </div>
            <div>
              <h1 className="font-serif text-4xl font-bold text-ink">
                {userName ? `Namaste, ${userName}` : "Your money cockpit"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-ink/70">
                Dashboard, receipts, and your monthly Ledger Zine now work as one loop:
                capture, review, and reflect.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/app/transactions"
                className="inline-flex items-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-3 text-sm font-semibold text-ink shadow-brutal-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                Open ledger
                <ArrowRight size={16} />
              </Link>
              <Link
                href={`/app/zine/${new Date().toISOString().slice(0, 7)}`}
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-paper-1"
              >
                Read this month's zine
                <CalendarDays size={16} />
              </Link>
              <Link
                href="/app/receipts"
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-paper-1"
              >
                Scan a receipt
                <ReceiptText size={16} />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Health score</p>
              {health.isLoading ? (
                <Skeleton className="mt-3 h-14 w-full" />
              ) : (
                <>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-serif text-4xl font-bold text-ink">{health.data?.score ?? 0}</span>
                    <span className="pb-1 text-sm text-taupe">/100</span>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">
                    {health.data?.factors[0]?.title || "Score updates from current habits."}
                  </p>
                </>
              )}
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Goals in motion</p>
              {goals.isLoading ? (
                <Skeleton className="mt-3 h-14 w-full" />
              ) : (
                <>
                  <div className="mt-2 font-serif text-3xl font-bold text-ink">{activeGoals.length}</div>
                  <p className="mt-2 text-sm text-ink/70">
                    {nearestGoal
                      ? `${nearestGoal.name} is your nearest milestone`
                      : "No active goal deadline yet"}
                  </p>
                </>
              )}
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Receipt clock</p>
              {expiringReceipts.isLoading ? (
                <Skeleton className="mt-3 h-14 w-full" />
              ) : (
                <>
                  <div className="mt-2 font-serif text-3xl font-bold text-ink">
                    {expiringReceipts.data?.length ?? 0}
                  </div>
                  <p className="mt-2 text-sm text-ink/70">
                    returns or warranties need attention in the next 21 days
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            {summary.isLoading || (card.label === "Health" && health.isLoading) ? (
              <Skeleton className="h-[128px] w-full" />
            ) : (
              <StatCard
                title={card.label}
                value={card.value}
                subtitle={card.subtitle}
                icon={card.icon}
                variant={card.variant}
              />
            )}
          </motion.div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionShell
          eyebrow="Live ledger"
          title="Recent money movement"
          action={
            <Link
              href="/app/transactions"
              className="inline-flex items-center gap-1 text-sm font-semibold text-cobalt hover:underline"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          }
        >
          {transactions.isLoading ? (
            <LoadingBlock lines={5} />
          ) : !transactions.data?.length ? (
            <div className="rounded-neo border-brutal bg-paper-1 p-6 text-center">
              <p className="font-serif text-xl font-bold text-ink">No transactions yet</p>
              <p className="mt-2 text-sm text-taupe">
                Start with one income or expense and the rest of the dashboard comes alive.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.data.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 rounded-neo border-brutal bg-paper-1 px-4 py-3"
                >
                  <div
                    className={cn(
                      "flex size-11 items-center justify-center rounded-neo border-brutal text-ink",
                      transaction.type === "INCOME" ? "bg-success/25" : "bg-paper-2",
                    )}
                  >
                    {transaction.type === "INCOME" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {transaction.description || "Untitled transaction"}
                    </p>
                    <p className="text-xs text-taupe">
                      {new Date(transaction.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "font-serif text-lg font-bold tabular-nums",
                      transaction.type === "INCOME" ? "text-success" : "text-ink",
                    )}
                  >
                    {transaction.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell eyebrow="Focus" title="What deserves attention now">
          <div className="space-y-3">
            <div className="rounded-neo border-brutal bg-mustard/30 p-4">
              <div className="mb-1 flex items-center gap-2 text-ink">
                <HeartPulse size={16} />
                <p className="font-semibold">Health pulse</p>
              </div>
              {health.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <p className="text-sm text-ink/75">
                  {health.data?.insights[0]?.tip || "Score needs more history to get sharper."}
                </p>
              )}
            </div>

            <div className="rounded-neo border-brutal bg-teal/20 p-4">
              <div className="mb-1 flex items-center gap-2 text-ink">
                <Target size={16} />
                <p className="font-semibold">Nearest goal</p>
              </div>
              <p className="text-sm text-ink/75">
                {nearestGoal
                  ? `${nearestGoal.name} is ${nearestGoal.progress}% funded.`
                  : "No dated goal yet. Add one to make the dashboard more actionable."}
              </p>
            </div>

            <div className="rounded-neo border-brutal bg-cobalt/10 p-4">
              <div className="mb-1 flex items-center gap-2 text-ink">
                <Package size={16} />
                <p className="font-semibold">Receipt watchlist</p>
              </div>
              <p className="text-sm text-ink/75">
                {(expiringReceipts.data?.length ?? 0) > 0
                  ? `${expiringReceipts.data?.[0]?.merchant || "A receipt"} needs a return or warranty check soon.`
                  : "No urgent return or warranty deadlines in the next three weeks."}
              </p>
            </div>
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionShell
          eyebrow="Progress"
          title="Goals and savings momentum"
          action={
            <Link
              href="/app/goals"
              className="inline-flex items-center gap-1 text-sm font-semibold text-cobalt hover:underline"
            >
              Manage goals
              <ChevronRight size={14} />
            </Link>
          }
        >
          {goals.isLoading ? (
            <LoadingBlock lines={4} />
          ) : !activeGoals.length ? (
            <div className="rounded-neo border-brutal bg-paper-1 p-6 text-center">
              <p className="font-serif text-xl font-bold text-ink">No active goals</p>
              <p className="mt-2 text-sm text-taupe">
                Add a goal to turn spare balance into an obvious next move.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeGoals.slice(0, 4).map((goal) => (
                <div key={goal.id} className="rounded-neo border-brutal bg-paper-1 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">
                      {goal.icon || "🎯"} {goal.name}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-taupe">
                      {goal.progress}%
                    </p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full border border-taupe/20 bg-paper-2">
                    <div
                      className="h-full rounded-full bg-cta transition-all"
                      style={{ width: `${Math.max(goal.progress, 4)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-taupe">
                    <span>{formatCurrency(goal.currentAmount)} saved</span>
                    <span>{formatCurrency(goal.targetAmount)} target</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          eyebrow="Signals"
          title="Health breakdown and receipt alerts"
          action={
            <Link
              href="/app/receipts"
              className="inline-flex items-center gap-1 text-sm font-semibold text-cobalt hover:underline"
            >
              Open vault
              <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {health.isLoading ? (
                <LoadingBlock lines={4} />
              ) : (
                (health.data?.components || []).slice(0, 5).map((component) => (
                  <div key={component.name} className="rounded-neo border-brutal bg-paper-1 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-ink">{component.name}</p>
                      <p className="font-serif text-xl font-bold text-ink">{component.score}</p>
                    </div>
                    <p className="text-sm text-taupe">{component.description}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              {expiringReceipts.isLoading ? (
                <LoadingBlock lines={3} />
              ) : expiringReceipts.data?.length ? (
                expiringReceipts.data.slice(0, 4).map((receipt) => {
                  const deadline = receipt.returnBy || receipt.warrantyUntil
                  const label = receipt.returnBy ? "Return by" : "Warranty until"

                  return (
                    <div key={receipt.id} className="rounded-neo border-brutal bg-paper-1 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink">{receipt.merchant}</p>
                        <span className="rounded-full border-brutal px-2 py-0.5 text-xs font-semibold">
                          {receipt.reimbursable ? "Reimbursable" : "Personal"}
                        </span>
                      </div>
                      <p className="font-serif text-xl font-bold text-ink">
                        {formatCurrency(Number(receipt.amountPaise) / 100)}
                      </p>
                      <p className="mt-1 text-sm text-taupe">
                        {label}:{" "}
                        {deadline
                          ? deadline.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Not set"}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-neo border-brutal bg-paper-1 p-6 text-center">
                  <p className="font-serif text-xl font-bold text-ink">Quiet receipt board</p>
                  <p className="mt-2 text-sm text-taupe">
                    Nothing is expiring soon. Scan new receipts to keep the vault useful.
                  </p>
                </div>
              )}
            </div>
          </div>
        </SectionShell>
      </div>
    </div>
  )
}
