import { prisma } from '../db/prisma';
import type { Transaction, CreateTransactionInput, TransactionSummary } from '@/shared/types';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export class TransactionService {
  async getAll(userId: string, filters?: {
    type?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Transaction[]> {
    const where: any = { userId };
    
    if (filters?.type) where.type = filters.type;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        splits: { include: { category: true } },
      },
      orderBy: { date: 'desc' },
    });

    return transactions as Transaction[];
  }

  async getById(id: string, userId: string): Promise<Transaction | null> {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        category: true,
        splits: { include: { category: true } },
      },
    });

    return transaction as Transaction | null;
  }

  async create(userId: string, data: CreateTransactionInput): Promise<Transaction> {
    // Validate splits if provided
    if (data.splits && data.splits.length > 0) {
      const totalSplitAmount = data.splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(totalSplitAmount - data.amount) > 0.01) {
        throw new Error('Split amounts must equal transaction amount');
      }
    }

    const { splits, ...transactionData } = data;

    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        date: new Date(transactionData.date),
        userId,
      },
      include: { category: true },
    });

    // Create splits if provided
    if (splits && splits.length > 0) {
      await Promise.all(
        splits.map(split =>
          prisma.transactionSplit.create({
            data: {
              amount: split.amount,
              description: split.description,
              categoryId: split.categoryId,
              transactionId: transaction.id,
              userId,
            },
          })
        )
      );
    }

    // Return transaction with splits
    const result = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        category: true,
        splits: { include: { category: true } },
      },
    });

    return result as Transaction;
  }

  async update(id: string, userId: string, data: Partial<CreateTransactionInput>): Promise<Transaction> {
    // Verify ownership
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Transaction not found');

    const { splits, ...updateData } = data;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...updateData,
        ...(updateData.date && { date: new Date(updateData.date) }),
      },
      include: {
        category: true,
        splits: { include: { category: true } },
      },
    });

    return transaction as Transaction;
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Transaction not found');

    await prisma.transaction.delete({ where: { id } });
  }

  async getSummary(userId: string): Promise<TransactionSummary> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: monthStart, lte: monthEnd },
      },
      include: { category: true },
    });

    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const byCategory: Record<string, number> = {};
    transactions.forEach(t => {
      const categoryName = t.category?.name || 'Uncategorized';
      byCategory[categoryName] = (byCategory[categoryName] || 0) + t.amount;
    });

    // Get last 6 months data
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const monthlyTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: sixMonthsAgo },
      },
    });

    const byMonth: Array<{ month: string; income: number; expenses: number }> = [];
    const monthMap = new Map<string, { income: number; expenses: number }>();

    monthlyTransactions.forEach(t => {
      const month = format(new Date(t.date), 'MMM yyyy');
      if (!monthMap.has(month)) {
        monthMap.set(month, { income: 0, expenses: 0 });
      }
      const data = monthMap.get(month)!;
      if (t.type === 'INCOME') {
        data.income += t.amount;
      } else {
        data.expenses += t.amount;
      }
    });

    monthMap.forEach((value, key) => {
      byMonth.push({ month: key, ...value });
    });

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      byCategory,
      byMonth,
    };
  }
}

export const transactionService = new TransactionService();
