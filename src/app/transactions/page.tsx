import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase"
import { cookies } from "next/headers"
import { Sidebar } from "@/components/sidebar"
import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function TransactionsPage() {
  const supabase = createServerClient(cookies())
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const userId = session.user.id

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: "desc" },
  })

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground">Manage your income and expenses</p>
            </div>
            <Button>Add Transaction</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Add Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <form action="/api/transactions" method="POST" className="space-y-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" required />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <select
                      id="type"
                      name="type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="categoryId">Category</Label>
                    <select
                      id="categoryId"
                      name="categoryId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="w-full">Add Transaction</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Scan Receipt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Upload a receipt image to automatically extract transaction details
                  </p>
                  <input type="file" accept="image/*" className="hidden" id="receipt-upload" />
                  <Button onClick={() => document.getElementById('receipt-upload')?.click()}>
                    Upload Receipt
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div className="space-y-1">
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.category?.name || "Uncategorized"} • {formatDate(transaction.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-semibold ${transaction.type === "INCOME" ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions yet. Add your first transaction above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
