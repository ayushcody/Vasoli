import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/sidebar"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function BudgetsPage() {
  const supabase = createServerClient(cookies())
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const userId = session.user.id

  const budgets = await prisma.budget.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })

  const thisMonth = new Date()
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
  const monthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "EXPENSE",
      date: { gte: monthStart, lte: monthEnd },
    },
    include: { category: true },
  })

  const spendingByCategory = transactions.reduce((acc: any, t) => {
    const cat = t.category?.name || "Uncategorized"
    acc[cat] = (acc[cat] || 0) + t.amount
    return acc
  }, {})

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Budgets</h1>
              <p className="text-muted-foreground">Set and track your spending limits</p>
            </div>
            <Button>Create Budget</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Create New Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <form action="/api/budgets" method="POST" className="space-y-4">
                  <div>
                    <Label htmlFor="name">Budget Name</Label>
                    <Input id="name" name="name" placeholder="Monthly Budget" required />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="period">Period</Label>
                    <select
                      id="period"
                      name="period"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      required
                      defaultValue={new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="categories">Categories (comma separated)</Label>
                    <Input
                      id="categories"
                      name="categories"
                      placeholder="Food & Dining, Transportation"
                    />
                  </div>
                  <Button type="submit" className="w-full">Create Budget</Button>
                </form>
              </CardContent>
            </Card>

            {budgets.map((budget) => {
              const budgetCategories = budget.categories.split(',').map((c: string) => c.trim())
              const spent = budgetCategories.reduce((sum: number, cat: string) => {
                return sum + (spendingByCategory[cat] || 0)
              }, 0)
              const percentage = (spent / budget.amount) * 100
              const isOverBudget = percentage > 100

              return (
                <Card key={budget.id} className={isOverBudget ? "border-red-500" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{budget.name}</span>
                      <span className={`text-sm ${isOverBudget ? "text-red-600" : "text-muted-foreground"}`}>
                        {budget.period}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Spent</span>
                        <span className="font-semibold">{formatCurrency(spent)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${isOverBudget ? "bg-red-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Budget</span>
                        <span className="font-semibold">{formatCurrency(budget.amount)}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <span className="text-sm">
                          {isOverBudget ? (
                            <span className="text-red-600">Over budget by {formatCurrency(spent - budget.amount)}</span>
                          ) : (
                            <span className="text-green-600">{formatCurrency(budget.amount - spent)} remaining</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {budgets.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  No budgets yet. Create your first budget to start tracking your spending.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
