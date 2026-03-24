# Marco — AI Money Coach

Marco is Vasoli's built-in AI assistant that helps Indian students understand their finances. It uses Gemini with function calling to ground all responses in the user's actual data.

## How It Works

```
User message → /api/marco/chat (SSE)
  → Load conversation history (last 20 messages)
  → Send to Gemini with system prompt + tool declarations
  → If Gemini returns function_call → execute tool (Prisma query) → feed result back
  → Repeat up to 5 tool-call iterations
  → Stream final text response to client via SSE
  → Save user + assistant messages to MarcoThread/MarcoMessage
```

## Tools (Agentic RAG)

Marco can call these tools to query the user's data:

| Tool | What it returns |
|------|-----------------|
| `get_dashboard_snapshot` | Totals, by-category breakdown, safe-to-spend, upcoming bills, goals |
| `search_transactions` | Filtered transactions by query/date/category/amount |
| `get_cashflow_radar` | Projected daily balances, gap days, min-safe line |
| `get_recurring` | Bills and income with next due dates |
| `get_goals` | Savings goals with progress percentages |
| `get_receipts_lifecycle` | Returns/warranties expiring soon |
| `get_sync_confidence` | Last import, pending vs posted counts, stale flags |

## How to Run Locally

1. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   Get one free at [Google AI Studio](https://aistudio.google.com/).

2. Run the Prisma migration (requires DB connection):
   ```bash
   npx prisma migrate dev --name add_marco_models
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Navigate to `http://localhost:3000/app/marco`

## How to Add More Tools

1. Add a new `FunctionDeclaration` in `src/lib/marco/gemini.ts`
2. Implement the server function in `src/lib/marco/tools.ts`
3. Add it to the `executeTool` switch statement
4. Add the tool name to the `ToolName` type union
5. (Optional) Add a label in `TOOL_LABELS` in the Marco page

## File Structure

```
src/lib/marco/
├── gemini.ts          # Gemini SDK init + tool declarations
├── system-prompt.ts   # Marco persona + hard rules
└── tools.ts           # 7 RAG tool implementations

src/lib/stores/
└── marco-store.ts     # Zustand UI state

src/app/(app)/marco/
└── page.tsx           # Chat UI

src/app/api/marco/
├── chat/route.ts      # SSE streaming + function calling
└── threads/
    ├── route.ts       # List + create threads
    └── [id]/route.ts  # Get + delete thread
```

## Safety Rules

- Marco never invents numbers — only uses values from tool outputs
- No investment/tax advice — focuses on tracking, budgeting, cashflow
- Per-user data isolation on every API call
- GEMINI_API_KEY is server-only, never exposed to client
- Privacy note shown in UI sidebar
