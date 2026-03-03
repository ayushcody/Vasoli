import { prisma } from '../db/prisma';

export class HealthScoreService {
  async getHealthScoreInsights(userId: string) {
    // Mock implementation for now
    return {
      score: 75,
      status: 'GOOD',
      insights: [
        { title: 'Savings Rate', description: 'Your savings rate is above average.', impact: 'POSITIVE' },
        { title: 'Budget Adherence', description: 'You are staying within your budgets.', impact: 'POSITIVE' }
      ]
    };
  }
}

export const healthScoreService = new HealthScoreService();
