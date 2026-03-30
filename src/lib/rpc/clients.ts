import { createPromiseClient } from "@connectrpc/connect";
import { transport } from "./transport";

// ARCHITECTURE CONTRACT
// All finance domain data is fetched exclusively via ConnectRPC clients (src/gen/vasoli/v1/).
// No component or page may import Prisma, Supabase table queries, or the legacy REST client
// for finance data. Supabase is used only for auth token management.
// Hooks in src/lib/hooks/ are the only permitted data-fetching layer for page components.

import { TransactionService } from "@/gen/vasoli/v1/transaction_connect";
import { ImportService } from "@/gen/vasoli/v1/import_connect";
import { RecurringService } from "@/gen/vasoli/v1/recurring_connect";
import { ReceiptService } from "@/gen/vasoli/v1/receipt_connect";
import { CategoryService } from "@/gen/vasoli/v1/category_connect";
import { InsightsService } from "@/gen/vasoli/v1/insights_connect";
import { UserService } from "@/gen/vasoli/v1/user_connect";
import { BudgetService } from "@/gen/vasoli/v1/budget_connect";
import { GoalService } from "@/gen/vasoli/v1/goal_connect";
import { ReminderService } from "@/gen/vasoli/v1/reminder_connect";

export const transactionClient = createPromiseClient(TransactionService, transport);
export const importClient = createPromiseClient(ImportService, transport);
export const recurringClient = createPromiseClient(RecurringService, transport);
export const receiptClient = createPromiseClient(ReceiptService, transport);
export const categoryClient = createPromiseClient(CategoryService, transport);
export const insightsClient = createPromiseClient(InsightsService, transport);
export const userClient = createPromiseClient(UserService, transport);
export const budgetClient = createPromiseClient(BudgetService, transport);
export const goalClient = createPromiseClient(GoalService, transport);
export const reminderClient = createPromiseClient(ReminderService, transport);
