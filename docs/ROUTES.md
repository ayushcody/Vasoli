# Vasoli Route Inventory

## Table 1: Next.js Pages

| Path | Purpose | Auth Required | Key Components |
|------|---------|:---:|----------------|
| `/` | Landing page | No | Hero, Problems, Features, India-first, Privacy, FAQ, CTA |
| `/auth/signin` | Email/password sign in | No | Supabase `signInWithPassword` |
| `/auth/signup` | Email/password sign up | No | Supabase `signUp` + email confirmation |
| `/app/dashboard` | Main dashboard | Yes | Balance cards, recent transactions, sync status |
| `/app/cashflow` | Cashflow Gap Radar | Yes | Safe-to-spend, gap days, minimum balance |
| `/app/transactions` | Transaction list | Yes | Filterable list, CSV import, manual entry |
| `/app/receipts` | Receipt vault | Yes | OCR, encrypted storage, warranty reminders |
| `/app/goals` | Savings goals | Yes | Goal cards, contribution tracking |
| `/app/settings` | User settings | Yes | Profile, notifications, data export |
| `/app/zine/[period]` | Monthly Zine summary | Yes | Auto-generated financial summary |

> **Route protection**: All `/app/*` routes are protected by `src/middleware.ts` which redirects unauthenticated users to `/auth/signin`.

---

## Table 2: Next.js API Routes

| Method | Path | Purpose | Auth | Request Schema | Response Schema |
|--------|------|---------|:----:|----------------|-----------------|
| `POST` | `/api/auth/signout` | Sign out user | Yes | — | `{message}` |
| `GET` | `/api/categories` | List categories | Yes | — | `Category[]` |
| `POST` | `/api/dedup` | Deduplicate transactions | Yes | `{transactionIds[]}` | `{merged, removed}` |
| `GET/POST` | `/api/goals` | List/create goals | Yes | `{name, target_amount, ...}` | `Goal / Goal[]` |
| `POST/GET` | `/api/import` | Import CSV statement | Yes | `FormData{file, format, mapping?}` | `{batchId, totalParsed, created, matched}` |
| `GET/POST` | `/api/receipts` | List/create receipts | Yes | `{encryptedBlobPath, returnBy?, ...}` | `Receipt / Receipt[]` |
| `GET/POST` | `/api/recurring` | List/create recurring txns | Yes | `{name, amount, frequency, ...}` | `RecurringRule / RecurringRule[]` |
| `GET/POST` | `/api/transactions` | List/create transactions | Yes | `{amount, date, type, ...}` | `Transaction / Transaction[]` |
| `GET` | `/api/transactions/summary` | Financial summary | Yes | `?period=monthly` | `{income, expenses, net}` |
| `GET` | `/api/zine/[period]` | Generate Zine | Yes | — | `{html, summary}` |
| `GET` | `/auth/callback` | OAuth callback handler | No | `?code=...&next=...` | Redirect |

> **Auth pattern**: All API routes except `/auth/callback` use `createClient()` → `supabase.auth.getUser()` for authentication.

---

## Table 3: Connect-RPC Services (Go Backend)

All services are served on `localhost:8080` via HTTP POST.  
URL pattern: `POST http://localhost:8080/vasoli.v1.{ServiceName}/{MethodName}`

### UserService

| Method | HTTP Path | Purpose | Auth | Request | Response |
|--------|-----------|---------|:----:|---------|----------|
| `GetProfile` | `/vasoli.v1.UserService/GetProfile` | Fetch profile | JWT | `{id}` | `{user}` |
| `UpdateProfile` | `/vasoli.v1.UserService/UpdateProfile` | Update profile | JWT | `{name?, avatar_url?}` | `{user}` |
| `GetWealthAnalytics` | `/vasoli.v1.UserService/GetWealthAnalytics` | Financial stats | JWT | `{id}` | `{saved, spent, invested}` |

### TransactionService

| Method | HTTP Path | Purpose | Auth | Request | Response |
|--------|-----------|---------|:----:|---------|----------|
| `CreateTransaction` | `/vasoli.v1.TransactionService/CreateTransaction` | Create txn | JWT | `{amount, description, ...}` | `{transaction}` |
| `GetTransaction` | `/vasoli.v1.TransactionService/GetTransaction` | Get single | JWT | `{id}` | `{transaction}` |
| `ListTransactions` | `/vasoli.v1.TransactionService/ListTransactions` | List txns | JWT | `{page_size, page_token}` | `{transactions[]}` |
| `UpdateTransaction` | `/vasoli.v1.TransactionService/UpdateTransaction` | Update txn | JWT | `{id, amount?, ...}` | `{transaction}` |
| `DeleteTransaction` | `/vasoli.v1.TransactionService/DeleteTransaction` | Delete txn | JWT | `{id}` | `{}` |

### BudgetService

| Method | HTTP Path | Purpose | Auth | Request | Response |
|--------|-----------|---------|:----:|---------|----------|
| `CreateBudget` | `/vasoli.v1.BudgetService/CreateBudget` | Create budget | JWT | `{name, amount, period, ...}` | `{budget}` |
| `ListBudgets` | `/vasoli.v1.BudgetService/ListBudgets` | List budgets | JWT | `{}` | `{budgets[]}` |
| `UpdateBudget` | `/vasoli.v1.BudgetService/UpdateBudget` | Update budget | JWT | `{id, name?, amount?}` | `{budget}` |
| `DeleteBudget` | `/vasoli.v1.BudgetService/DeleteBudget` | Delete budget | JWT | `{id}` | `{}` |

### GoalService

| Method | HTTP Path | Purpose | Auth | Request | Response |
|--------|-----------|---------|:----:|---------|----------|
| `CreateGoal` | `/vasoli.v1.GoalService/CreateGoal` | Create goal | JWT | `{name, target_amount, ...}` | `{goal}` |
| `ListGoals` | `/vasoli.v1.GoalService/ListGoals` | List goals | JWT | `{}` | `{goals[]}` |
| `UpdateGoal` | `/vasoli.v1.GoalService/UpdateGoal` | Update goal | JWT | `{id, name?, status?}` | `{goal}` |
| `DeleteGoal` | `/vasoli.v1.GoalService/DeleteGoal` | Delete goal | JWT | `{id}` | `{}` |
| `AddContribution` | `/vasoli.v1.GoalService/AddContribution` | Add money | JWT | `{goal_id, amount, note?}` | `{goal}` |

---

## Table 4: Data Flow Overlap

> [!WARNING]
> **Dual data paths**: Both Next.js API routes (Prisma → Postgres) and Connect-RPC handlers (mock data) serve similar entities. Currently there is no integration between them.

| Entity | Next.js API (Prisma) | Connect-RPC (Go) | Status |
|--------|---------------------|-------------------|--------|
| Transactions | ✅ Live (Postgres) | ⚠️ Mock data | Not integrated |
| Budgets | ❌ Not implemented | ⚠️ Mock data | — |
| Goals | ✅ Live (Postgres) | ⚠️ Mock data | Not integrated |
| Receipts | ✅ Live (Postgres) | ❌ No service | — |
| Users | Via Supabase Auth | ⚠️ Mock data | Not integrated |
