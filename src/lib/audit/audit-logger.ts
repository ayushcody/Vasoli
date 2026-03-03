import { prisma } from '@/lib/prisma';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'VIEW' 
  | 'EXPORT'
  | 'DOWNLOAD'
  | 'SHARE';

export type EntityType = 
  | 'Transaction' 
  | 'Budget' 
  | 'Goal' 
  | 'RecurringTransaction'
  | 'Reminder'
  | 'Category'
  | 'User'
  | 'Session'
  | 'Setting';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before ? JSON.stringify(entry.before) : null,
          after: entry.after ? JSON.stringify(entry.after) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  async getUserActivity(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      actions?: AuditAction[];
      entityTypes?: EntityType[];
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      startDate,
      endDate,
      actions,
      entityTypes,
      limit = 50,
      offset = 0,
    } = options;

    const where: Record<string, unknown> = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    if (actions?.length) {
      where.action = { in: actions };
    }

    if (entityTypes?.length) {
      where.entityType = { in: entityTypes };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + logs.length < total,
    };
  }

  async getEntityHistory(
    entityType: EntityType,
    entityId: string,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: {
          entityType,
          entityId,
        },
      }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + logs.length < total,
    };
  }

  async getRecentActivity(
    options: {
      startDate?: Date;
      actions?: AuditAction[];
      limit?: number;
    } = {}
  ) {
    const { startDate, actions, limit = 100 } = options;

    const where: Record<string, unknown> = {};

    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    if (actions?.length) {
      where.action = { in: actions };
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }
}

export const auditLogger = new AuditLogger();
