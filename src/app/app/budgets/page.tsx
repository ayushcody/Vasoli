"use client";

import { useMemo, useState } from "react";
import { Plus, Wallet, X } from "lucide-react";

import { InlineErrorState, ScreenEmptyState } from "@/components/app/screen-states";
import { NeoBadge } from "@/components/ui/neo-badge";
import { NeoButton } from "@/components/ui/neo-button";
import { NeoInput } from "@/components/ui/neo-input";
import { NeoProgress } from "@/components/ui/neo-progress";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useBudgets, useCategories, useCreateBudget } from "@/lib/hooks";
import { formatCurrency } from "@/lib/utils";

type BudgetPeriod = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

const PERIOD_OPTIONS: BudgetPeriod[] = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

function progressVariant(percentage: number): "success" | "warning" | "danger" {
  if (percentage < 70) {
    return "success";
  }
  if (percentage <= 90) {
    return "warning";
  }
  return "danger";
}

function statusLabel(percentage: number) {
  if (percentage < 70) {
    return "On Track";
  }
  if (percentage <= 90) {
    return "Watch";
  }
  return "Over";
}

export default function BudgetsPage() {
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const createBudget = useCreateBudget();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "MONTHLY" as BudgetPeriod,
    startDate: "",
    endDate: "",
  });

  const budgets = useMemo(() => budgetsQuery.data || [], [budgetsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);

  async function handleCreate() {
    await createBudget.mutateAsync({
      name: form.name,
      amount: Number(form.amount),
      period: form.period,
      startDate: form.startDate,
      endDate: form.endDate,
      categories: selectedCategories,
    });
    setForm({
      name: "",
      amount: "",
      period: "MONTHLY",
      startDate: "",
      endDate: "",
    });
    setSelectedCategories([]);
    setShowCreate(false);
  }

  const hasError = budgetsQuery.isError || categoriesQuery.isError;

  return (
    <div className="space-y-6">
      <section className="rounded-neo-md border-brutal-thick bg-mustard p-6 shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink/70">Budgets</p>
            <h1 className="mt-2 font-serif text-4xl font-bold text-ink">Live budget guardrails</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink/75">
              Track category budgets against real ledger spend, not placeholders.
            </p>
          </div>
          <NeoButton size="md" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Budget
          </NeoButton>
        </div>
      </section>

      {hasError ? (
        <InlineErrorState
          title="Budgets are unavailable"
          description="The budgets or categories request failed."
          onRetry={() => {
            budgetsQuery.refetch();
            categoriesQuery.refetch();
          }}
        />
      ) : null}

      {!hasError && budgetsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Panel key={index} className="shadow-brutal">
              <PanelHeader>
                <PanelTitle>Loading budget...</PanelTitle>
              </PanelHeader>
            </Panel>
          ))}
        </div>
      ) : null}

      {!hasError && !budgetsQuery.isLoading && budgets.length === 0 ? (
        <ScreenEmptyState
          icon={Wallet}
          title="No budgets yet"
          description="Create a budget to compare real spending against a weekly, monthly, quarterly, or yearly cap."
          cta={{ label: "Add Budget", onClick: () => setShowCreate(true) }}
        />
      ) : null}

      {!hasError && budgets.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Panel key={budget.id} className="shadow-brutal">
              <PanelHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <PanelTitle className="text-xl">{budget.name}</PanelTitle>
                  <p className="mt-2 text-sm text-taupe">
                    {new Date(budget.startDate).toLocaleDateString("en-IN")} to{" "}
                    {new Date(budget.endDate).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <NeoBadge variant="mustard">{budget.period}</NeoBadge>
              </PanelHeader>
              <PanelContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-taupe">Limit</p>
                    <p className="mt-1 font-serif text-3xl font-bold text-ink">{formatCurrency(budget.amount)}</p>
                  </div>
                  <NeoBadge variant={progressVariant(budget.percentage)}>{statusLabel(budget.percentage)}</NeoBadge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-taupe">Spent</span>
                    <span className="font-semibold text-ink">{formatCurrency(budget.spent)}</span>
                  </div>
                  <NeoProgress
                    value={budget.spent}
                    max={budget.amount || 1}
                    variant={progressVariant(budget.percentage)}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-taupe">Remaining</span>
                    <span className="font-semibold text-ink">{formatCurrency(budget.remaining)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {budget.categories.length > 0 ? (
                    budget.categories.map((categoryId) => {
                      const category = categories.find((item) => item.id === categoryId);
                      return (
                        <NeoBadge key={categoryId} variant="default">
                          {category?.name || "Uncategorised"}
                        </NeoBadge>
                      );
                    })
                  ) : (
                    <NeoBadge variant="default">All categories</NeoBadge>
                  )}
                </div>
              </PanelContent>
            </Panel>
          ))}
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper-1/80 p-4">
          <Panel className="w-full max-w-2xl rounded-neo-lg border-brutal-thick bg-paper-1 shadow-brutal">
            <PanelHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <PanelTitle>Add Budget</PanelTitle>
                <p className="mt-2 text-sm text-taupe">Create a live budget backed by real transaction spend.</p>
              </div>
              <NeoButton variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                <X className="size-4" />
              </NeoButton>
            </PanelHeader>
            <PanelContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Name</label>
                <NeoInput
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Household essentials"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">Amount</label>
                  <NeoInput
                    type="number"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="25000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">Period</label>
                  <select
                    value={form.period}
                    onChange={(event) => setForm((current) => ({ ...current, period: event.target.value as BudgetPeriod }))}
                    className="flex h-11 w-full rounded-neo border-brutal bg-paper-2 px-4 py-2 text-base"
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">Start date</label>
                  <NeoInput
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">End date</label>
                  <NeoInput
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Categories</label>
                <div className="grid gap-2 md:grid-cols-2">
                  {categories.map((category) => {
                    const checked = selectedCategories.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className="flex items-center gap-3 rounded-neo border-brutal bg-paper-2 px-4 py-3 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setSelectedCategories((current) =>
                              event.target.checked
                                ? [...current, category.id]
                                : current.filter((value) => value !== category.id),
                            )
                          }
                        />
                        <span>{category.name}</span>
                      </label>
                    );
                  })}
                </div>
                {categories.length === 0 && !categoriesQuery.isLoading ? (
                  <p className="text-sm text-taupe">No categories available. The budget will apply across all categories.</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-3">
                <NeoButton variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </NeoButton>
                <NeoButton
                  onClick={handleCreate}
                  disabled={
                    createBudget.isPending ||
                    !form.name ||
                    !form.amount ||
                    !form.startDate ||
                    !form.endDate
                  }
                >
                  {createBudget.isPending ? "Creating..." : "Create Budget"}
                </NeoButton>
              </div>
            </PanelContent>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
