# Vasoli Route Inventory

## Table 1: Next.js Pages

| Path | Purpose | Auth Required | Key Components |
|------|---------|:---:|----------------|
| `/` | Landing page | No | Marketing overview, FAQ, CTA |
| `/auth/signin` | Email/password sign in | No | Supabase `signInWithPassword`, Neo auth card |
| `/auth/signup` | Email/password sign up | No | Supabase `signUp`, OTP verification |
| `/app/dashboard` | Main dashboard | Yes | Summary cards, recent activity, receipts, goals |
| `/app/transactions` | Transaction ledger | Yes | Filters, manual entry, statement import |
| `/app/cashflow` | Cashflow radar | Yes | 60-day forecast, what-if simulation |
| `/app/obligations` | Recurring obligations | Yes | Recurring rules and upcoming items |
| `/app/budgets` | Budget planner | Yes | Live spend cards, budget creation modal |
| `/app/goals` | Savings goals | Yes | Goal cards, progress, goal creation |
| `/app/receipts` | Receipt vault | Yes | Receipt lifecycle and reminder workflows |
| `/app/marco` | AI coach workspace | Yes | Threaded chat, tool-backed responses |
| `/app/settings` | User settings | Yes | Profile, preferences, local-only key disclaimer |
| `/app/zine/[period]` | Monthly zine summary | Yes | Editorial monthly finance summary |

> Route protection: all `/app/*` routes are protected by `src/middleware.ts`.

## Table 2: Next.js API Routes

| Method | Path | Purpose | Auth | Notes |
|--------|------|---------|:----:|-------|
| `POST` | `/api/marco/chat` | Stream Marco responses | Yes | Persists chat history in Supabase and executes tools through ConnectRPC |
| `GET/POST` | `/api/marco/threads` | List/create Marco threads | Yes | Supabase thread persistence only |
| `GET/DELETE` | `/api/marco/threads/[id]` | Load/delete a single thread | Yes | Supabase thread persistence only |
| `GET` | `/auth/callback` | Auth callback handler | No | Exchanges the Supabase auth code and redirects |

## Table 3: Connect-RPC Services (Go Backend)

All finance-domain RPCs are served under `/rpc`.

| Service | Methods |
|---------|---------|
| `UserService` | `GetProfile`, `UpdateProfile`, `GetWealthAnalytics` |
| `TransactionService` | `CreateTransaction`, `GetTransaction`, `ListTransactions`, `UpdateTransaction`, `DeleteTransaction` |
| `BudgetService` | `CreateBudget`, `ListBudgets`, `UpdateBudget`, `DeleteBudget` |
| `GoalService` | `CreateGoal`, `GetGoal`, `ListGoals`, `UpdateGoal`, `DeleteGoal`, `AddContribution` |
| `ImportService` | `ImportStatement` |
| `RecurringService` | `ListCandidates`, `CreateRuleFromCandidate`, `ListRules`, `GetRule`, `UpdateRule`, `DeleteRule`, `ListUpcoming`, `SnoozeRule`, `CancelRule` |
| `ReceiptService` | `CreateReceipt`, `ListReceipts`, `ListExpiring`, `UpdateReceipt` |
| `CategoryService` | `ListCategories`, `SetTransactionCategory`, `ListCategoryRules` |
| `InsightsService` | `GetSummary`, `GetZine`, `GetHealthScore` |
| `ReminderService` | `GetUpcoming`, `CreateReminder`, `ListReminders`, `UpdateReminder`, `DeleteReminder`, `SnoozeReminder`, `MarkDone` |

## Table 4: Domain Data Ownership

| Entity | Primary Data Path | Status | Notes |
|--------|-------------------|--------|-------|
| Transactions | Go `TransactionService` via ConnectRPC | ✅ Live | Filters and pagination are handled in SQL |
| Recurring rules | Go `RecurringService` via ConnectRPC | ✅ Live | Upcoming expansion powers cashflow |
| Budgets | Go `BudgetService` via ConnectRPC | ✅ Live | `spent` is computed from real transactions |
| Goals | Go `GoalService` via ConnectRPC | ✅ Live | UI now uses the shared hook layer |
| Insights / zine | Go `InsightsService` via ConnectRPC | ✅ Live | No fabricated metrics remain |
| Users | Go `UserService` via ConnectRPC | ✅ Live | Profiles are derived from authenticated JWT context |
| Imports | Go `ImportService` via ConnectRPC | ✅ Live | HDFC and generic CSV parsing are supported |
| Categories | Go `CategoryService` via ConnectRPC | ✅ Live | Used for budget and transaction categorisation |
| Receipts | Go `ReceiptService` via ConnectRPC | ✅ Live | Marco reads receipt lifecycle data through RPC |
| Marco thread/message persistence | Supabase direct from Next.js API routes | ✅ Live | This is intentional and separate from finance-domain storage |
| Reminders | Go `ReminderService` via ConnectRPC | ❌ Not Implemented | Typed `CodeUnimplemented` responses only |
