import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { PilotService } from "@/gen/vasoli/v1/pilot_connect";
import { AccountService } from "@/gen/vasoli/v1/account_connect";
import { CategoryService } from "@/gen/vasoli/v1/category_connect";
import { GoalService } from "@/gen/vasoli/v1/goal_connect";
import { ReceiptService } from "@/gen/vasoli/v1/receipt_connect";
import { RecurringService } from "@/gen/vasoli/v1/recurring_connect";
import { TransactionService } from "@/gen/vasoli/v1/transaction_connect";
import { UserService } from "@/gen/vasoli/v1/user_connect";
import { InsightsService } from "@/gen/vasoli/v1/insights_connect";
import { ReminderService } from "@/gen/vasoli/v1/reminder_connect";
import { Timestamp } from "@bufbuild/protobuf";

type MarcoToolContext = {
  accessToken: string;
  rpcBaseUrl: string;
};

function createMarcoRpcClients(context: MarcoToolContext) {
  const transport = createConnectTransport({
    baseUrl: context.rpcBaseUrl,
    interceptors: [
      (next) => async (req) => {
        req.header.set("Authorization", `Bearer ${context.accessToken}`);
        return next(req);
      },
    ],
  });

  return {
    pilotClient: createPromiseClient(PilotService, transport),
    accountClient: createPromiseClient(AccountService, transport),
    categoryClient: createPromiseClient(CategoryService, transport),
    goalClient: createPromiseClient(GoalService, transport),
    receiptClient: createPromiseClient(ReceiptService, transport),
    recurringClient: createPromiseClient(RecurringService, transport),
    transactionClient: createPromiseClient(TransactionService, transport),
    userClient: createPromiseClient(UserService, transport),
    insightsClient: createPromiseClient(InsightsService, transport),
    reminderClient: createPromiseClient(ReminderService, transport),
  };
}

async function categoryNameMap(context: MarcoToolContext) {
  const { categoryClient } = createMarcoRpcClients(context);
  const response = await categoryClient.listCategories({});

  return new Map(
    response.categories.map((category) => [
      category.id,
      {
        name: category.name,
        icon: category.icon,
      },
    ]),
  );
}

export async function getDashboardSnapshot(
  context: MarcoToolContext,
  args: { days?: number },
) {
  const days = args.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { transactionClient, recurringClient, goalClient, userClient } = createMarcoRpcClients(context);
  const [transactionsResponse, recurringResponse, goalsResponse, analyticsResponse, categories] = await Promise.all([
    transactionClient.listTransactions({
      pageSize: 200,
      startDate: Timestamp.fromDate(since),
    }),
    recurringClient.listUpcoming({ daysAhead: 14 }),
    goalClient.listGoals({}),
    userClient.getWealthAnalytics({}),
    categoryNameMap(context),
  ]);

  const transactions = transactionsResponse.transactions.map((transaction) => ({
    amount: Number(transaction.amountPaise) / 100,
    type: transaction.type,
    description: transaction.description,
    categoryId: transaction.categoryId,
    status: transaction.status,
    provenance: transaction.provenance,
  }));

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "INCOME")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const byCategory: Record<string, { spent: number; count: number; icon: string | null }> = {};
  for (const transaction of transactions.filter((item) => item.type === "EXPENSE")) {
    const category = transaction.categoryId ? categories.get(transaction.categoryId) : null;
    const name = category?.name || "Uncategorised";
    if (!byCategory[name]) {
      byCategory[name] = { spent: 0, count: 0, icon: category?.icon || null };
    }
    byCategory[name].spent += transaction.amount;
    byCategory[name].count++;
  }

  return {
    period: `Last ${days} days`,
    totalIncome,
    totalExpense,
    monthlyNetFlow: analyticsResponse.saved,
    spendingEstimateAvailableFrom: "get_cashflow_radar",
    coverage: "This snapshot is limited to at most 200 recent transactions; do not treat it as a complete ledger.",
    transactionCount: transactions.length,
    pendingCount: transactions.filter((transaction) => transaction.status === "PENDING").length,
    byCategory: Object.entries(byCategory)
      .sort((left, right) => right[1].spent - left[1].spent)
      .map(([name, data]) => ({ name, ...data })),
    upcomingBills: recurringResponse.rules.map((rule) => ({
      merchant: rule.merchantNorm,
      amount: Number(rule.amountPaise) / 100,
      nextDue: rule.nextDueDate?.toDate().toISOString().slice(0, 10) || null,
      cadence: rule.cadence,
      type: rule.type,
    })),
    goals: goalsResponse.goals.map((goal) => ({
      name: goal.name,
      target: Number(goal.targetAmountPaise) / 100,
      current: Number(goal.currentAmountPaise) / 100,
      progress:
        Number(goal.targetAmountPaise) > 0
          ? Math.round((Number(goal.currentAmountPaise) / Number(goal.targetAmountPaise)) * 100)
          : 0,
    })),
  };
}

export async function searchTransactions(
  context: MarcoToolContext,
  args: {
    query?: string;
    startDate?: string;
    endDate?: string;
    categories?: string[];
    minAmount?: number;
    maxAmount?: number;
    type?: string;
    limit?: number;
  },
) {
  const limit = Math.min(args.limit || 20, 50);
  const { transactionClient } = createMarcoRpcClients(context);
  const categories = await categoryNameMap(context);

  const response = await transactionClient.listTransactions({
    pageSize: 200,
    type: args.type || undefined,
    startDate: args.startDate ? Timestamp.fromDate(new Date(args.startDate)) : undefined,
    endDate: args.endDate ? Timestamp.fromDate(new Date(args.endDate)) : undefined,
  });

  const query = args.query?.toLowerCase().trim();
  const categoryFilter = new Set((args.categories || []).map((category) => category.toLowerCase()));

  const transactions = response.transactions
    .filter((transaction) => {
      const amount = Number(transaction.amountPaise) / 100;
      const categoryName = transaction.categoryId ? categories.get(transaction.categoryId)?.name || "Uncategorised" : "Uncategorised";

      if (query) {
        const haystack = [transaction.description, transaction.merchantRaw, transaction.merchantNorm, categoryName]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (args.minAmount !== undefined && amount < args.minAmount) {
        return false;
      }
      if (args.maxAmount !== undefined && amount > args.maxAmount) {
        return false;
      }
      if (categoryFilter.size > 0 && !categoryFilter.has(categoryName.toLowerCase())) {
        return false;
      }
      return true;
    })
    .slice(0, limit);

  return {
    count: transactions.length,
    transactions: transactions.map((transaction) => ({
      date: transaction.date?.toDate().toISOString().slice(0, 10),
      amount: Number(transaction.amountPaise) / 100,
      type: transaction.type,
      merchant: transaction.merchantRaw || transaction.merchantNorm || transaction.description,
      category: transaction.categoryId ? categories.get(transaction.categoryId)?.name || "Uncategorised" : "Uncategorised",
      status: transaction.status,
      provenance: transaction.provenance,
      description: transaction.description,
    })),
  };
}

export async function getCashflowRadar(
  context: MarcoToolContext,
  _args: { horizonDays?: number },
) {
  const { pilotClient } = createMarcoRpcClients(context);
  const response = await pilotClient.getPaydayPlan({});
  return {
    source: "The same server-calculated payday plan shown in Vasoli",
    actionable: response.actionable,
    config: response.config?.toJson(),
    accounts: response.accounts.map(account => account.toJson()),
    projections: response.dayProjections.map(day => day.toJson()),
    warnings: response.warnings.map(warning => ({ code: warning.code, message: warning.message })),
    assumptions: "Uses confirmed INR account balances, unpaid obligations, the user's daily spending allowance, reserve and goal reservation. Future salary is excluded from spendable money. Do not recommend spending when actionable is false.",
  };
}

export async function getRecurring(
  context: MarcoToolContext,
  args: { type?: string },
) {
  const { recurringClient } = createMarcoRpcClients(context);
  const response = await recurringClient.listRules({});
  const type = args.type?.toUpperCase();

  const items = response.rules.filter((rule) => !type || type === "ALL" || rule.type === type);
  return {
    count: items.length,
    items: items.map((rule) => ({
      id: rule.id,
      type: rule.type,
      cadence: rule.cadence,
      amount: Number(rule.amountPaise) / 100,
      merchant: rule.merchantNorm,
      categoryId: rule.categoryId || null,
      nextDueDate: rule.nextDueDate?.toDate().toISOString().slice(0, 10) || null,
    })),
  };
}

export async function getGoals(
  context: MarcoToolContext,
  args: { activeOnly?: boolean },
) {
  const { goalClient } = createMarcoRpcClients(context);
  const response = await goalClient.listGoals({});
  const goals = response.goals.filter((goal) => (args.activeOnly === false ? true : goal.status === "ACTIVE"));

  return {
    count: goals.length,
    goals: goals.map((goal) => ({
      name: goal.name,
      description: goal.description,
      targetAmount: Number(goal.targetAmountPaise) / 100,
      currentAmount: Number(goal.currentAmountPaise) / 100,
      progress:
        Number(goal.targetAmountPaise) > 0
          ? Math.round((Number(goal.currentAmountPaise) / Number(goal.targetAmountPaise)) * 100)
          : 0,
      dueDate: goal.dueDate?.toDate().toISOString().slice(0, 10) || null,
      status: goal.status,
    })),
  };
}

export async function getReceiptsLifecycle(
  context: MarcoToolContext,
  args: { mode?: string; withinDays?: number },
) {
  const { receiptClient } = createMarcoRpcClients(context);
  const mode = args.mode || "all";
  const withinDays = args.withinDays || 30;

  const response =
    mode === "all"
      ? await receiptClient.listExpiring({ daysAhead: withinDays })
      : await receiptClient.listReceipts({});

  const now = Date.now();
  const receipts = response.receipts.filter((receipt) => {
    if (mode === "returns") {
      return Boolean(receipt.returnBy);
    }
    if (mode === "warranties") {
      return Boolean(receipt.warrantyUntil);
    }
    return true;
  });

  return {
    count: receipts.length,
    receipts: receipts.map((receipt) => ({
      merchant: receipt.merchant,
      amount: Number(receipt.amountPaise) / 100,
      purchaseDate: receipt.purchaseDate?.toDate().toISOString().slice(0, 10) || null,
      returnBy: receipt.returnBy?.toDate().toISOString().slice(0, 10) || null,
      warrantyUntil: receipt.warrantyUntil?.toDate().toISOString().slice(0, 10) || null,
      reimbursable: receipt.reimbursable,
      daysUntilReturnExpiry: receipt.returnBy
        ? Math.ceil((receipt.returnBy.toDate().getTime() - now) / (24 * 60 * 60 * 1000))
        : null,
      daysUntilWarrantyExpiry: receipt.warrantyUntil
        ? Math.ceil((receipt.warrantyUntil.toDate().getTime() - now) / (24 * 60 * 60 * 1000))
        : null,
    })),
  };
}

export async function getSyncConfidence(context: MarcoToolContext) {
  const { transactionClient } = createMarcoRpcClients(context);
  const response = await transactionClient.listTransactions({ pageSize: 200 });
  const transactions = response.transactions;

  const importedTransactions = transactions.filter((transaction) => transaction.provenance === "IMPORT");
  const latestImportedTransaction = importedTransactions
    .filter((transaction) => transaction.date)
    .sort((left, right) => right.date!.toDate().getTime() - left.date!.toDate().getTime())[0];

  const daysSinceImport = latestImportedTransaction?.date
    ? Math.floor((Date.now() - latestImportedTransaction.date.toDate().getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    lastImportDate: latestImportedTransaction?.date?.toDate().toISOString().slice(0, 10) || null,
    daysSinceImport,
    isStale: daysSinceImport !== null && daysSinceImport > 7,
    totalTransactions: transactions.length,
    pendingCount: transactions.filter((transaction) => transaction.status === "PENDING").length,
    postedCount: transactions.filter((transaction) => transaction.status === "POSTED").length,
    manualCount: transactions.filter((transaction) => transaction.provenance === "MANUAL").length,
    importedCount: importedTransactions.length,
    confidenceLevel:
      daysSinceImport === null
        ? "no_data"
        : daysSinceImport <= 3
          ? "high"
          : daysSinceImport <= 7
            ? "medium"
            : "low",
  };
}

export async function getSpendingAnalytics(
  context: MarcoToolContext,
  args: { monthYear?: string },
) {
  const { insightsClient } = createMarcoRpcClients(context);
  const targetMonth = args.monthYear || new Date().toISOString().slice(0, 7);

  const [analytics, merchants] = await Promise.all([
    insightsClient.getSpendingAnalytics({ monthYear: targetMonth }),
    insightsClient.getMerchantInsights({ monthYear: targetMonth })
  ]);

  return {
    monthYear: targetMonth,
    topCategories: analytics.topCategories.map(c => ({
      name: c.name,
      totalPaise: Number(c.totalPaise)
    })),
    categoryTrends: analytics.trends.map(t => ({
      categoryName: t.categoryName,
      currentPaise: Number(t.currentPaise),
      previousPaise: Number(t.previousPaise),
      differencePaise: Number(t.differencePaise)
    })),
    topMerchants: merchants.topMerchants.map(m => ({
      merchant: m.merchant,
      currentPaise: Number(m.currentPaise)
    })),
    merchantTrends: merchants.trends.map(t => ({
      merchant: t.merchant,
      currentPaise: Number(t.currentPaise),
      previousPaise: Number(t.previousPaise),
      differencePaise: Number(t.differencePaise),
      currentCount: t.currentCount
    })),
    savingsOpportunities: merchants.savingsOpportunities.map(s => ({
      type: s.type,
      merchant: s.merchant,
      description: s.description,
      potentialSavingsPaise: Number(s.potentialSavingsPaise)
    }))
  };
}

export async function getUpcomingReminders(
  context: MarcoToolContext,
  args: { type?: string },
) {
  const { reminderClient } = createMarcoRpcClients(context);
  const response = await reminderClient.listReminders({});
  const reminders = response.reminders.filter(r => r.status === "PENDING" || r.status === "SNOOZED");

  const now = Date.now();

  return {
    count: reminders.length,
    reminders: reminders.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      dueDate: r.dueDate ? r.dueDate.toDate().toISOString().slice(0, 10) : null,
      daysUntilDue: r.dueDate ? Math.ceil((r.dueDate.toDate().getTime() - now) / (24 * 60 * 60 * 1000)) : null
    }))
  };
}

export async function getHealthScore(context: MarcoToolContext) {
  const { insightsClient } = createMarcoRpcClients(context);
  const response = await insightsClient.getHealthScore({});

  return {
    score: response.score,
    components: response.components.map(c => ({
      name: c.name,
      score: c.score,
      description: c.description
    })),
    factors: response.factors.map(f => ({
      type: f.type,
      title: f.title,
      description: f.description,
      impact: f.impact
    })),
    insights: response.insights.map(i => ({
      category: i.category,
      tip: i.tip,
      priority: i.priority
    }))
  };
}

export type ToolName =
  | "get_dashboard_snapshot"
  | "search_transactions"
  | "get_cashflow_radar"
  | "get_recurring"
  | "get_goals"
  | "get_receipts_lifecycle"
  | "get_sync_confidence"
  | "get_spending_analytics"
  | "get_upcoming_reminders"
  | "get_health_score";

export async function executeTool(
  toolName: ToolName,
  context: MarcoToolContext,
  args: Record<string, any>,
): Promise<any> {
  switch (toolName) {
    case "get_dashboard_snapshot":
      return getDashboardSnapshot(context, args);
    case "search_transactions":
      return searchTransactions(context, args);
    case "get_cashflow_radar":
      return getCashflowRadar(context, args);
    case "get_recurring":
      return getRecurring(context, args);
    case "get_goals":
      return getGoals(context, args);
    case "get_receipts_lifecycle":
      return getReceiptsLifecycle(context, args);
    case "get_sync_confidence":
      return getSyncConfidence(context);
    case "get_spending_analytics":
      return getSpendingAnalytics(context, args);
    case "get_upcoming_reminders":
      return getUpcomingReminders(context, args);
    case "get_health_score":
      return getHealthScore(context);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
