import { prisma } from '../db/prisma';
import type { Goal, CreateGoalInput, GoalContribution } from '@/shared/types';

export class GoalService {
  async getAll(userId: string, filters?: { status?: string }): Promise<Goal[]> {
    const where: any = { userId };
    if (filters?.status) where.status = filters.status;

    const goals = await prisma.goal.findMany({
      where,
      include: { contributions: true },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map(goal => ({
      ...goal,
      progress: goal.targetAmount > 0 
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) 
        : 0,
    })) as Goal[];
  }

  async getById(id: string, userId: string): Promise<Goal | null> {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { contributions: true },
    });

    if (!goal) return null;

    return {
      ...goal,
      progress: goal.targetAmount > 0 
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) 
        : 0,
    } as Goal;
  }

  async create(userId: string, data: CreateGoalInput): Promise<Goal> {
    const goal = await prisma.goal.create({
      data: {
        ...data,
        ...(data.deadline && { deadline: new Date(data.deadline) }),
        userId,
      },
      include: { contributions: true },
    });

    return {
      ...goal,
      progress: 0,
    } as Goal;
  }

  async update(id: string, userId: string, data: Partial<CreateGoalInput>): Promise<Goal> {
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Goal not found');

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        ...data,
        ...(data.deadline && { deadline: new Date(data.deadline) }),
      },
      include: { contributions: true },
    });

    return {
      ...goal,
      progress: goal.targetAmount > 0 
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) 
        : 0,
    } as Goal;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Goal not found');

    await prisma.goal.delete({ where: { id } });
  }

  async addContribution(
    goalId: string,
    userId: string,
    data: { amount: number; note?: string; transactionId?: string }
  ): Promise<GoalContribution> {
    const goal = await this.getById(goalId, userId);
    if (!goal) throw new Error('Goal not found');

    const contribution = await prisma.goalContribution.create({
      data: {
        ...data,
        goalId,
      },
    });

    // Update goal current amount
    await prisma.goal.update({
      where: { id: goalId },
      data: {
        currentAmount: { increment: data.amount },
        ...(goal.currentAmount + data.amount >= goal.targetAmount && {
          status: 'COMPLETED',
        }),
      },
    });

    return contribution as GoalContribution;
  }

  async getStats(userId: string) {
    const goals = await this.getAll(userId);
    
    const total = goals.length;
    const completed = goals.filter(g => g.status === 'COMPLETED').length;
    const active = goals.filter(g => g.status === 'ACTIVE').length;
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      total,
      completed,
      active,
      totalTarget,
      totalSaved,
      overallProgress,
    };
  }
}

export const goalService = new GoalService();
