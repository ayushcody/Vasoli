// @ts-nocheck
import { prisma } from "@/lib/prisma";

// ─── Tool implementations ─────────────────────────────────────
// Each tool is a pure server function that queries Prisma and returns compact JSON.
// These are called by the Gemini function-calling loop in the chat route.

export async function getDashboardSnapshot(
    userId: string,
    args: { days?: number }
) {
    const days = args.days || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch transactions for the period
    const transactions = await prisma.transaction.findMany({
        where: { userId, date: { gte: since } },
        include: { category: true },
    });

    const totalIncome = transactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amount, 0);

    // By-category breakdown
    const byCategory: Record<string, { spent: number; count: number }> = {};
    for (const t of transactions.filter((t) => t.type === "EXPENSE")) {
        const cat = t.category?.name || "Uncategorized";
        if (!byCategory[cat]) byCategory[cat] = { spent: 0, count: 0 };
        byCategory[cat].spent += t.amount;
        byCategory[cat].count++;
    }

    // Upcoming bills (next 14 days)
    const upcomingCutoff = new Date();
    upcomingCutoff.setDate(upcomingCutoff.getDate() + 14);
    const upcomingBills = await prisma.recurringRule.findMany({
        where: {
            userId,
            active: true,
            type: "bill",
            nextDueDate: { lte: upcomingCutoff, gte: new Date() },
        },
        orderBy: { nextDueDate: "asc" },
        take: 10,
    });

    // Goals
    const goals = await prisma.goal.findMany({
        where: { userId, active: true },
    });

    // Last import
    const lastImport = await prisma.importBatch.findFirst({
        where: { userId },
        orderBy: { importedAt: "desc" },
    });

    // Pending count
    const pendingCount = await prisma.transaction.count({
        where: { userId, status: "pending" },
    });

    const safeToSpend = totalIncome - totalExpense;

    return {
        period: `Last ${days} days`,
        totalIncome,
        totalExpense,
        balance: safeToSpend,
        safeToSpend: Math.max(0, safeToSpend),
        transactionCount: transactions.length,
        pendingCount,
        byCategory: Object.entries(byCategory)
            .sort((a, b) => b[1].spent - a[1].spent)
            .map(([name, data]) => ({ name, ...data })),
        upcomingBills: upcomingBills.map((b) => ({
            merchant: b.merchant || b.description,
            amount: b.amount,
            nextDue: b.nextDueDate?.toISOString().slice(0, 10),
            cadence: b.cadence,
        })),
        goals: goals.map((g) => ({
            name: g.name,
            target: g.targetAmount,
            current: g.currentAmount,
            progress: Math.round((g.currentAmount / g.targetAmount) * 100),
        })),
        lastImportDate: lastImport?.importedAt?.toISOString().slice(0, 10) || null,
        lastImportBank: lastImport?.bankName || null,
    };
}

export async function searchTransactions(
    userId: string,
    args: {
        query?: string;
        startDate?: string;
        endDate?: string;
        categories?: string[];
        minAmount?: number;
        maxAmount?: number;
        type?: string;
        limit?: number;
    }
) {
    const limit = Math.min(args.limit || 20, 50);

    const where: any = { userId };

    if (args.query) {
        where.OR = [
            { merchantRaw: { contains: args.query, mode: "insensitive" } },
            { merchantNorm: { contains: args.query, mode: "insensitive" } },
            { description: { contains: args.query, mode: "insensitive" } },
        ];
    }

    if (args.startDate || args.endDate) {
        where.date = {};
        if (args.startDate) where.date.gte = new Date(args.startDate);
        if (args.endDate) where.date.lte = new Date(args.endDate);
    }

    if (args.categories?.length) {
        where.category = { name: { in: args.categories } };
    }

    if (args.minAmount !== undefined || args.maxAmount !== undefined) {
        where.amount = {};
        if (args.minAmount !== undefined) where.amount.gte = args.minAmount;
        if (args.maxAmount !== undefined) where.amount.lte = args.maxAmount;
    }

    if (args.type) where.type = args.type;

    const transactions = await prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: "desc" },
        take: limit,
    });

    return {
        count: transactions.length,
        transactions: transactions.map((t) => ({
            date: t.date.toISOString().slice(0, 10),
            amount: t.amount,
            type: t.type,
            merchant: t.merchantRaw || t.merchantNorm || "Unknown",
            category: t.category?.name || "Uncategorized",
            status: t.status,
            provenance: t.provenance,
            description: t.description,
        })),
    };
}

export async function getCashflowRadar(
    userId: string,
    args: { horizonDays?: number }
) {
    const horizon = args.horizonDays || 30;

    // Get current balance from posted transactions
    const allPosted = await prisma.transaction.findMany({
        where: { userId, status: "posted" },
    });

    let currentBalance = allPosted.reduce((sum, t) => {
        return t.type === "INCOME" ? sum + t.amount : sum - t.amount;
    }, 0);

    // Get upcoming recurring bills & income
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + horizon);

    const recurring = await prisma.recurringRule.findMany({
        where: {
            userId,
            active: true,
            nextDueDate: { gte: new Date(), lte: cutoff },
        },
        orderBy: { nextDueDate: "asc" },
    });

    // Project daily balances
    const dailyProjections: { date: string; balance: number; events: string[] }[] = [];
    const gapDays: string[] = [];
    const minSafe = currentBalance * 0.1; // 10% of current balance as safety net

    let projected = currentBalance;
    for (let d = 0; d < horizon; d++) {
        const date = new Date();
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10);

        const events: string[] = [];
        for (const r of recurring) {
            if (r.nextDueDate && r.nextDueDate.toISOString().slice(0, 10) === dateStr) {
                if (r.type === "bill") {
                    projected -= r.amount;
                    events.push(`-₹${r.amount} ${r.merchant || r.description || "bill"}`);
                } else {
                    projected += r.amount;
                    events.push(`+₹${r.amount} ${r.merchant || r.description || "income"}`);
                }
            }
        }

        dailyProjections.push({ date: dateStr, balance: Math.round(projected), events });
        if (projected < minSafe) gapDays.push(dateStr);
    }

    return {
        currentBalance: Math.round(currentBalance),
        minSafeBalance: Math.round(minSafe),
        horizonDays: horizon,
        gapDaysCount: gapDays.length,
        gapDays: gapDays.slice(0, 10),
        projections: dailyProjections.slice(0, 14), // Only return first 14 days for brevity
        upcomingRecurring: recurring.map((r) => ({
            type: r.type,
            merchant: r.merchant || r.description,
            amount: r.amount,
            nextDue: r.nextDueDate?.toISOString().slice(0, 10),
        })),
    };
}

export async function getRecurring(
    userId: string,
    args: { type?: string }
) {
    const where: any = { userId, active: true };
    if (args.type && args.type !== "all") where.type = args.type;

    const rules = await prisma.recurringRule.findMany({
        where,
        include: { category: true },
        orderBy: { nextDueDate: "asc" },
    });

    return {
        count: rules.length,
        items: rules.map((r) => ({
            id: r.id,
            type: r.type,
            cadence: r.cadence,
            amount: r.amount,
            merchant: r.merchant || r.description,
            category: r.category?.name || null,
            nextDueDate: r.nextDueDate?.toISOString().slice(0, 10) || null,
            upiVpa: r.upiVpa,
        })),
    };
}

export async function getGoals(
    userId: string,
    args: { activeOnly?: boolean }
) {
    const where: any = { userId };
    if (args.activeOnly !== false) where.active = true;

    const goals = await prisma.goal.findMany({
        where,
        include: { contributions: { orderBy: { createdAt: "desc" }, take: 5 } },
        orderBy: { createdAt: "desc" },
    });

    return {
        count: goals.length,
        goals: goals.map((g) => ({
            name: g.name,
            description: g.description,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
            progress: Math.round((g.currentAmount / g.targetAmount) * 100),
            dueDate: g.dueDate?.toISOString().slice(0, 10) || null,
            active: g.active,
            recentContributions: g.contributions.map((c) => ({
                amount: c.amount,
                note: c.note,
                date: c.createdAt.toISOString().slice(0, 10),
            })),
        })),
    };
}

export async function getReceiptsLifecycle(
    userId: string,
    args: { mode?: string; withinDays?: number }
) {
    const mode = args.mode || "all";
    const now = new Date();
    const cutoff = args.withinDays
        ? new Date(now.getTime() + args.withinDays * 24 * 60 * 60 * 1000)
        : null;

    const where: any = { userId };

    if (mode === "returns") {
        where.returnBy = { gte: now, ...(cutoff ? { lte: cutoff } : {}) };
    } else if (mode === "warranties") {
        where.warrantyUntil = { gte: now, ...(cutoff ? { lte: cutoff } : {}) };
    } else {
        where.OR = [
            { returnBy: { gte: now, ...(cutoff ? { lte: cutoff } : {}) } },
            { warrantyUntil: { gte: now, ...(cutoff ? { lte: cutoff } : {}) } },
        ];
    }

    const receipts = await prisma.receipt.findMany({
        where,
        include: { transaction: true },
        orderBy: { createdAt: "desc" },
        take: 20,
    });

    return {
        count: receipts.length,
        receipts: receipts.map((r) => ({
            merchant: r.merchant,
            amount: r.amount,
            date: r.date?.toISOString().slice(0, 10),
            returnBy: r.returnBy?.toISOString().slice(0, 10) || null,
            warrantyUntil: r.warrantyUntil?.toISOString().slice(0, 10) || null,
            reimbursable: r.reimbursable,
            daysUntilReturnExpiry: r.returnBy
                ? Math.ceil((r.returnBy.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
                : null,
            daysUntilWarrantyExpiry: r.warrantyUntil
                ? Math.ceil((r.warrantyUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
                : null,
        })),
    };
}

export async function getSyncConfidence(userId: string) {
    const lastImport = await prisma.importBatch.findFirst({
        where: { userId },
        orderBy: { importedAt: "desc" },
    });

    const totalTransactions = await prisma.transaction.count({
        where: { userId },
    });

    const pendingCount = await prisma.transaction.count({
        where: { userId, status: "pending" },
    });

    const postedCount = await prisma.transaction.count({
        where: { userId, status: "posted" },
    });

    const manualCount = await prisma.transaction.count({
        where: { userId, provenance: "manual" },
    });

    const importedCount = await prisma.transaction.count({
        where: { userId, provenance: "statement_import" },
    });

    const daysSinceImport = lastImport
        ? Math.floor(
            (Date.now() - lastImport.importedAt.getTime()) / (24 * 60 * 60 * 1000)
        )
        : null;

    return {
        lastImportDate: lastImport?.importedAt?.toISOString().slice(0, 10) || null,
        lastImportBank: lastImport?.bankName || null,
        daysSinceImport,
        isStale: daysSinceImport !== null && daysSinceImport > 7,
        totalTransactions,
        pendingCount,
        postedCount,
        manualCount,
        importedCount,
        confidenceLevel:
            daysSinceImport === null
                ? "no_data"
                : daysSinceImport <= 3
                    ? "high"
                    : daysSinceImport <= 7
                        ? "medium"
                        : "low",
    };
}

// ─── Tool dispatcher ──────────────────────────────────────────
export type ToolName =
    | "get_dashboard_snapshot"
    | "search_transactions"
    | "get_cashflow_radar"
    | "get_recurring"
    | "get_goals"
    | "get_receipts_lifecycle"
    | "get_sync_confidence";

export async function executeTool(
    toolName: ToolName,
    userId: string,
    args: Record<string, any>
): Promise<any> {
    switch (toolName) {
        case "get_dashboard_snapshot":
            return getDashboardSnapshot(userId, args);
        case "search_transactions":
            return searchTransactions(userId, args);
        case "get_cashflow_radar":
            return getCashflowRadar(userId, args);
        case "get_recurring":
            return getRecurring(userId, args);
        case "get_goals":
            return getGoals(userId, args);
        case "get_receipts_lifecycle":
            return getReceiptsLifecycle(userId, args);
        case "get_sync_confidence":
            return getSyncConfidence(userId);
        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}
