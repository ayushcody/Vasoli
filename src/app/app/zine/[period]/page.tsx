"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  PiggyBank,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { insightsClient } from "@/lib/rpc/clients"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

interface ZineData {
  period: string
  totalSpent: number
  totalIncome: number
  transactionCount: number
  topCategories: { name: string; icon: string; total: number }[]
  biggestSpend: { merchant: string; amount: number; date: string } | null
  streak: number
  savedVsPrev: number
  leak: { category: string; increase: number } | null
}

const BAR_COLORS = ["#FD712C", "#2EC4B6", "#3D5AFE", "#F6DD4D", "#FF4D8D", "#8B5CF6"]

function ZineBlock({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string
  eyebrow?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-neo-md border-brutal-thick bg-paper-2 p-6 shadow-brutal ${className}`}>
      {eyebrow ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-taupe">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function ZinePage() {
  const params = useParams()
  const router = useRouter()
  const period = params.period as string
  const [data, setData] = useState<ZineData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    insightsClient
      .getZine({ monthYear: period })
      .then((response) => {
        if (!active) {
          return
        }

        setData({
          period: response.period,
          totalSpent: Number(response.totalSpentPaise) / 100,
          totalIncome: Number(response.totalIncomePaise) / 100,
          transactionCount: response.transactionCount,
          topCategories: response.topCategories.map((category) => ({
            name: category.name,
            icon: category.icon,
            total: Number(category.totalPaise) / 100,
          })),
          biggestSpend: response.biggestSpend
            ? {
                merchant: response.biggestSpend.merchant,
                amount: Number(response.biggestSpend.amountPaise) / 100,
                date:
                  response.biggestSpend.date?.toDate().toISOString() ||
                  new Date().toISOString(),
              }
            : null,
          streak: response.streak,
          savedVsPrev: Number(response.savedVsPrevPaise) / 100,
          leak: response.leak
            ? {
                category: response.leak.category,
                increase: Number(response.leak.increasePaise) / 100,
              }
            : null,
        })
        setLoading(false)
      })
      .catch((error) => {
        console.error("Failed to fetch zine:", error)
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [period])

  const monthLabel = useMemo(() => {
    return new Date(`${period}-01`).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    })
  }, [period])

  const savings = useMemo(() => {
    if (!data) {
      return 0
    }

    return data.totalIncome - data.totalSpent
  }, [data])

  const savingsRate = useMemo(() => {
    if (!data || data.totalIncome <= 0) {
      return 0
    }

    return Math.round((savings / data.totalIncome) * 100)
  }, [data, savings])

  const headline = useMemo(() => {
    if (!data) {
      return ""
    }

    if (savingsRate >= 30) {
      return "This month looked sharp, deliberate, and under control."
    }
    if (savingsRate >= 10) {
      return "You kept the month stable, with enough room to improve the next one."
    }
    if (savingsRate >= 0) {
      return "You stayed above water, but the month asked for tighter decisions."
    }
    return "Expenses ran ahead of income this month and need a reset next cycle."
  }, [data, savingsRate])

  const moodLabel = useMemo(() => {
    if (savingsRate >= 30) return { text: "Collector mode", color: "bg-success/20" }
    if (savingsRate >= 10) return { text: "Steady mode", color: "bg-mustard/30" }
    if (savingsRate >= 0) return { text: "Tight mode", color: "bg-cta/20" }
    return { text: "Leak mode", color: "bg-danger/15" }
  }, [savingsRate])

  const chartData = useMemo(() => {
    return (data?.topCategories || []).map((category, index) => ({
      ...category,
      fill: BAR_COLORS[index % BAR_COLORS.length],
    }))
  }, [data?.topCategories])

  function navigateMonth(delta: number) {
    const [year, month] = period.split("-").map(Number)
    const next = new Date(year, month - 1 + delta, 1)
    router.push(`/app/zine/${next.toISOString().slice(0, 7)}`)
  }

  function copyNarrative() {
    if (!data) {
      return
    }

    const lines = [
      `Ledger Zine · ${monthLabel}`,
      `Income: ${formatCurrency(data.totalIncome)}`,
      `Spend: ${formatCurrency(data.totalSpent)}`,
      `Net: ${formatCurrency(savings)}`,
      `Savings rate: ${savingsRate}%`,
      `Transactions: ${data.transactionCount}`,
      data.leak
        ? `Leak to watch: ${data.leak.category} (+${formatCurrency(data.leak.increase)})`
        : "Leak to watch: none flagged",
    ]

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("Zine summary copied"))
      .catch(() => toast.error("Could not copy summary"))
  }

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-56 w-full lg:col-span-2" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-center text-taupe">No zine data available for this month.</div>
  }

  return (
    <div className="space-y-8 p-8">
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-neo-md border-brutal-thick bg-gradient-to-br from-paper-2 via-paper-1 to-mustard/60 p-6 shadow-brutal"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              <Sparkles size={14} />
              Ledger Zine
            </div>
            <div>
              <h1 className="font-serif text-4xl font-bold text-ink">{monthLabel}</h1>
              <p className="mt-2 max-w-2xl text-sm text-ink/70">{headline}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-paper-1"
              >
                <ChevronLeft size={16} />
                Previous month
              </button>
              <button
                onClick={() => navigateMonth(1)}
                className="inline-flex items-center gap-2 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-paper-1"
              >
                Next month
                <ChevronRight size={16} />
              </button>
              <button
                onClick={copyNarrative}
                className="inline-flex items-center gap-2 rounded-neo border-brutal-thick bg-cta px-4 py-3 text-sm font-semibold text-ink shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                Copy summary
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className={`rounded-neo-md border-brutal px-4 py-4 ${moodLabel.color}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">
                Month mood
              </p>
              <p className="mt-2 font-serif text-2xl font-bold text-ink">{moodLabel.text}</p>
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">
                Savings rate
              </p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">{savingsRate}%</p>
            </div>
            <div className="rounded-neo-md border-brutal bg-paper-2 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">
                Entries logged
              </p>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">{data.transactionCount}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <ZineBlock eyebrow="Numbers" title="The month at a glance">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Income</p>
              <div className="mt-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-success" />
                <p className="font-serif text-3xl font-bold text-ink">{formatCurrency(data.totalIncome)}</p>
              </div>
            </div>
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Spend</p>
              <div className="mt-2 flex items-center gap-2">
                <TrendingDown size={18} className="text-cta" />
                <p className="font-serif text-3xl font-bold text-ink">{formatCurrency(data.totalSpent)}</p>
              </div>
            </div>
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Net</p>
              <div className="mt-2 flex items-center gap-2">
                <PiggyBank size={18} className="text-cobalt" />
                <p className="font-serif text-3xl font-bold text-ink">{formatCurrency(savings)}</p>
              </div>
            </div>
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Logging streak</p>
              <div className="mt-2 flex items-center gap-2">
                <Flame size={18} className="text-cta" />
                <p className="font-serif text-3xl font-bold text-ink">{data.streak} days</p>
              </div>
            </div>
          </div>
        </ZineBlock>

        <ZineBlock eyebrow="Editorial note" title="What changed from last month">
          <div className="space-y-3">
            <div className="rounded-neo border-brutal bg-paper-1 p-4">
              <p className="text-sm text-ink/75">
                {data.savedVsPrev >= 0
                  ? `You held onto ${formatCurrency(data.savedVsPrev)} more than last month.`
                  : `You spent ${formatCurrency(Math.abs(data.savedVsPrev))} more than last month.`}
              </p>
            </div>
            {data.leak ? (
              <div className="rounded-neo border-brutal bg-danger/10 p-4">
                <div className="mb-1 flex items-center gap-2 text-ink">
                  <TriangleAlert size={16} />
                  <p className="font-semibold">Leak to watch</p>
                </div>
                <p className="text-sm text-ink/75">
                  {data.leak.category} jumped by {formatCurrency(data.leak.increase)}. That is the cleanest place to tighten next month.
                </p>
              </div>
            ) : (
              <div className="rounded-neo border-brutal bg-success/10 p-4">
                <p className="text-sm text-ink/75">
                  No major category leak stood out this month. Consistency is doing the heavy lifting.
                </p>
              </div>
            )}
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cobalt hover:underline"
            >
              Back to dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
        </ZineBlock>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <ZineBlock eyebrow="Categories" title="Where your money went">
          {chartData.length ? (
            <>
              <div className="h-72 rounded-neo border-brutal bg-paper-1 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} stroke="#a2897d33" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <Bar dataKey="total" radius={0}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {chartData.map((category) => (
                  <div key={category.name} className="rounded-neo border-brutal bg-paper-1 p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg">{category.icon || "•"}</span>
                      <p className="font-semibold text-ink">{category.name}</p>
                    </div>
                    <p className="font-serif text-2xl font-bold text-ink">
                      {formatCurrency(category.total)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-taupe">You need a little more activity before the zine can chart spending patterns.</p>
          )}
        </ZineBlock>

        <ZineBlock eyebrow="Narrative" title="The sharpest signals">
          <div className="space-y-4">
            <div className="rounded-neo border-brutal bg-mustard/25 p-4">
              <div className="mb-1 flex items-center gap-2">
                <ReceiptText size={16} />
                <p className="font-semibold text-ink">Biggest spend</p>
              </div>
              {data.biggestSpend ? (
                <p className="text-sm text-ink/75">
                  {data.biggestSpend.merchant || "Unknown merchant"} took the biggest bite at{" "}
                  <span className="font-semibold text-ink">
                    {formatCurrency(data.biggestSpend.amount)}
                  </span>{" "}
                  on{" "}
                  {new Date(data.biggestSpend.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                  .
                </p>
              ) : (
                <p className="text-sm text-ink/75">No standout spend this month.</p>
              )}
            </div>

            <div className="rounded-neo border-brutal bg-teal/20 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={16} />
                <p className="font-semibold text-ink">Editor takeaway</p>
              </div>
              <p className="text-sm text-ink/75">
                {savingsRate >= 20
                  ? "Protect the system that worked. Push the surplus toward goals before lifestyle creep catches up."
                  : savingsRate >= 0
                    ? "You are close to a cleaner month. Cut the loudest category once and the whole shape improves."
                    : "Next month needs a first-principles reset: smaller fixed drag, fewer leaks, and faster review of daily spend."}
              </p>
            </div>

            <div className="rounded-neo border-brutal bg-cobalt/10 p-4">
              <div className="mb-1 flex items-center gap-2">
                <PiggyBank size={16} />
                <p className="font-semibold text-ink">Next move</p>
              </div>
              <p className="text-sm text-ink/75">
                Open the dashboard for live health and receipt alerts, then use the ledger to clean up categories while this month is still fresh.
              </p>
            </div>
          </div>
        </ZineBlock>
      </div>
    </div>
  )
}
