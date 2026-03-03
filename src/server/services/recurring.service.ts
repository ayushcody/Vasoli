import { prisma } from '../db/prisma';

export class RecurringService {
  async getUpcomingTransactions(userId: string, days: number = 30) {
    // Mock implementation for now
    return [];
  }
}

export const recurringService = new RecurringService();
