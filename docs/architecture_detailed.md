# Vasoli Project Architecture

## 1. High-Level Architecture

Vasoli uses a single finance-domain data contract:

- The Next.js app is a UI layer.
- Finance data flows through generated ConnectRPC clients only.
- The Go backend owns domain logic, validation, and persistence.
- Supabase is used for auth/session management and Marco thread persistence.

```mermaid
graph TD
    subgraph Client ["Client (Browser / Next.js)"]
        A[App Router Pages] --> B[Hooks in src/lib/hooks]
        B --> C[Generated ConnectRPC TS Clients]
        A --> D[Supabase Auth Session]
    end

    subgraph NextAPI ["Next.js API Routes"]
        E[/api/marco/*] --> F[Marco tool execution]
        F --> C
        E --> G[Supabase thread/message persistence]
    end

    subgraph Backend ["Go Backend"]
        C --> H[ConnectRPC Server]
        H --> I[JWT Auth Interceptor]
        H --> J[Request ID + RPC Logging]
        I --> K[Service Handlers]
        K --> L[SQLC + pgx]
        L --> M[Supabase PostgreSQL]
    end
```

## 2. Tech Stack

| Component | Technology |
| :--- | :--- |
| Frontend | Next.js 14, React 18, TypeScript |
| State / Data | TanStack Query, Zustand |
| Styling / Motion | Tailwind CSS, Framer Motion |
| RPC | ConnectRPC with generated TS and Go clients |
| Backend | Go 1.25, `net/http`, ConnectRPC |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth with JWT validation in Go |
| Query Layer | SQLC + pgx |
| AI | Gemini-backed Marco tools executed through Next.js API routes and ConnectRPC |

## 3. Finance Data Contract

Architecture contract:

- All finance-domain data is fetched through `src/gen/vasoli/v1/*` clients.
- Page components must use hooks from `src/lib/hooks/`.
- Prisma is not part of the active finance data path.
- Legacy REST finance clients are not part of the active architecture.
- Supabase direct table access is reserved for auth/session concerns and Marco thread persistence.

## 4. Backend Services

| Service | Responsibility |
| :--- | :--- |
| `UserService` | Profiles and wealth analytics derived from authenticated context |
| `TransactionService` | Transaction CRUD, scoped reads, SQL-backed filters, pagination |
| `BudgetService` | Budget CRUD and computed spend aggregation |
| `GoalService` | Goal CRUD and contributions |
| `ImportService` | CSV statement import, dedupe, partial failure reporting |
| `RecurringService` | Rule management, upcoming event expansion, snooze/cancel workflows |
| `ReceiptService` | Receipt lifecycle storage and expiring receipt views |
| `CategoryService` | Category lists and transaction categorisation rules |
| `InsightsService` | Summary math, zine metrics, health score inputs |
| `ReminderService` | Reserved; currently typed unimplemented responses |

## 5. Marco Architecture

Marco no longer reads finance data through Prisma or direct table queries.

Current flow:

1. `/api/marco/chat` authenticates the user through Supabase.
2. The route creates server-side ConnectRPC clients with the user's JWT.
3. Marco tools call backend services such as `TransactionService`, `RecurringService`, `GoalService`, `ReceiptService`, `UserService`, and `CategoryService`.
4. Tool results are mapped into Gemini-friendly tool payloads.
5. Supabase stores only Marco threads and messages.

This keeps Marco aligned with the same backend truth used by the rest of the app.

## 6. Observability

- Every frontend RPC request attaches an `x-request-id`.
- The Go server propagates a request ID through request context and response headers.
- RPC failures are logged with structured fields including `method`, `user_id`, `request_id`, and `error`.
- Next.js user-facing failures use `toast.error` and `logError(context, error)` instead of ad hoc `console.error` calls.
