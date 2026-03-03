// Shared types between client and server

export type TransactionType = 'INCOME' | 'EXPENSE';
export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
export type ReminderStatus = 'PENDING' | 'SNOOZED' | 'COMPLETED' | 'DISMISSED';
export type ReminderType = 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_ALERT' | 'RECURRING_REVIEW' | 'CUSTOM';
export type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: TransactionType;
  receiptUrl?: string;
  isRecurring: boolean;
  userId: string;
  categoryId?: string;
  category?: Category;
  splits?: TransactionSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  description?: string;
  categoryId: string;
  category: Category;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  categories: string;
  userId: string;
  spent?: number;
  remaining?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  description: string;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  occurrences?: number;
  lastRun?: string;
  nextRun?: string;
  isActive: boolean;
  userId: string;
  categoryId?: string;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  status: GoalStatus;
  color?: string;
  icon?: string;
  userId: string;
  progress?: number;
  contributions?: GoalContribution[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  note?: string;
  goalId: string;
  transactionId?: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  type: ReminderType;
  dueDate: string;
  status: ReminderStatus;
  snoozeUntil?: string;
  metadata?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialHealthScore {
  id: string;
  score: number;
  components: HealthScoreComponents;
  factors: HealthScoreFactor[];
  insights: HealthScoreInsight[];
  userId: string;
  date: string;
}

export interface HealthScoreComponents {
  savingsRate: number;
  budgetAdherence: number;
  goalProgress: number;
  spendingConsistency: number;
  emergencyFund: number;
}

export interface HealthScoreFactor {
  category: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface HealthScoreInsight {
  type: string;
  tip: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: Record<string, number>;
  byMonth: Array<{ month: string; income: number; expenses: number }>;
}

// API Request/Response types
export interface CreateTransactionInput {
  amount: number;
  description: string;
  date: string;
  type: TransactionType;
  categoryId?: string;
  receiptUrl?: string;
  splits?: Array<{
    amount: number;
    description?: string;
    categoryId: string;
  }>;
}

export interface CreateBudgetInput {
  name: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  categories: string[];
}

export interface CreateGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: string;
  color?: string;
  icon?: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  type: ReminderType;
  dueDate: string;
  metadata?: Record<string, unknown>;
}

export interface CreateRecurringInput {
  amount: number;
  description: string;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  occurrences?: number;
  categoryId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
