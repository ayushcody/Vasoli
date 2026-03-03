import { z } from 'zod';

// Transaction schemas
export const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().or(z.date()),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  categoryId: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  splits: z.array(z.object({
    amount: z.number().positive(),
    description: z.string().optional(),
    categoryId: z.string(),
  })).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// Budget schemas
export const createBudgetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().positive('Amount must be positive'),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
});

export const updateBudgetSchema = createBudgetSchema.partial();

// Goal schemas
export const createGoalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  targetAmount: z.number().positive('Target amount must be positive'),
  deadline: z.string().or(z.date()).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const addGoalContributionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  note: z.string().optional(),
  transactionId: z.string().optional(),
});

// Recurring transaction schemas
export const createRecurringSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
  occurrences: z.number().int().positive().optional(),
  categoryId: z.string().optional(),
});

export const updateRecurringSchema = createRecurringSchema.partial();

// Reminder schemas
export const createReminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['BILL_DUE', 'GOAL_MILESTONE', 'BUDGET_ALERT', 'RECURRING_REVIEW', 'CUSTOM']),
  dueDate: z.string().or(z.date()),
  metadata: z.record(z.unknown()).optional(),
});

export const updateReminderSchema = createReminderSchema.partial();

export const snoozeReminderSchema = z.object({
  snoozeUntil: z.string().or(z.date()),
});

// Auth schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required'),
});

export const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Category schema
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
});
