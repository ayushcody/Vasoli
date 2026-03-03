'use client';

import { Sidebar } from "@/components/sidebar";
import { useTransactionSummary } from "@/lib/hooks/use-transactions";
import { useGoals } from "@/lib/hooks/use-goals";
import { useHealthScore } from "@/lib/hooks/use-health-score";
import { useUpcomingRecurring } from "@/lib/hooks/use-recurring";
import { useReminders } from "@/lib/hooks/use-reminders";
import { formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader, PanelTitle, PanelContent } from "@/components/ui/panel";
import { NeoButton } from "@/components/ui/neo-button";
import { NeoProgress } from "@/components/ui/neo-progress";
import { NeoBadge } from "@/components/ui/neo-badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Target,
  Bell,
  Repeat,
  Sparkles,
  ArrowRight,
  Plus
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useTransactionSummary();
  const { data: goals, isLoading: goalsLoading } = useGoals({ status: 'ACTIVE' });
  const { data: healthScore } = useHealthScore();
  const { data: upcomingRecurring } = useUpcomingRecurring();
  const { data: reminders } = useReminders({ upcoming: true });

  const isLoading = summaryLoading || goalsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-paper-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="h-20 bg-mustard border-b-brutal flex items-center px-8">
            <div className="h-8 w-48 bg-ink/10 rounded-neo animate-pulse" />
          </div>
          <div className="p-8 space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-paper-2 border-brutal rounded-neo-md animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const totalIncome = summary?.totalIncome || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

  return (
    <div className="flex h-screen bg-paper-1">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header Band */}
        <div className="h-20 bg-mustard border-b-brutal-thick flex items-center justify-between px-8">
          <div>
            <h1 className="text-3xl font-serif font-bold">Dashboard</h1>
            <p className="text-sm text-ink/70">Your financial overview</p>
          </div>
          {healthScore && (
            <div className="flex items-center gap-3 bg-paper-1 border-brutal rounded-neo-md px-4 py-2">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-taupe">Health Score</p>
                <p className="text-2xl font-bold font-serif tabular-nums">{healthScore.score}/100</p>
              </div>
              <div className="w-12 h-12 rounded-neo border-brutal bg-paper-2 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        <div className="p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Income"
              value={formatCurrency(totalIncome)}
              subtitle="This month"
              icon={ArrowUpRight}
              variant="income"
            />
            <StatCard
              title="Total Expenses"
              value={formatCurrency(totalExpenses)}
              subtitle="This month"
              icon={ArrowDownRight}
              variant="expense"
            />
            <StatCard
              title="Net Balance"
              value={formatCurrency(balance)}
              subtitle={`${savingsRate.toFixed(1)}% savings rate`}
              icon={Wallet}
              variant="balance"
            />
            <StatCard
              title="Transactions"
              value={summary?.byMonth?.length || 0}
              subtitle="Active categories"
              icon={CreditCard}
            />
          </div>

          {/* Monthly Overview Panel */}
          <div className="mb-8">
            <Panel>
              <PanelHeader>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <PanelTitle>Monthly Overview</PanelTitle>
                    <p className="text-sm text-taupe mt-1">Income vs Expenses this month</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <NeoBadge variant={savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'warning' : 'danger'}>
                      {savingsRate.toFixed(0)}% saved
                    </NeoBadge>
                  </div>
                </div>
              </PanelHeader>
              <PanelContent>
                <div className="space-y-6">
                  {/* Income & Expense Bars */}
                  <div className="space-y-4">
                    {/* Income Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-teal border-brutal" />
                          <span className="text-sm font-medium">Income (Salary / Pocket Money)</span>
                        </div>
                        <span className="text-sm font-bold font-serif tabular-nums">{formatCurrency(totalIncome)}</span>
                      </div>
                      <div className="w-full bg-paper-1 border-brutal rounded-neo h-6 overflow-hidden">
                        <div
                          className="h-full bg-teal rounded-l-neo transition-all duration-700"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Expenses Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-danger border-brutal" />
                          <span className="text-sm font-medium">Expenses</span>
                        </div>
                        <span className="text-sm font-bold font-serif tabular-nums">{formatCurrency(totalExpenses)}</span>
                      </div>
                      <div className="w-full bg-paper-1 border-brutal rounded-neo h-6 overflow-hidden">
                        <div
                          className="h-full bg-danger/80 rounded-l-neo transition-all duration-700"
                          style={{ width: totalIncome > 0 ? `${Math.min((totalExpenses / totalIncome) * 100, 100)}%` : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Savings Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm bg-mustard border-brutal" />
                          <span className="text-sm font-medium">Savings</span>
                        </div>
                        <span className="text-sm font-bold font-serif tabular-nums">{formatCurrency(Math.max(balance, 0))}</span>
                      </div>
                      <div className="w-full bg-paper-1 border-brutal rounded-neo h-6 overflow-hidden">
                        <div
                          className="h-full bg-mustard rounded-l-neo transition-all duration-700"
                          style={{ width: totalIncome > 0 ? `${Math.max(savingsRate, 0)}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
                    <div className="pt-4 border-t border-ink/10">
                      <p className="text-xs uppercase tracking-wide text-taupe mb-4">Top Expense Categories</p>
                      <div className="space-y-3">
                        {Object.entries(summary.byCategory)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 5)
                          .map(([category, amount]) => {
                            const categoryColors = ['bg-cta', 'bg-mustard', 'bg-teal', 'bg-grape', 'bg-cobalt'];
                            const colorIndex = Object.keys(summary.byCategory).indexOf(category) % categoryColors.length;
                            const percentage = totalIncome > 0 ? ((amount as number) / totalIncome) * 100 : 0;
                            return (
                              <div key={category} className="flex items-center gap-3">
                                <span className="text-xs w-24 truncate text-taupe">{category}</span>
                                <div className="flex-1 bg-paper-1 border-brutal rounded-neo h-4 overflow-hidden">
                                  <div
                                    className={`h-full ${categoryColors[colorIndex]} rounded-l-neo transition-all duration-700`}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold tabular-nums w-20 text-right">{formatCurrency(amount as number)}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </PanelContent>
            </Panel>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Goals - 2 cols */}
            <div className="col-span-2">
              <Panel>
                <PanelHeader>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <PanelTitle>Your Goals</PanelTitle>
                      <p className="text-sm text-taupe mt-1">Track your financial milestones</p>
                    </div>
                    <Link href="/goals">
                      <NeoButton variant="ghost" size="sm">
                        View All <ArrowRight className="h-4 w-4 ml-1" />
                      </NeoButton>
                    </Link>
                  </div>
                </PanelHeader>
                <PanelContent>
                  {goals && goals.length > 0 ? (
                    <div className="space-y-6">
                      {goals.slice(0, 3).map((goal) => (
                        <div key={goal.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-neo border-brutal bg-paper-1 flex items-center justify-center">
                                <Target className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{goal.name}</span>
                            </div>
                            <span className="text-sm tabular-nums text-taupe">
                              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                            </span>
                          </div>
                          <NeoProgress
                            value={goal.currentAmount}
                            max={goal.targetAmount}
                            variant={goal.progress >= 100 ? 'success' : 'default'}
                            showLabel
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-neo-md border-brutal bg-paper-1 flex items-center justify-center mx-auto mb-4">
                        <Target className="h-8 w-8 text-taupe" />
                      </div>
                      <p className="text-taupe mb-4">No active goals yet</p>
                      <Link href="/goals">
                        <NeoButton variant="secondary" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Goal
                        </NeoButton>
                      </Link>
                    </div>
                  )}
                </PanelContent>
              </Panel>
            </div>

            {/* Right Rail - 1 col */}
            <div className="space-y-6">
              {/* Upcoming Recurring */}
              <Panel>
                <PanelHeader>
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    <PanelTitle className="text-lg">Upcoming</PanelTitle>
                  </div>
                </PanelHeader>
                <PanelContent>
                  {upcomingRecurring && upcomingRecurring.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingRecurring.slice(0, 3).map((item) => (
                        <div
                          key={item.recurring.id}
                          className="flex items-center justify-between py-3 border-b border-ink/10 last:border-0"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.recurring.description}</p>
                            <p className="text-xs text-taupe">
                              {item.daysUntil === 0 ? 'Today' : `${item.daysUntil} days`}
                            </p>
                          </div>
                          <NeoBadge variant={item.recurring.type === 'INCOME' ? 'success' : 'danger'}>
                            {item.recurring.type === 'INCOME' ? '+' : '-'}
                            {formatCurrency(item.recurring.amount)}
                          </NeoBadge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-taupe text-center py-4">No upcoming transactions</p>
                  )}
                </PanelContent>
              </Panel>

              {/* Reminders */}
              <Panel>
                <PanelHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <PanelTitle className="text-lg">Reminders</PanelTitle>
                  </div>
                </PanelHeader>
                <PanelContent>
                  {reminders && reminders.length > 0 ? (
                    <div className="space-y-3">
                      {reminders.slice(0, 3).map((reminder) => (
                        <div
                          key={reminder.id}
                          className="flex items-start gap-3 py-2"
                        >
                          <div className="w-2 h-2 rounded-full bg-warning mt-1.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{reminder.title}</p>
                            <p className="text-xs text-taupe">
                              {(reminder as any).daysUntil === 0 ? 'Today' : `${(reminder as any).daysUntil} days`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-taupe text-center py-4">No reminders</p>
                  )}
                </PanelContent>
              </Panel>

              {/* Tip */}
              {healthScore?.insights && healthScore.insights.length > 0 && (
                <Panel variant="mustard">
                  <PanelHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <PanelTitle className="text-lg">Tip</PanelTitle>
                    </div>
                  </PanelHeader>
                  <PanelContent>
                    <p className="text-sm leading-relaxed">
                      {healthScore.insights[0].tip}
                    </p>
                  </PanelContent>
                </Panel>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
