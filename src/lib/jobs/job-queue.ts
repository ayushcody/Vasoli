import { prisma } from '@/lib/prisma';
import { addDays, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';

export type JobType = 
  | 'RECURRING_TRANSACTION'
  | 'INSIGHT_GENERATION'
  | 'HEALTH_SCORE'
  | 'OCR_PROCESSING'
  | 'EMAIL_NOTIFICATION'
  | 'BUDGET_ALERT'
  | 'GOAL_MILESTONE_CHECK'
  | 'REPORT_GENERATION';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface JobPayload {
  [key: string]: unknown;
}

export interface Job {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  runAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  priority: number;
  userId?: string;
}

class JobQueue {
  private isProcessing = false;
  private processors: Map<JobType, (job: Job) => Promise<void>> = new Map();

  registerProcessor(type: JobType, processor: (job: Job) => Promise<void>): void {
    this.processors.set(type, processor);
  }

  async enqueue(
    type: JobType,
    payload: JobPayload,
    options: {
      delay?: number;
      priority?: number;
      maxAttempts?: number;
      userId?: string;
    } = {}
  ): Promise<Job> {
    const { delay = 0, priority = 0, maxAttempts = 3, userId } = options;
    
    const runAt = delay > 0 ? new Date(Date.now() + delay) : new Date();

    const job = await prisma.jobQueue.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        runAt,
        priority,
        maxAttempts,
        userId,
      },
    });

    return {
      ...job,
      payload: JSON.parse(job.payload),
    };
  }

  async scheduleRecurringTransaction(
    recurringId: string,
    userId: string,
    nextRun: Date
  ): Promise<void> {
    await this.enqueue(
      'RECURRING_TRANSACTION',
      { recurringId },
      { runAt: nextRun, priority: 1, userId }
    );
  }

  async scheduleInsightGeneration(userId: string, delay: number = 1000 * 60 * 60): Promise<void> {
    await this.enqueue(
      'INSIGHT_GENERATION',
      { userId },
      { delay, priority: 2, userId }
    );
  }

  async scheduleHealthScoreCalculation(userId: string, delay: number = 1000 * 60 * 60 * 24): Promise<void> {
    await this.enqueue(
      'HEALTH_SCORE',
      { userId },
      { delay, priority: 3, userId }
    );
  }

  async scheduleOCRProcessing(
    transactionId: string,
    imageUrl: string,
    userId: string
  ): Promise<void> {
    await this.enqueue(
      'OCR_PROCESSING',
      { transactionId, imageUrl },
      { priority: 5, userId }
    );
  }

  async scheduleBudgetAlert(userId: string, budgetId: string): Promise<void> {
    await this.enqueue(
      'BUDGET_ALERT',
      { budgetId },
      { priority: 4, userId }
    );
  }

  async processNextBatch(batchSize: number = 10): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const jobs = await prisma.jobQueue.findMany({
        where: {
          status: { in: ['PENDING', 'RETRYING'] },
          runAt: { lte: new Date() },
          attempts: { lt: prisma.jobQueue.fields.maxAttempts },
        },
        orderBy: [
          { priority: 'desc' },
          { runAt: 'asc' },
          { createdAt: 'asc' },
        ],
        take: batchSize,
      });

      for (const jobData of jobs) {
        const job: Job = {
          ...jobData,
          payload: JSON.parse(jobData.payload),
        };

        const processor = this.processors.get(job.type);
        if (!processor) {
          await this.markFailed(job.id, 'No processor registered for this job type');
          continue;
        }

        try {
          await this.markProcessing(job.id);
          await processor(job);
          await this.markCompleted(job.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.markFailed(job.id, errorMessage, job.attempts + 1 < job.maxAttempts);
        }
      }

      return jobs.length;
    } finally {
      this.isProcessing = false;
    }
  }

  private async markProcessing(jobId: string): Promise<void> {
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        processedAt: new Date(),
      },
    });
  }

  private async markCompleted(jobId: string): Promise<void> {
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  private async markFailed(jobId: string, error: string, shouldRetry: boolean = false): Promise<void> {
    await prisma.jobQueue.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? 'RETRYING' : 'FAILED',
        error,
        runAt: shouldRetry ? new Date(Date.now() + 60000) : undefined,
      },
    });
  }

  async getJobStatus(jobId: string): Promise<Job | null> {
    const job = await prisma.jobQueue.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    return {
      ...job,
      payload: JSON.parse(job.payload),
    };
  }

  async getUserJobs(
    userId: string,
    options: {
      status?: JobStatus;
      type?: JobType;
      limit?: number;
    } = {}
  ): Promise<Job[]> {
    const { status, type, limit = 50 } = options;

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (type) where.type = type;

    const jobs = await prisma.jobQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs.map(job => ({
      ...job,
      payload: JSON.parse(job.payload),
    }));
  }

  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.jobQueue.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

export const jobQueue = new JobQueue();

// Calculate next run date based on frequency
export function calculateNextRun(
  currentDate: Date,
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(currentDate, 1);
    case 'WEEKLY':
      return addWeeks(currentDate, 1);
    case 'BIWEEKLY':
      return addWeeks(currentDate, 2);
    case 'MONTHLY':
      return addMonths(currentDate, 1);
    case 'QUARTERLY':
      return addQuarters(currentDate, 1);
    case 'YEARLY':
      return addYears(currentDate, 1);
    default:
      return addMonths(currentDate, 1);
  }
}
