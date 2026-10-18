import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// Server-only — never import in client components
// Lazy init: the SDK throws if apiKey is empty at construction time,
// so we defer creation to the first actual call.
let _genai: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
    if (process.env.MARCO_ENABLED !== "true") throw new Error("Marco is disabled.");
    if (!MARCO_MODEL || !/^gemini-[a-zA-Z0-9.\-]+$/.test(MARCO_MODEL)) throw new Error("Configure an explicit Gemini model before enabling Marco.");
    if (!_genai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("[Marco] GEMINI_API_KEY not set");
        }
        _genai = new GoogleGenAI({ apiKey });
    }
    return _genai;
}

export const MARCO_MODEL = process.env.GEMINI_API_MODEL?.trim() || "";
let verifiedModelAt = 0;

// Verify provider availability without sending any financial or chat data.
export async function verifyMarcoModel() {
    const client = getGenAI();
    if (Date.now() - verifiedModelAt < 5 * 60 * 1000) return;
    const metadata = await client.models.get({ model: MARCO_MODEL });
    if (!metadata.supportedActions?.includes("generateContent")) {
        throw new Error("The configured model does not support text generation.");
    }
    verifiedModelAt = Date.now();
}

// Each tool declaration is typed individually then combined
const dashboardSnapshot: FunctionDeclaration = {
    name: "get_dashboard_snapshot",
    description:
        "Get an overview of the user's financial situation: totals by category, safe-to-spend estimate, upcoming bills, goals progress, and last import date. Use this as a first call to understand the user's current state.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            days: {
                type: Type.NUMBER,
                description: "Number of days to look back (default 30)",
            },
        },
    },
};

const searchTxns: FunctionDeclaration = {
    name: "search_transactions",
    description:
        "Search and filter the user's transactions. Use this when the user asks about specific spending, merchants, categories, or time periods.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: "Free-text search in merchant name or description",
            },
            startDate: {
                type: Type.STRING,
                description: "Start date (ISO format YYYY-MM-DD)",
            },
            endDate: {
                type: Type.STRING,
                description: "End date (ISO format YYYY-MM-DD)",
            },
            categories: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Category names to filter by",
            },
            minAmount: {
                type: Type.NUMBER,
                description: "Minimum transaction amount",
            },
            maxAmount: {
                type: Type.NUMBER,
                description: "Maximum transaction amount",
            },
            type: {
                type: Type.STRING,
                description: "Transaction type: EXPENSE or INCOME",
            },
            limit: {
                type: Type.NUMBER,
                description: "Max results to return (default 20, max 50)",
            },
        },
    },
};

const cashflowRadar: FunctionDeclaration = {
    name: "get_cashflow_radar",
    description:
        "Get projected daily balances and identify gap days where balance may dip below minimum safe level. Use this for cashflow planning questions.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            horizonDays: {
                type: Type.NUMBER,
                description: "Number of days to project forward (default 30)",
            },
        },
    },
};

const recurring: FunctionDeclaration = {
    name: "get_recurring",
    description:
        "Get the user's recurring bills and income sources with next due dates. Use this for questions about upcoming bills or regular income.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: {
                type: Type.STRING,
                description: "Filter: 'bill', 'income', or 'all' (default 'all')",
            },
        },
    },
};

const goals: FunctionDeclaration = {
    name: "get_goals",
    description:
        "Get the user's savings goals with progress. Use this when discussing savings targets or goal tracking.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            activeOnly: {
                type: Type.BOOLEAN,
                description: "Only return active goals (default true)",
            },
        },
    },
};

const receiptsLifecycle: FunctionDeclaration = {
    name: "get_receipts_lifecycle",
    description:
        "Get receipts with return windows or warranty expiry dates. Use this for questions about returns, warranties, or reimbursables.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            mode: {
                type: Type.STRING,
                description: "'returns', 'warranties', or 'all' (default 'all')",
            },
            withinDays: {
                type: Type.NUMBER,
                description: "Only show items expiring within N days",
            },
        },
    },
};

const syncConfidence: FunctionDeclaration = {
    name: "get_sync_confidence",
    description:
        "Get data freshness metadata: last sync/import time, pending vs posted transaction counts, and stale flags. Use this when the user asks about data reliability.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
    },
};

const spendingAnalytics: FunctionDeclaration = {
    name: "get_spending_analytics",
    description:
        "Get insights on spending anomalies, category breakdowns, merchant trends, and potential savings opportunities. Use this when the user asks about money leaks or why their spending changed.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            monthYear: {
                type: Type.STRING,
                description: "The month to analyze in YYYY-MM format. Defaults to current month.",
            },
        },
    },
};

const upcomingReminders: FunctionDeclaration = {
    name: "get_upcoming_reminders",
    description:
        "Get the user's pending and snoozed reminders (bills, receipts, warranties, manual reminders). Use this when the user asks what is coming up or what bills they have next.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: {
                type: Type.STRING,
                description: "Optional filter for reminder type.",
            },
        },
    },
};

const healthScore: FunctionDeclaration = {
    name: "get_health_score",
    description:
        "Get the user's financial health score, component breakdown, and insights. Use this to explain how the health score is calculated or what they can improve.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
    },
};

// Tool declarations for Gemini function calling
export const MARCO_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    dashboardSnapshot,
    searchTxns,
    cashflowRadar,
    recurring,
    goals,
    receiptsLifecycle,
    syncConfidence,
    spendingAnalytics,
    upcomingReminders,
    healthScore,
];

