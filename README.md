# Vasoli

Vasoli is a privacy-first personal finance product focused on everyday money clarity, not just bookkeeping. It combines statement import, recurring obligation tracking, cashflow forecasting, receipt lifecycle management, goal tracking, and a monthly "Ledger Zine" so users can understand what happened to their money and what needs attention next.

The product is opinionated around practical financial behavior:
- import statements instead of retyping everything
- surface upcoming bills and gap days before they become emergencies
- keep receipts useful for returns, warranties, and reimbursements
- turn monthly financial activity into a readable narrative instead of a spreadsheet dump

## Product Overview

### Core product surfaces
- **Dashboard**: balance, income, expenses, health score, goals in motion, and expiring receipts in one view
- **Transactions**: searchable ledger with CSV import, manual correction, filtering, sorting, and export
- **Cashflow Radar**: 60-day projection with safe-to-spend, minimum safe balance, gap-day detection, and what-if simulation
- **Receipt Vault**: OCR-powered receipt capture with encrypted payload storage, return windows, warranty tracking, and reimbursable flags
- **Goals**: target-based saving with progress tracking and contribution history
- **Obligations / Recurring rules**: upcoming recurring bills and income schedules
- **Ledger Zine**: month-by-month financial recap with category breakdowns, spending signals, and savings narrative
- **Marco assistant**: conversational finance assistant UI backed by Gemini and tool-calling flows; currently present in the app, but parts of the tool layer still point to legacy data access and should be treated as experimental

### What makes the product distinct
- **Privacy-first receipt handling**: receipt OCR can be encrypted locally in the browser using WebCrypto before storage
- **India-first money language**: rupee formatting, UPI-related fields, and bank statement import patterns are built into the data model
- **Operational finance, not just budgeting**: the app emphasizes obligations, reimbursement windows, receipt deadlines, and cashflow gaps
- **Readable financial review**: the Ledger Zine turns monthly data into a story users can actually scan and share

## Technology Stack

### Frontend
- **Framework**: Next.js 14.2.35 with App Router
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS, Radix UI primitives, custom neobrutalist component system
- **Motion**: Framer Motion
- **Charts**: Recharts
- **Forms and validation**: React Hook Form + Zod
- **Client state**: Zustand
- **Server state / caching**: TanStack Query
- **OCR**: Tesseract.js
- **Email / notifications**: Nodemailer
- **AI SDK**: `@google/genai`

### Backend and data
- **Primary backend API**: Go 1.25 Connect-RPC server
- **RPC transport**: ConnectRPC / gRPC-Web compatible clients generated from Protobuf definitions
- **Database**: PostgreSQL via Supabase
- **DB access in Go**: `pgx` + `sqlc`
- **Authentication**: Supabase Auth with JWT passed through Connect transport interceptors
- **Schema and contracts**: Protobuf, Buf, generated Go and TypeScript clients

### Infrastructure characteristics
- Next.js handles product shell, auth flows, public pages, and some app/server routes
- Go handles high-throughput RPC services for finance entities and analytics
- Supabase provides auth and Postgres persistence
- Browser-side crypto protects sensitive receipt payloads without storing the passphrase

## Repository Architecture

```text
src/
  app/                  Next.js routes, layouts, public pages, app screens, API routes
  components/           UI primitives, site shell, app shell, import components
  gen/                  Generated TypeScript protobuf/connect clients
  lib/
    rpc/                Connect transport + service clients
    hooks/              TanStack Query hooks
    crypto/             Local receipt vault encryption
    engine/             Cashflow projection logic
    ocr/                Receipt OCR parsing
    supabase/           Browser/server auth clients

backend/
  api/                  Connect-RPC service implementations
  cmd/server/           Go server entrypoint
  internal/db/          sqlc-generated query layer
  internal/gen/         Generated Go protobuf/connect code
  proto/                Protobuf service definitions
  migrations/           SQL schema/performance migrations
```

## Key Features Backed by Code

- **Statement import** supports HDFC and generic CSV formats.
- **Cashflow engine** computes projected balance, safe-to-spend, gap days, and forecast confidence.
- **Receipt Vault** uses PBKDF2 + AES-GCM in the browser with a `vault:v1:` payload format.
- **Health score** is surfaced on the dashboard and built from live finance signals.
- **Recurring rules** feed both obligations views and cashflow forecasting.
- **Ledger Zine** generates monthly summaries from analytics RPC responses.
- **Typed RPC clients** are generated end to end from the protobuf contracts in [`backend/proto`](./backend/proto).

## Performance Metrics

This repository contains both measured and inferred performance characteristics. The README separates them deliberately.

### Measured in this repo
- **Frontend production build**: `npm run build` completes successfully on the current codebase
- **Shared First Load JS**: **87.5 kB**
- **Landing page First Load JS**: **109 kB**
- **Dashboard route JS**: **251 kB**
- **Transactions route JS**: **316 kB**
- **Receipts route JS**: **256 kB**
- **Ledger Zine route JS**: **331 kB**
- **Middleware bundle**: **74.7 kB**

### Connect-RPC benchmark results
From [`docs/GRPC_BENCHMARK.md`](./docs/GRPC_BENCHMARK.md), measured on **March 4, 2026** with `hey` using **1,000 requests / 50 concurrent**:

- **Connect-RPC `GetProfile`**: **28,196 req/sec**, p50 **1.1 ms**, p95 **4.5 ms**
- **Connect-RPC `ListTransactions`**: **26,152 req/sec**, p50 **1.2 ms**, p95 **5.9 ms**
- **Next.js REST `/api/categories`**: **754 req/sec**, p50 **40.7 ms**, p95 **225 ms**

Important context:
- these are not perfectly apples-to-apples workloads
- the Go RPC handlers in the benchmark return lightweight/mock responses
- the Next.js comparison includes framework overhead and a different data path

The benchmark is still useful as a directional signal: the codebase is intentionally moving high-frequency finance operations toward typed Go RPC services.

### Performance-oriented implementation choices
- TanStack Query defaults to **5 min stale time** and **30 min GC time**
- retry logic is bounded with exponential backoff
- transaction and contribution indexes are added in [`backend/migrations/optimize_performance.sql`](./backend/migrations/optimize_performance.sql)
- protobuf-generated clients remove request/response shape drift across frontend and backend

## Social Impact

Vasoli has meaningful social impact if it is executed well, especially for people who are financially active but operationally disorganized.

- **Reduces financial blind spots**: users can see obligations, low-balance risk, and upcoming cashflow gaps before they turn into missed payments or debt spirals
- **Protects small-value money leaks**: receipts, reimbursements, return windows, and warranties are easy to ignore; the product turns them into visible, trackable assets
- **Supports financial confidence for non-experts**: the interface explains money activity in plain product language instead of accounting jargon
- **Improves privacy posture**: receipt payload encryption happens client-side, reducing the need to trust raw document contents to the server
- **Fits Indian payment realities**: rupee-first formatting, UPI-related fields, and statement import patterns make it more relevant than generic western budgeting clones
- **Encourages reflective habits**: the Ledger Zine reframes monthly review as a readable ritual, which can help users build discipline without feeling punished by the product

In short, the product’s social value is not just "help people budget." It helps people avoid preventable money mistakes, recover value from paperwork they usually lose, and understand their financial life with less shame and less friction.

## Current State and Caveats

- The repo currently reflects an active transition from older Next.js/Prisma patterns to a Supabase + Go Connect-RPC architecture.
- Some docs in [`docs/`](./docs) still describe legacy or intermediate states.
- `Marco` chat is present and polished at the UI/API level, but its server-side tool implementation still references a removed Prisma client stub and should be treated as incomplete.
- The current README intentionally describes the parts that are supported by the code today, not every historical plan in the docs.

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Go 1.25+
- Supabase project / PostgreSQL database

### Environment variables

Root `.env`:

```env
DATABASE_URL=""
SUPABASE_JWT_SECRET=""
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
GMAIL_USER=""
GMAIL_APP_PASSWORD=""
GEMINI_API_KEY=""
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
```

Backend `backend/.env`:

```env
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
SUPABASE_JWT_SECRET=""
DATABASE_URL=""
```

Notes:
- `NEXTAUTH_*` variables still exist in `.env.example`, but the active auth implementation in the app uses Supabase Auth.
- `NEXT_PUBLIC_RPC_BASE_URL` can be set if the RPC server is not mounted at `/rpc`.

### Install and run

```bash
npm install
```

```bash
npm run dev
```

In a separate terminal:

```bash
cd backend
go build ./...
go run ./cmd/server
```

The Next.js app runs on `http://localhost:3000` and the Go RPC server runs on `http://localhost:8080`.

## Verification

The current repository was verified with:

```bash
npm run build
cd backend && go build ./...
```

Both commands complete successfully on the checked codebase.

## Additional Documentation

- [`docs/architecture_detailed.md`](./docs/architecture_detailed.md)
- [`docs/GRPC_BENCHMARK.md`](./docs/GRPC_BENCHMARK.md)
- [`docs/ROUTES.md`](./docs/ROUTES.md)
- [`docs/design-system.md`](./docs/design-system.md)
- [`docs/project-summary.md`](./docs/project-summary.md)

## License

MIT
