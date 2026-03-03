# Vasoli Project Architecture

A comprehensive overview of the Vasoli personal finance management system.

## 1. High-Level Architecture

Vasoli follows a modern service-oriented architecture, separating the concerns of the presentation layer, business logic, and data persistence.

```mermaid
graph TD
    subgraph Client ["Client (Browser)"]
        A[Next.js App Router] --> B[React Components]
        B --> C[ConnectRPC Web Client]
        B --> D[Supabase Auth Client]
    end

    subgraph Backend ["Backend (Go)"]
        C -- gRPC-Web / Connect --> E[ConnectRPC Server]
        E --> F[Auth Interceptor (JWT)]
        F --> G[Service Implementation]
        G --> H[SQLC / PGX Layer]
    end

    subgraph Persistence ["Persistence & Services"]
        H --> I[Supabase PostgreSQL]
        G --> J[Nodemailer / Gmail OTP]
        D --> K[Supabase Auth Service]
    end
```

## 2. Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend Framework** | Next.js 14 (App Router), React 18 |
| **Styling** | Tailwind CSS, Framer Motion |
| **Icons** | Lucide React |
| **Communication** | ConnectRPC (gRPC-compatible) |
| **Backend Language** | Go (Golang) 1.25 |
| **Backend Framework** | ConnectRPC (Go), Standard Library `net/http` |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (JWT) |
| **ORM / Querying** | Prisma (Frontend types) / SQLC (Backend) |
| **Email Service** | NodeMailer (via Gmail SMTP) |

## 3. Implementation Details

### Authentication & Security
- **Supabase Auth**: Handles secure user registration and session management.
- **JWT Validation**: The Go backend uses an `AuthInterceptor` to validate Supabase-issued JWTs.
- **OTP Flow**: During signup, a custom NodeMailer service sends a verification code via Gmail to ensure valid user emails.

### gRPC / ConnectRPC Integration
- **Code Generation**: Proto definitions are maintained in `backend/proto`. `buf` is used to generate typed clients for both TypeScript and Go.
- **Statelessness**: The backend remains stateless, extracting user identity from the `Authorization: Bearer <JWT>` header in every request.

## 4. API Endpoints (gRPC Services)

The backend exposes several specialized services via ConnectRPC:

### UserService
| Method | Description |
| :--- | :--- |
| `GetProfile` | Fetches the authenticated user's profile information. |
| `UpdateProfile` | Updates user details like name or avatar. |
| `GetWealthAnalytics` | Returns high-level financial health data. |

### TransactionService
| Method | Description |
| :--- | :--- |
| `CreateTransaction` | Records a new income or expense. |
| `ListTransactions` | Returns a paginated list of transactions with filtering. |
| `UpdateTransaction` | Modifies an existing transaction record. |
| `DeleteTransaction` | Removes a transaction. |

### BudgetService
| Method | Description |
| :--- | :--- |
| `CreateBudget` | Sets a spending limit for a specific category or period. |
| `ListBudgets` | Lists all active and past budgets. |
| `UpdateBudget` | Adjusts budget limits or periods. |
| `DeleteBudget` | Deletes a budget. |

### GoalService
| Method | Description |
| :--- | :--- |
| `CreateGoal` | Sets a new financial savings goal (e.g., "New Car"). |
| `ListGoals` | Lists current goals and progress. |
| `AddContribution` | Adds a saving amount towards a specific goal. |

## 5. Performance Metrics

Vasoli is designed for high performance and responsiveness:

1. **Protocol Efficiency**: Using Protobuf significantly reduces payload size compared to standard JSON REST APIs (approx. 30-50% reduction).
2. **Type Safety**: End-to-end type safety (Proto -> Go/TS) eliminates entire classes of runtime errors and speeds up development.
3. **Optimized Queries**: SQLC generates high-performance, type-safe Go code for PostgreSQL queries, ensuring minimal database latency.
4. **Edge Readiness**: Next.js App Router and Supabase enable easy scaling and low-latency delivery of static assets.
5. **Cold Starts**: The Go backend is optimized for minimal memory footprint and instant startup times, ideal for modern containerized environments.
