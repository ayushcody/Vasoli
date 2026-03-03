'use client';

import { Sidebar } from "@/components/sidebar";
import { useTransactions, useTransactionSummary } from "@/lib/hooks/use-transactions";
import { useGoals } from "@/lib/hooks/use-goals";
import { useHealthScore } from "@/lib/hooks/use-health-score";
import { useUpcomingRecurring } from "@/lib/hooks/use-recurring";
import { useReminders } from "@/lib/hooks/use-reminders";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FadeInUp, 
  StaggerContainer, 
  StaggerItem,
  AnimatedProgress,
  CircularProgress 
} from "@/components/motion/motion-wrapper";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Wallet, 
  CreditCard,
  Target,
  Bell,
  Repeat,
  Sparkles,
  PiggyBank,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { StorytellingEmptyState } from "@/components/motion/empty-state";

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useTransactionSummary();
  const { data: goals, isLoading: goalsLoading } = useGoals({ status: 'ACTIVE' });
  const { data: healthScore, isLoading: healthLoading } = useHealthScore();
  const { data: upcomingRecurring } = useUpcomingRecurring();
  const { data: reminders } = useReminders({ upcoming: true });

  const isLoading = summaryLoading || goalsLoading || healthLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="animate-pulse space-y-8">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="grid gap-6 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const totalIncome = summary?.totalIncome || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

  const hasData = totalIncome > 0 || totalExpenses > 0 || (goals && goals.length > 0);

  if (!hasData) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <StorytellingEmptyState
            icon={Sparkles}
            title="Welcome to Vasoli!"
            description="Let's get started on your financial journey. Here's what you can do:"
            steps={[
              {
                icon: Wallet,
                title: "Add Your First Transaction",
                description: "Record your income and expenses to start tracking your finances.",
              },
              {
                icon: Target,
                title: "Set a Savings Goal",
                description: "Create a goal to work towards, like an emergency fund or vacation.",
              },
              {
                icon: PiggyBank,
                title: "Create a Budget",
                description: "Set spending limits to stay on track with your financial plan.",
              },
            ]}
            action={{
              label: "Add Your First Transaction",
              onClick: () => window.location.href = '/transactions',
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <FadeInUp>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">
                  Welcome back! Here's your financial overview.
                </p>
              </div>
              {healthScore && (
                <Link href="/health">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 cursor-pointer"
                  >
                    <CircularProgress 
                      value={healthScore.score} 
                      size={60} 
                      strokeWidth={6}
                      showValue={false}
                    />
                    <div>
                      <p className="text-sm text-muted-foreground">Health Score</p>
                      <p className="text-xl font-bold">{healthScore.score}/100</p>
                    </div>
                  </motion.div>
                </Link>
              )}
            </div>
          </FadeInUp>

          {/* Stats Cards */}
          <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <StaggerItem>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className="text-2xl font-bold"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {formatCurrency(totalIncome)}
                  </motion.div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className="text-2xl font-bold"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {formatCurrency(totalExpenses)}
                  </motion.div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {formatCurrency(balance)}
                  </motion.div>
                  <p className="text-xs text-muted-foreground">
                    {savingsRate >= 0 ? '+' : ''}{savingsRate.toFixed(1)}% savings rate
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>

            <StaggerItem>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className="text-2xl font-bold"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {(summary?.byMonth?.[0]?.income || 0) + (summary?.byMonth?.[0]?.expenses || 0) > 0 ? '+' : ''}
                    {summary?.byMonth?.length || 0}
                  </motion.div>
                  <p className="text-xs text-muted-foreground">Active categories</p>
                </CardContent>
              </Card>
            </StaggerItem>
          </StaggerContainer>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Goals Progress */}
            <FadeInUp delay={0.2} className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Your Goals</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Track your progress towards financial milestones
                    </p>
                  </div>
                  <Link href="/goals">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {goals && goals.length > 0 ? (
                    <div className="space-y-6">
                      {goals.slice(0, 3).map((goal, index) => (
                        <motion.div
                          key={goal.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.1 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="font-medium">{goal.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                            </span>
                          </div>
                          <AnimatedProgress 
                            value={goal.progress} 
                            max={100}
                            variant={goal.progress >= 100 ? 'success' : 'default'}
                            showLabel
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No active goals yet</p>
                      <Link href="/goals">
                        <Button variant="outline" className="mt-4">
                          Create Your First Goal
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeInUp>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Upcoming Recurring */}
              <FadeInUp delay={0.3}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Repeat className="h-4 w-4" />
                      Upcoming Recurring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingRecurring && upcomingRecurring.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingRecurring.slice(0, 3).map((item) => (
                          <div 
                            key={item.recurring.id} 
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <div>
                              <p className="text-sm font-medium">{item.recurring.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}
                              </p>
                            </div>
                            <span className={`text-sm font-semibold ${
                              item.recurring.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.recurring.type === 'INCOME' ? '+' : '-'}
                              {formatCurrency(item.recurring.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No upcoming recurring transactions
                      </p>
                    )}
                  </CardContent>
                </Card>
              </FadeInUp>

              {/* Upcoming Reminders */}
              <FadeInUp delay={0.4}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bell className="h-4 w-4" />
                      Reminders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reminders && reminders.length > 0 ? (
                      <div className="space-y-3">
                        {reminders.slice(0, 3).map((reminder) => (
                          <div 
                            key={reminder.id} 
                            className="flex items-center gap-3 py-2 border-b last:border-0"
                          >
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{reminder.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {(reminder as any).daysUntil === 0 ? 'Today' : `${(reminder as any).daysUntil} days`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No upcoming reminders
                      </p>
                    )}
                  </CardContent>
                </Card>
              </FadeInUp>

              {/* Health Score Tips */}
              {healthScore?.insights && healthScore.insights.length > 0 && (
                <FadeInUp delay={0.5}>
                  <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Personalized Tip
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        {healthScore.insights[0].tip}
                      </p>
                    </CardContent>
                  </Card>
                </FadeInUp>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
