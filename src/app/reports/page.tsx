import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/sidebar"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react"

export default async function ReportsPage() {
  const supabase = createServerClient(cookies())
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const userId = session.user.id

  const today = new Date()
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)

  const [lastMonthExpenses, thisMonthExpenses, allTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
      },
      include: { category: true },
    }),
  ])

  const lastMonthTotal = lastMonthExpenses.reduce((sum, t) => sum + t.amount, 0)
  const thisMonthTotal = thisMonthExpenses.reduce((sum, t) => sum + t.amount, 0)
  const change = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

  const spendingByCategory = allTransactions.reduce((acc: any, t) => {
    if (t.type === "EXPENSE") {
      const cat = t.category?.name || "Uncategorized"
      acc[cat] = (acc[cat] || 0) + t.amount
    }
    return acc
  }, {})

  const incomeByCategory = allTransactions.reduce((acc: any, t) => {
    if (t.type === "INCOME") {
      const cat = t.category?.name || "Uncategorized"
      acc[cat] = (acc[cat] || 0) + t.amount
    }
    return acc
  }, {})

  const totalExpenses = Object.values(spendingByCategory).reduce((sum: number, val) => sum + val, 0)
  const totalIncome = Object.values(incomeByCategory).reduce((sum: number, val) => sum + val, 0)

  const sortedExpenses = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      category: cat,
      amount: amount as number,
      percentage: totalExpenses > 0 ? (amount as number / totalExpenses) * 100 : 0,
    }))

  const sortedIncome = Object.entries(incomeByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      category: cat,
      amount: amount as number,
      percentage: totalIncome > 0 ? (amount as number / totalIncome) * 100 : 0,
    }))

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">Analyze your spending patterns and trends</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(thisMonthTotal)}</div>
                <p className="text-xs text-muted-foreground">Total expenses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Month</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(lastMonthTotal)}</div>
                <p className="text-xs text-muted-foreground">Total expenses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Change</CardTitle>
                {change > 0 ? (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${change > 0 ? "text-red-600" : "text-green-600"}`}>
                  {change > 0 ? "+" : ""}{change.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">vs last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalIncome > totalExpenses ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totalIncome - totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground">Income - Expenses</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedExpenses.map((item) => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}% of total</p>
                    </div>
                  ))}
                  {sortedExpenses.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No expense data</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedIncome.map((item) => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}% of total</p>
                    </div>
                  ))}
                  {sortedIncome.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No income data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
