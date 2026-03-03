import { prisma } from '../db/prisma';
import type { Budget, CreateBudgetInput } from '@/shared/types';
import { startOfMonth, endOfMonth } from 'date-fns';

export class BudgetService {
  async getAll(userId: string): Promise<Budget[]> {
    const budgets = await prisma.budget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate spent and remaining for each budget
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateSpent(
          userId,
          JSON.parse(budget.categories),
          new Date(budget.startDate),
          new Date(budget.endDate)
        );

        return {
          ...budget,
          spent,
          remaining: budget.amount - spent,
        };
      })
    );

    return enrichedBudgets as Budget[];
  }

  async getById(id: string, userId: string): Promise<Budget | null> {
    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) return null;

    const spent = await this.calculateSpent(
      userId,
      JSON.parse(budget.categories),
      new Date(budget.startDate),
      new Date(budget.endDate)
    );

    return {
      ...budget,
      spent,
      remaining: budget.amount - spent,
    } as Budget;
  }

  async create(userId: string, data: CreateBudgetInput): Promise<Budget> {
    const budget = await prisma.budget.create({
      data: {
        name: data.name,
        amount: data.amount,
        period: data.period,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        categories: JSON.stringify(data.categories),
        userId,
      },
    });

    return {
      ...budget,
      spent: 0,
      remaining: budget.amount,
    } as Budget;
  }

  async update(id: string, userId: string, data: Partial<CreateBudgetInput>): Promise<Budget> {
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Budget not found');

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...data,
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.categories && { categories: JSON.stringify(data.categories) }),
      },
    });

    const spent = await this.calculateSpent(
      userId,
      JSON.parse(budget.categories),
      new Date(budget.startDate),
      new Date(budget.endDate)
    );

    return {
      ...budget,
      spent,
      remaining: budget.amount - spent,
    } as Budget;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Budget not found');

    await prisma.budget.delete({ where: { id } });
  }

  async getAlerts(userId: string) {
    const budgets = await this.getAll(userId);
    const now = new Date();

    const alerts = budgets
      .filter(budget => {
        const start = new Date(budget.startDate);
        const end = new Date(budget.endDate);
        return now >= start && now <= end;
      })
      .map(budget => {
        const percentUsed = (budget.spent! / budget.amount) * 100;
        let severity: 'info' | 'warning' | 'critical' = 'info';
        
        if (percentUsed >= 100) severity = 'critical';
        else if (percentUsed >= 80) severity = 'warning';

        return {
          budgetId: budget.id,
          budgetName: budget.name,
          amount: budget.amount,
          spent: budget.spent!,
          remaining: budget.remaining!,
          percentUsed,
          severity,
        };
      })
      .filter(alert => alert.percentUsed >= 80); // Only return alerts for budgets at 80%+

    return alerts;
  }

  private async calculateSpent(
    userId: string,
    categoryIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        categoryId: { in: categoryIds },
        date: { gte: startDate, lte: endDate },
      },
    });

    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }
}

export const budgetService = new BudgetService();
