> Private pilot: start with [PRODUCT.md](PRODUCT.md) and [local setup and upgrade instructions](docs/private-pilot.md). The canonical migration sequence is `supabase/migrations`; historical SQL is not a second installation path.

# Vasoli

Vasoli is a lightweight, action-oriented financial education and wellness hub. It is designed for young professionals who want to understand their money without drowning in spreadsheets.

For the source-based assessment, priorities, and next build stages, see [project analysis and plan](docs/project-analysis-and-plan.md). Production readiness has not yet been established; [STATUS.md](STATUS.md) separates implementation from validation.

## Product Vision

Vasoli isn't just about tracking where money went; it's about knowing what to do next. The core philosophy is **Capture, Review, and Reflect**:
- **Capture:** Import CSV statements, scan receipts, and log transactions.
- **Review:** See immediate safe-to-spend balances, upcoming obligations, and active goals.
- **Reflect:** Read the monthly "Ledger Zine" and chat with Marco (your AI copilot) to understand your financial health and habits without judgment.

## Current Features

- **Dashboard:** A unified cockpit showing recorded net worth, monthly net cashflow, and a computed health score.
- **Transactions & Statements:** CSV and generic imports for major Indian banks (HDFC, ICICI, SBI, Axis, Kotak, UPI passbooks).
- **Goals:** Track custom savings goals with dedicated cadence and target milestones.
- **Receipts Vault:** OCR-powered receipt capture with on-device payload encryption. Tracks return and warranty deadlines.
- **Recurring Obligations & Reminders:** Manage subscriptions, bills, and one-off tasks in a dedicated view.
- **Ledger Zine:** A stylized, magazine-like monthly digest of your spending habits and financial momentum.
- **Learn Hub:** Integrated financial education covering emergency funds, debt payoff, and investing basics.
- **Marco:** A Gemini-powered AI copilot that securely reads your localized financial data to answer questions and offer insights.
- **Achievements:** A gamified milestone system that rewards positive financial behaviors.

## Tech Stack

- **Frontend:** Next.js 14, React, TailwindCSS (Neo-brutalism design), Radix UI, Zustand, TanStack Query.
- **Backend:** Go 1.25+, Connect RPC (gRPC-web), `sqlc` for type-safe Postgres queries, `buf` for Protobuf management.
- **Database:** PostgreSQL (managed via Supabase).
- **Authentication:** Supabase Auth (Session-based via middleware).
- **AI/LLM:** Google Gemini API (via `@google/genai`).

## Local Setup

### Prerequisites
- Node.js 22.12+
- npm
- Go 1.25+
- Supabase project / PostgreSQL database

### Environment Variables

Copy `.env.example` to `.env` in the root, and `backend/.env.example` to `backend/.env`.

**Root `.env` variables:**
- `NEXT_PUBLIC_SUPABASE_URL` (Required): Next.js/Supabase URL endpoint.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Required): Next.js/Supabase anonymous API key.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` (Optional): SMTP credentials used by Nodemailer.
- `GEMINI_API_KEY` (Required for Marco): Google Gemini API key for the Marco AI assistant.
- `RPC_BACKEND_URL` (Optional): Server-only backend origin for the `/rpc` proxy; defaults to `http://localhost:8080`.
- `NEXT_PUBLIC_RPC_BASE_URL` (Optional): Browser RPC base; defaults to `/rpc`.

**Backend `backend/.env` variables:**
- `SUPABASE_JWT_SECRET` (Required): Secret key to verify incoming request authorization headers.
- `DATABASE_URL` (Required): Direct access PostgreSQL URL.
- `ENV=production` (Required for production): Enables production safeguards.
- `SERVER_ADDR` (Optional): Backend listener, default `:8080`.
- `BYPASS_AUTH=true` (Local demo only): Enables unauthenticated demo mode; rejected in production.

### Install and Run

1. Install Node.js dependencies:
```bash
npm install
```

2. Run development servers (Next.js & Go backend concurrently):
```bash
# Using Makefile
make dev

# Or using npm
npm run dev
# in a separate terminal:
npm run backend:dev
```

The Next.js app runs on `http://localhost:3000` and the Go RPC server runs on `http://localhost:8080`.

## Developer Commands

- **Code Generation:** Regenerate Protobuf clients and Go structs:
  ```bash
  npm run proto:gen
  npm run sqlc:gen
  ```
- **Testing and Verification:** Run all linters, typechecks, frontend Vitest tests, and Go backend tests:
  ```bash
  npm run check
  ```

## Known Limitations

- **Account Aggregation (India AA):** The architecture for external integrations is designed, but the live connection to the Account Aggregator ecosystem is not yet implemented.
- **Push Notifications:** Currently, reminders and alerts use in-app polling or email (via Nodemailer). Native mobile push notifications are pending mobile app wrapper deployment.
- **Forecast assumptions:** Cashflow estimates use recorded balances and recurring events. Unrecorded everyday spending and stale balances can materially change the outcome.
- **Ledger coverage:** The transaction interface currently loads a bounded set. A complete server-side filtered ledger/export is planned.
- **Release validation:** Authenticated end-to-end workflows, migration ordering, restore procedures, and live service configuration still need staging verification.
- **Responsive Constraints:** The web app is responsive, but some complex data tables may require horizontal scrolling on very narrow screens.

## Continuous Integration (CI/CD)

Vasoli uses GitHub Actions. The CI workflow (`.github/workflows/ci.yml`) automatically runs on `push` and `pull_request` to the `main` branch, enforcing:
- Frontend linting and strict typechecking.
- Vitest and Go test suite passing.
- Next.js production build success.
- `sqlc` and `buf` generation cleanliness.

## License

MIT
