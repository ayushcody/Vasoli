# gRPC (Connect-RPC) Architecture — Vasoli Backend

## What It Is

Vasoli's Go backend uses **[Connect-RPC](https://connectrpc.com/)** — NOT raw gRPC. Connect-RPC is a protocol-compatible framework that speaks:

| Protocol | Transport | Browser support |
|----------|-----------|-----------------|
| Connect (default) | HTTP/1.1 or HTTP/2 | ✅ Native — plain `fetch()` works |
| gRPC | HTTP/2 only | ❌ Needs proxy |
| gRPC-Web | HTTP/1.1 | ✅ With adapter |

This means the backend accepts **standard HTTP POST requests with JSON bodies** — no special proxy, Envoy, or grpc-web adapter needed.

## Where It Runs

```
┌───────────────────┐      HTTP POST (JSON or Protobuf)       ┌────────────────────┐
│   Next.js Client  │ ──────────────────────────────────────→  │  Go Connect-RPC    │
│   (browser or     │                                          │  Server             │
│    server-side)   │ ←────────────────────────────────────── │  localhost:8080     │
│   localhost:3000  │      JSON or Protobuf response           │  h2c transport      │
└───────────────────┘                                          └────────────────────┘
```

- **Port**: `8080`
- **Transport**: h2c (HTTP/2 cleartext, no TLS in dev)
- **Entry point**: `backend/cmd/server/main.go`
- **Auth**: JWT interceptor validates Supabase access tokens via `sub` claim

## How Next.js Talks to It

`buf.gen.yaml` generates TypeScript Connect-RPC clients:

```
backend/buf.gen.yaml
  → buf.build/connectrpc/es   → src/gen/vasoli/v1/*_connect.ts    (client stubs)
  → buf.build/bufbuild/es     → src/gen/vasoli/v1/*.pb.ts         (message types)
```

Usage from Next.js:
```typescript
import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient } from "@connectrpc/connect";
import { UserService } from "@/gen/vasoli/v1/user_connect";

const transport = createConnectTransport({ baseUrl: "http://localhost:8080" });
const client = createClient(UserService, transport);
const res = await client.getProfile({ id: "user-uuid" });
```

Or using plain `curl` (Connect protocol = HTTP POST + JSON):
```bash
curl -X POST http://localhost:8080/vasoli.v1.UserService/GetProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-jwt>" \
  -d '{"id": "user-uuid"}'
```

## Services + Methods Table

### UserService (3 RPCs)

| Method | Request | Response | Purpose |
|--------|---------|----------|---------|
| `GetProfile` | `{id}` | `{user}` | Fetch user profile by ID |
| `UpdateProfile` | `{name?, avatar_url?}` | `{user}` | Update profile fields |
| `GetWealthAnalytics` | `{id}` | `{saved, spent, invested}` | Aggregated financial stats |

### TransactionService (5 RPCs)

| Method | Request | Response | Purpose |
|--------|---------|----------|---------|
| `CreateTransaction` | `{amount, description, date, type, ...}` | `{transaction}` | Create new transaction |
| `GetTransaction` | `{id}` | `{transaction}` | Fetch single transaction |
| `ListTransactions` | `{page_size, page_token, type?, category_id?}` | `{transactions[], next_page_token}` | Paginated list |
| `UpdateTransaction` | `{id, amount?, description?, ...}` | `{transaction}` | Partial update |
| `DeleteTransaction` | `{id}` | `{}` | Delete transaction |

### BudgetService (4 RPCs)

| Method | Request | Response | Purpose |
|--------|---------|----------|---------|
| `CreateBudget` | `{name, amount, period, start_date, end_date, categories}` | `{budget}` | Create budget |
| `ListBudgets` | `{}` | `{budgets[]}` | List all budgets |
| `UpdateBudget` | `{id, name?, amount?, period?, categories?}` | `{budget}` | Update budget |
| `DeleteBudget` | `{id}` | `{}` | Delete budget |

### GoalService (5 RPCs)

| Method | Request | Response | Purpose |
|--------|---------|----------|---------|
| `CreateGoal` | `{name, description?, target_amount, deadline?, color?, icon?}` | `{goal}` | Create savings goal |
| `ListGoals` | `{}` | `{goals[]}` | List all goals |
| `UpdateGoal` | `{id, name?, target_amount?, status?}` | `{goal}` | Update goal |
| `DeleteGoal` | `{id}` | `{}` | Delete goal |
| `AddContribution` | `{goal_id, amount, note?}` | `{goal}` | Add money to goal |

## How to Run Locally

```bash
# Terminal 1: Start Go backend
cd backend
# Set env vars (or use the backend/.env file)
export SUPABASE_JWT_SECRET="<your-jwt-secret>"
go run cmd/server/main.go
# → "Starting Vasoli gRPC server on :8080..."

# Terminal 2: Start Next.js frontend
npm run dev
# → http://localhost:3000
```

## How to Test with curl

```bash
# Health check — list a service (returns empty list, proving the endpoint is alive)
curl -s -X POST http://localhost:8080/vasoli.v1.TransactionService/ListTransactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-access-token>" \
  -d '{}'

# Get user profile
curl -s -X POST http://localhost:8080/vasoli.v1.UserService/GetProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-access-token>" \
  -d '{"id": "test-user-id"}'
```

> **Note**: All endpoints require a valid Supabase JWT in the `Authorization: Bearer` header.
> The JWT's `sub` claim is extracted as the user ID.

## Where gRPC (Connect-RPC) Is Improving This

### Benefits (specific to Vasoli)

1. **Schema contracts**: Proto files in `backend/proto/vasoli/v1/` are the single source of truth. Both Go handlers and TypeScript clients are auto-generated — no manual API contract sync.
2. **Binary protobuf option**: Connect protocol supports both JSON and binary protobuf codec. For bulk transaction imports, binary reduces payload ~30-60%.
3. **Codegen eliminates drift**: `buf generate` produces type-safe Go handlers + TS clients from the same `.proto` files. Adding a field to `Transaction` updates both sides automatically.
4. **HTTP-native**: Unlike raw gRPC, Connect works over HTTP/1.1 — no Envoy proxy, no grpc-web adapter. The browser can call it with `fetch()`.

### Tradeoffs (honest assessment)

1. **All handlers return mock data**: DB connections are nil / commented out in `main.go`. The gRPC layer is scaffolded but not wired to Postgres yet.
2. **Dual data path**: Next.js API routes (`/api/transactions`) use Prisma directly, while Connect-RPC handlers have separate (mocked) implementations. This creates two code paths for the same data.
3. **No streaming used**: All RPCs are unary. Server streaming (e.g., real-time transaction feed) is supported but not implemented.
4. **Extra infrastructure**: Running a separate Go process on `:8080` alongside Next.js on `:3000` adds operational complexity vs. a single-process solution.

## File Layout

```
backend/
├── cmd/server/main.go          # Server entry point — registers services, starts h2c server
├── api/
│   ├── auth.go                 # JWT interceptor (validates Supabase tokens)
│   ├── user.go                 # UserService handler (mock data)
│   ├── transaction.go          # TransactionService handler (mock data)
│   ├── budget.go               # BudgetService handler (mock data)
│   └── goal.go                 # GoalService handler (mock data)
├── proto/vasoli/v1/            # Protobuf source files
│   ├── user.proto
│   ├── transaction.proto
│   ├── budget.proto
│   └── goal.proto
├── internal/gen/vasoli/v1/     # Generated Go code (protobuf + connect)
│   ├── *.pb.go                 # Message types
│   └── v1connect/*.connect.go  # Service handlers/clients
├── internal/db/                # sqlc generated (not yet wired)
├── buf.gen.yaml                # Codegen config
├── buf.yaml                    # Buf module config
├── go.mod                      # Go dependencies
└── .env                        # Backend env vars
```
