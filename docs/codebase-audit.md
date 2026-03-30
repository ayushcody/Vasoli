# Vasoli Codebase Audit

This document captures the current problems in the Vasoli codebase across product behavior, UX, architecture, correctness, security, performance, and delivery maturity.

It is based on a direct review of the current repository state, not on historical intent in older docs.

## Codebase Overview

This section explains what exists in the repository today, where it lives, and what each part is responsible for.

### Root-level files and folders

- [`package.json`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/package.json)
  Frontend package manifest for the Next.js application. Also reveals an architecture clue: only frontend scripts are defined here, while the Go backend is managed separately.
- [`README.md`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/README.md)
  Project-facing overview. Recently corrected, but still should be kept in sync with the code.
- [`src/`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src)
  Active Next.js application, components, client utilities, hooks, stores, auth helpers, OCR, crypto, and RPC client layer.
- [`backend/`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend)
  Active Go backend using Connect-RPC, sqlc, pgx, auth middleware, and domain services.
- [`docs/`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/docs)
  Mixed-currentness documentation. Some docs are accurate, some are transitional, and some are stale.
- [`public/`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/public)
  Static assets such as logos and favicon resources.
- [`scripts/`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/scripts)
  Small support scripts and seed artifacts.

### Frontend app routing: `src/app`

The Next.js App Router is stored under [`src/app`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app).

#### Global app shell
- [`src/app/layout.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/layout.tsx)
  Root HTML shell. Registers fonts, TanStack Query provider, and the global Sonner toaster.
- [`src/app/globals.css`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/globals.css)
  Global styling and theme tokens.
- [`src/app/error.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/error.tsx)
  Route-level error fallback.
- [`src/app/global-error.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/global-error.tsx)
  Global app-level error fallback.
- [`src/app/not-found.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/not-found.tsx)
  404 page.

#### Public marketing and informational pages
- [`src/app/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/page.tsx)
  Landing page.
- [`src/app/about/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/about/page.tsx)
  About page.
- [`src/app/pricing/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/pricing/page.tsx)
  Pricing page.
- [`src/app/contact/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/contact/page.tsx)
  Contact page.
- [`src/app/privacy/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/privacy/page.tsx)
  Privacy page.
- [`src/app/terms/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/terms/page.tsx)
  Terms page.
- [`src/app/status/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/status/page.tsx)
  Status page.
- [`src/app/maintenance/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/maintenance/page.tsx)
  Maintenance page.
- [`src/app/ui-kit/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/ui-kit/page.tsx)
  UI showcase / component playground.
- [`src/app/robots.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/robots.ts)
  SEO robots config.
- [`src/app/sitemap.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/sitemap.ts)
  Sitemap generation.

#### Auth routes
- [`src/app/auth/layout.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/auth/layout.tsx)
  Auth route wrapper.
- [`src/app/auth/loading.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/auth/loading.tsx)
  Auth loading state.
- [`src/app/auth/signin/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/auth/signin/page.tsx)
  Sign-in flow.
- [`src/app/auth/signup/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/auth/signup/page.tsx)
  Sign-up flow.
- [`src/app/auth/callback/route.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/auth/callback/route.ts)
  Supabase auth callback route.

#### Protected product routes
- [`src/app/app/layout.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/layout.tsx)
  Protected app layout. Server-side auth gate plus app shell.
- [`src/app/app/loading.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/loading.tsx)
  App-wide loading state.
- [`src/app/app/dashboard/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/dashboard/page.tsx)
  Main dashboard.
- [`src/app/app/transactions/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/transactions/page.tsx)
  Transaction list, filter, import, edit, export.
- [`src/app/app/obligations/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/obligations/page.tsx)
  Recurring obligations UI.
- [`src/app/app/cashflow/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/cashflow/page.tsx)
  Cashflow forecast.
- [`src/app/app/receipts/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/receipts/page.tsx)
  Receipt vault.
- [`src/app/app/goals/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/goals/page.tsx)
  Goals management.
- [`src/app/app/settings/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/settings/page.tsx)
  Settings and integrations.
- [`src/app/app/marco/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/marco/page.tsx)
  AI assistant UI.
- [`src/app/app/zine/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/zine/page.tsx)
  Zine redirect or route entry.
- [`src/app/app/zine/[period]/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/zine/[period]/page.tsx)
  Monthly financial narrative page.

#### Next.js server API routes
- [`src/app/api/marco/chat/route.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/api/marco/chat/route.ts)
  SSE-based AI chat route for Marco.
- [`src/app/api/marco/threads/route.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/api/marco/threads/route.ts)
  Thread list/create route.
- [`src/app/api/marco/threads/[id]/route.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/api/marco/threads/[id]/route.ts)
  Thread fetch/delete route.

### Components: `src/components`

#### App shell and navigation
- [`src/components/app/app-shell.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/app-shell.tsx)
- [`src/components/app/app-topbar.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/app-topbar.tsx)
- [`src/components/app/app-breadcrumbs.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/app-breadcrumbs.tsx)
- [`src/components/app/user-menu.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/user-menu.tsx)
- [`src/components/app/command-palette.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/command-palette.tsx)
- [`src/components/app/screen-states.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/app/screen-states.tsx)
- [`src/components/sidebar.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/sidebar.tsx)

#### Site / marketing components
- [`src/components/site/site-shell.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/site/site-shell.tsx)
- [`src/components/site/site-header.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/site/site-header.tsx)
- [`src/components/site/site-footer.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/site/site-footer.tsx)
- [`src/components/site/contact-form.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/site/contact-form.tsx)

#### Feature component
- [`src/components/import/statement-importer.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/import/statement-importer.tsx)
  Statement import component used from product surfaces.

#### Motion and UI primitives
- [`src/components/motion/*`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/motion)
  Animation wrappers and empty states.
- [`src/components/ui/*`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/ui)
  Shared primitive and composite UI components.

### Frontend libraries: `src/lib`

#### Data and networking
- [`src/lib/rpc/transport.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/rpc/transport.ts)
  Connect transport plus Supabase token injection.
- [`src/lib/rpc/clients.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/rpc/clients.ts)
  Typed RPC client creation.
- [`src/lib/api/client.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/api/client.ts)
  Legacy generic REST client with refresh-token logic; appears unused in the active architecture.

#### Hooks
- [`src/lib/hooks/index.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/index.ts)
  Re-export barrel for hooks.
- [`src/lib/hooks/query-provider.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/query-provider.tsx)
  Global TanStack Query provider and query defaults.
- [`src/lib/hooks/use-transactions.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-transactions.ts)
- [`src/lib/hooks/use-goals.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-goals.ts)
- [`src/lib/hooks/use-budgets.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-budgets.ts)
- [`src/lib/hooks/use-recurring.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-recurring.ts)
- [`src/lib/hooks/use-reminders.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-reminders.ts)
- [`src/lib/hooks/use-health-score.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-health-score.ts)
- [`src/lib/hooks/use-receipts.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-receipts.ts)
- [`src/lib/hooks/use-mobile.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-mobile.ts)

#### Domain utilities
- [`src/lib/engine/cashflow.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/engine/cashflow.ts)
  Cashflow projection engine.
- [`src/lib/crypto/vault.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/crypto/vault.ts)
  Receipt vault encryption.
- [`src/lib/ocr/receipt-scanner.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/ocr/receipt-scanner.ts)
  OCR wrapper and extraction heuristics.
- [`src/lib/parsers/csv-generic.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/parsers/csv-generic.ts)
- [`src/lib/parsers/hdfc-statement.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/parsers/hdfc-statement.ts)
- [`src/lib/parsers/merchant.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/parsers/merchant.ts)

#### Auth and app helpers
- [`src/lib/supabase/browser.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/supabase/browser.ts)
- [`src/lib/supabase/server.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/supabase/server.ts)
- [`src/lib/supabase/middleware.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/supabase/middleware.ts)
- [`src/lib/navigation.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/navigation.ts)
- [`src/lib/site.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/site.ts)
- [`src/lib/utils.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/utils.ts)
- [`src/lib/analytics.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/analytics.ts)
- [`src/lib/mailer.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/mailer.ts)
- [`src/lib/upi/pay.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/upi/pay.ts)

#### AI-specific code
- [`src/lib/marco/gemini.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/gemini.ts)
- [`src/lib/marco/system-prompt.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/system-prompt.ts)
- [`src/lib/marco/tools.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/tools.ts)

#### State stores
- [`src/lib/stores/ui-store.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/stores/ui-store.ts)
- [`src/lib/stores/chat-store.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/stores/chat-store.ts)
- [`src/lib/stores/marco-store.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/stores/marco-store.ts)
- [`src/lib/stores/index.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/stores/index.ts)

#### Generated TypeScript clients
- [`src/gen/vasoli/v1/*`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/gen/vasoli/v1)
  Generated protobuf messages and Connect client stubs for frontend use.

### Backend structure: `backend`

#### Server entrypoint
- [`backend/cmd/server/main.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/cmd/server/main.go)
  Initializes env loading, DB pool, Connect handlers, CORS, and starts the local RPC server.

#### Domain services
- [`backend/api/auth.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/auth.go)
  Connect auth interceptor and user ID extraction.
- [`backend/api/user.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/user.go)
- [`backend/api/transaction.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/transaction.go)
- [`backend/api/category.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/category.go)
- [`backend/api/import.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/import.go)
- [`backend/api/recurring.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/recurring.go)
- [`backend/api/receipt.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/receipt.go)
- [`backend/api/goal.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/goal.go)
- [`backend/api/budget.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/budget.go)
- [`backend/api/reminder.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/reminder.go)
- [`backend/api/insights.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/insights.go)
- [`backend/api/utils.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/utils.go)

#### Database layer
- [`backend/query.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/query.sql)
  Source SQL used by sqlc.
- [`backend/internal/db/query.sql.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/db/query.sql.go)
  Generated query layer.
- [`backend/internal/db/models.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/db/models.go)
  Generated models.
- [`backend/internal/db/db.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/db/db.go)
- [`backend/internal/db/querier.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/db/querier.go)
- [`backend/internal/db/copyfrom.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/db/copyfrom.go)

#### Schema and migrations
- [`backend/db/schema.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/db/schema.sql)
  Core domain tables.
- [`backend/supabase_schema.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/supabase_schema.sql)
  Alternate or Supabase-targeted schema material.
- [`backend/migrations/optimize_performance.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/migrations/optimize_performance.sql)
  Indexes and performance improvements.
- [`backend/migrations/marco_tables.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/migrations/marco_tables.sql)
  AI assistant persistence schema.

#### Proto and codegen configuration
- [`backend/proto/vasoli/v1/*`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/proto/vasoli/v1)
  Source protobuf definitions.
- [`backend/buf.yaml`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/buf.yaml)
- [`backend/buf.gen.yaml`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/buf.gen.yaml)
- [`backend/sqlc.yaml`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/sqlc.yaml)

#### Internal domain helpers
- [`backend/internal/merchantnorm/merchantnorm.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/merchantnorm/merchantnorm.go)
  Merchant normalization logic.
- [`backend/internal/merchantnorm/merchantnorm_test.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/merchantnorm/merchantnorm_test.go)
  Merchant normalization test coverage.

## Executive Summary

Vasoli has a strong product direction and a promising technical foundation, but the current codebase is in a partially migrated state:

- the product shell is polished
- the Next.js frontend builds successfully
- the Go + Connect-RPC architecture is directionally good
- several core finance features are only partially implemented
- some screens present production-grade UX over mock, stubbed, or placeholder data paths
- there are correctness issues in financial logic that should be treated as high severity

The main problem is not visual quality or framework choice. The main problem is trust: this is a finance product, and parts of the system currently look more complete than they are.

## Architecture Defects

This section focuses specifically on architectural defects rather than feature-level defects.

## A1. Incomplete migration between architectural eras

The codebase has at least three architectural eras coexisting:

1. older Next.js API / Prisma-oriented architecture
2. current Supabase-authenticated Next.js frontend with generated Connect clients
3. Go + Connect-RPC backend with sqlc and PostgreSQL

Evidence:
- legacy Prisma stub remains in [`src/lib/prisma.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/prisma.ts)
- legacy generic REST client remains in [`src/lib/api/client.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/api/client.ts)
- docs still refer to old NextAuth / Prisma patterns
- frontend largely uses RPC clients
- some AI/server flows still depend on the removed Prisma path

Why this is an architectural defect:
- migration boundaries are not explicit
- dead paths remain importable
- reviewers and future contributors cannot infer the true system contract from the tree alone

## A2. Missing source-of-truth discipline

A healthy architecture answers these questions clearly:
- where is finance truth stored?
- where are finance rules computed?
- which layer owns derived values?
- which layer is allowed to fabricate defaults?

In this codebase, the answers are inconsistent.

Examples:
- transaction summaries are computed in Go but interpreted loosely in the frontend
- cashflow logic exists in the frontend while recurring data comes from RPC
- health score is served from backend mocks while hooks treat it as authoritative domain output
- zine is rendered in the frontend from backend responses that mix real and fabricated fields

Impact:
- domain behavior is not stable
- bugs become boundary bugs rather than local bugs

## A3. The frontend contract is stronger than the backend contract

The frontend is written as if services are mature:
- screens assume CRUD semantics
- hooks assume complete responses
- UI copy assumes accurate metrics

The backend in multiple areas only provides:
- empty success responses
- mocks
- partial fields
- placeholder implementations

This reverses the healthy dependency direction. Normally the UI should be constrained by backend capability, not the other way around.

## A4. Shared abstractions exist but are bypassed

The repo already has reusable layers:
- query provider
- hook layer
- app shell
- route registry
- generated RPC clients

But the architecture is not consistently enforced:
- goals page bypasses hook abstraction
- Marco bypasses the main RPC pattern and uses its own Next.js API + Supabase data path
- OCR/import logic is partly frontend-only while product language implies backend ingestion

This creates a system that looks modular but behaves ad hoc.

## A5. Multiple data-access styles coexist without a clear policy

Current data access styles:
- generated Connect RPC clients
- Supabase direct table access inside Next.js API routes
- local browser storage for selected settings
- dead Prisma import path
- dead generic REST API client

These are not inherently wrong together, but there is no clear architectural rule for when each is allowed.

Impact:
- hard to reason about state ownership
- duplicated auth assumptions
- uneven security posture

## A6. Domain logic placement is inconsistent

Examples of where logic currently lives:
- projection math in [`src/lib/engine/cashflow.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/engine/cashflow.ts)
- merchant normalization in [`backend/internal/merchantnorm/merchantnorm.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/merchantnorm/merchantnorm.go)
- OCR parsing in [`src/lib/ocr/receipt-scanner.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/ocr/receipt-scanner.ts)
- zine and summary analytics in [`backend/api/insights.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/insights.go)
- assistant tool composition in [`src/lib/marco/tools.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/tools.ts)

The issue is not that logic is distributed. The issue is that there is no consistent rule for what must be server-owned versus what may safely remain client-owned.

For a finance product:
- truth-bearing calculations should be server-owned
- presentation-only formatting can stay client-owned
- expensive or sensitive parsing must be intentionally placed

That rule is not consistently applied.

## A7. Generated contracts are undercut by adapter behavior

One of the main benefits of protobuf + Connect is that generated clients provide a stable contract between frontend and backend.

That benefit is weakened because hook adapters:
- cast aggressively
- use `any`
- inject placeholder values
- infer missing semantics
- ignore filters or unsupported fields

This means the project has the cost of typed RPC infrastructure without fully capturing its reliability benefits.

## A8. The AI subsystem is architecturally isolated in a fragile way

Marco does not follow the same domain access pattern as the main app.

It uses:
- Next.js API routes
- direct Supabase table access for threads/messages
- Gemini function calling
- a broken Prisma-based tool layer for finance data

This makes Marco architecturally detached from the main system rather than a thin interface over shared domain services.

That is a major defect because:
- it duplicates domain access assumptions
- it is hard to make trustworthy
- it is harder to test than standard RPC-backed features

## A9. Route-level product modularity is stronger than service modularity

The frontend route structure is fairly readable:
- dashboard
- transactions
- obligations
- cashflow
- receipts
- goals
- zine
- settings
- Marco

The backend service maturity does not mirror that modularity. Some services are real, some are partial, some are mock-only.

This asymmetry makes the architecture deceptive: the product map is coherent, but the service map is not.

## A10. Observability is not designed as a first-class architecture concern

Current patterns rely too heavily on:
- console logging
- toasts
- passive UI states

What is missing architecturally:
- request IDs propagated across frontend and backend
- structured logs in Go services
- metrics for RPC latency / failure
- error classification by service or feature
- visibility into auth, import, OCR, and AI tool failures

Without observability, the distributed architecture becomes harder to operate as the product grows.

## A11. Test architecture is not aligned with system criticality

The current system uses:
- Next.js frontend
- Supabase auth
- Go backend
- generated contracts
- SQLC query layer
- AI route logic

That requires layered testing:
- unit tests for pure logic
- service tests for domain handlers
- integration tests for RPC + DB
- contract tests around generated APIs
- smoke tests for major user flows

The repository does not currently show that level of testing architecture.

## A12. Documentation architecture is fragmented

The documentation set is not operating as a clean architecture record.

Current docs include:
- architecture docs
- phase summaries
- project summary
- gRPC benchmark doc
- route inventory
- migration guide
- Marco doc

Problem:
- these documents do not consistently represent the same system state
- some are historical snapshots rather than current truth

That is an architecture defect because architecture is partly operational memory, and this memory is inconsistent.

## 1. Product Integrity Problems

### 1.1 UI maturity is ahead of backend maturity

Several product areas look complete in the UI while their underlying behavior is incomplete, mocked, or only partially real.

Affected areas:
- recurring obligations
- budgets
- statement import
- health score history/comparison
- Marco tool-backed assistant flows
- some user/profile flows

Why this matters:
- users will trust the product more than the system currently deserves
- in a finance app, misleading completeness is worse than obvious incompleteness

## 2. Architecture Problems

### 2.1 The repo is in an unfinished migration state

The codebase appears to be moving from an older Next.js/Prisma-centric architecture toward Supabase + Go + Connect-RPC, but the migration is not complete.

Symptoms:
- active Go RPC services exist
- generated Connect clients are used in the frontend
- Supabase auth is active
- legacy Prisma-based Marco tooling still exists
- multiple docs still describe obsolete architecture states
- some screens bypass shared hooks and call RPC clients directly

Impact:
- duplicated patterns
- inconsistent data ownership
- higher maintenance cost
- harder onboarding for future contributors

### 2.2 No strict source-of-truth boundary

The intended architecture suggests Go should own finance domain logic, but the current implementation still mixes:
- frontend-only derived logic
- mock RPC responses
- temporary data adapters
- legacy server assumptions

This creates ambiguity about where business rules are supposed to live.

## 3. Backend Problems

## 3.1 Transaction service is incomplete

The frontend supports transaction list, create, edit, and detail patterns, but the backend does not fully implement them.

Problems:
- `GetTransaction` is stubbed
- `UpdateTransaction` is stubbed
- the frontend assumes both are real

References:
- [`backend/api/transaction.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/transaction.go)
- [`src/lib/hooks/use-transactions.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-transactions.ts)

Impact:
- runtime failures
- broken edit flows
- unreliable transaction detail behavior

## 3.2 Recurring service is mostly unimplemented

Recurring obligations are positioned as a core product feature, but most recurring RPCs are empty.

Problems:
- `ListRules` returns empty
- `GetRule` returns empty
- `UpdateRule` returns empty
- `DeleteRule` returns empty
- `ListUpcoming` returns empty
- `SnoozeRule` returns empty
- `CancelRule` returns empty

References:
- [`backend/api/recurring.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/recurring.go)
- [`src/lib/hooks/use-recurring.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-recurring.ts)
- [`src/app/app/obligations/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/obligations/page.tsx)

Impact:
- obligations screen is not backed by real persistence
- cashflow inputs are not dependable
- product claims exceed implementation

## 3.3 Budget service is effectively mock-only

Problems:
- create returns a mock object
- list returns an empty array
- update returns only a partial object
- delete succeeds without demonstrating real backing persistence

References:
- [`backend/api/budget.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/budget.go)
- [`src/lib/hooks/use-budgets.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-budgets.ts)

Impact:
- budget UX is not trustworthy
- future UI work on budgets is blocked by backend immaturity

## 3.4 Import service does not perform real import work

Problems:
- file hash and import batch are created
- no real CSV parsing occurs in the backend
- no transactions are created
- the RPC returns zero parsed/created/matched counts

References:
- [`backend/api/import.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/import.go)
- [`src/components/import/statement-importer.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/components/import/statement-importer.tsx)

Impact:
- import feature is materially misleading
- statement ingestion is not production-grade

## 3.5 User service still uses mock behavior

Problems:
- `GetProfile` relies on request ID instead of authenticated context
- returns mock email and mock name
- `UpdateProfile` is not real
- wealth analytics endpoint is mock/stub oriented

References:
- [`backend/api/user.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/user.go)

Impact:
- weak domain credibility
- incomplete auth-to-user integration
- wrong abstraction around identity ownership

## 3.6 Insights service is partly incorrect and partly mocked

Problems:
- summary math is wrong
- zine data uses fabricated metrics like fixed transaction count and leak values
- health score is fully hardcoded

References:
- [`backend/api/insights.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/insights.go)
- [`backend/query.sql`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/query.sql)

Impact:
- dashboard numbers can be inaccurate
- zine may look insightful while not reflecting true data
- health score currently behaves more like demo content than financial analysis

## 3.7 Error handling is inconsistent

Patterns observed:
- some endpoints return proper Connect errors
- some stubs return empty success responses
- some parsing/scan errors are ignored
- some RPC methods do not validate input rigorously

Impact:
- bad debugging experience
- ambiguous frontend behavior
- hard-to-understand failure modes

## 4. Frontend Problems

## 4.1 Hooks often invent data instead of mapping truthfully

Several hooks fabricate missing fields instead of reflecting actual backend data.

Examples:
- generic placeholder category names in transactions
- fake timestamps in recurring items
- forced recurring type values
- budget spent always set to zero
- history/comparison stubs in health score

References:
- [`src/lib/hooks/use-transactions.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-transactions.ts)
- [`src/lib/hooks/use-recurring.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-recurring.ts)
- [`src/lib/hooks/use-budgets.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-budgets.ts)
- [`src/lib/hooks/use-health-score.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-health-score.ts)

Impact:
- UI can display plausible but false information
- product trust is weakened
- the value of typed contracts is undermined

## 4.2 Shared hook architecture is not consistently used

The app has a hook layer built on TanStack Query, but not all screens use it consistently.

Example:
- goals page directly calls RPC client and manages local state instead of using shared `useGoals` patterns

Reference:
- [`src/app/app/goals/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/goals/page.tsx)

Impact:
- duplicated mapping logic
- inconsistent loading/error states
- weaker cache invalidation

## 4.3 Some screens are feature-complete visually but shallow functionally

Examples:
- settings page sections with descriptive text but limited real controls
- demo mode marketed but disabled
- categories section with no active management flow
- receipt vault section with no complete settings control surface

Reference:
- [`src/app/app/settings/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/settings/page.tsx)

Impact:
- dead-end UX
- product feels staged rather than coherent

## 4.4 Silent failure patterns in chat UX

The Marco page catches several failures and does nothing visible to the user.

Reference:
- [`src/app/app/marco/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/marco/page.tsx)

Impact:
- broken mental model
- invisible failure states
- poor recoverability

## 4.5 Route bundle weights are acceptable but some screens are heavier than they need to be

Observed from production build:
- transactions, receipts, obligations, and zine routes are relatively heavy
- receipts likely pays for OCR-related client bundling

Impact:
- slower interactive load on constrained devices
- less room for future feature additions without route bloat

## 5. Data Correctness Problems

## 5.1 Cashflow projection currently has a severe semantic bug

The cashflow page maps recurring event types as `"EXPENSE"` / `"INCOME"`, but the engine expects `"bill"` / `"income"`.

Because the engine only treats lowercase `"income"` as income, uppercase `"INCOME"` can be misprocessed as an outgoing amount.

References:
- [`src/app/app/cashflow/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/cashflow/page.tsx)
- [`src/lib/engine/cashflow.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/engine/cashflow.ts)

Impact:
- incorrect safe-to-spend value
- incorrect gap-day detection
- incorrect projected balances

This is one of the most important issues in the codebase.

## 5.2 Summary math is not financially reliable

`GetSummary` derives income and balance in a way that does not match clear accounting semantics.

Reference:
- [`backend/api/insights.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/insights.go)

Impact:
- dashboard trust erosion
- forecast inputs become unstable

## 5.3 Zine insight quality is not data-faithful yet

The Zine has strong product potential, but the current backend combines some real totals with fabricated insights.

Impact:
- editorial polish exceeds analytical truth
- users may over-trust narrative output

## 5.4 Health score currently behaves more like demo content

The score, factors, and insights are hardcoded, and history/comparison are stubbed.

Impact:
- score appears authoritative without a real computation pipeline

## 6. UX Problems

## 6.1 The product occasionally over-promises

Examples:
- import promises auto-created transactions but does not deliver them
- settings implies secure local secret storage
- some dashboards and summaries imply live analytics while using placeholders

Impact:
- trust damage
- more harmful in personal finance than in lower-stakes software

## 6.2 Incomplete settings UX

Settings currently mixes:
- real import control
- placeholder integration storage
- explanatory sections with no controls
- disabled developer mode

This creates a fragmented experience.

## 6.3 Error feedback is inconsistent

Patterns:
- some pages show explicit retry states
- some suppress errors
- some log only to console

Impact:
- users cannot distinguish “no data” from “broken data source”

## 6.4 Some metrics are presented without confidence framing

Finance products should indicate when something is:
- projected
- estimated
- incomplete
- based on missing inputs

The cashflow module has some confidence labeling, but this principle is not applied uniformly across the app.

## 7. Security Problems

## 7.1 Local storage is described too optimistically

The settings page says external payment keys are stored “securely” in local storage. That is not a safe claim.

Reference:
- [`src/app/app/settings/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/settings/page.tsx)

Impact:
- inaccurate security messaging
- risky precedent for handling secrets

## 7.2 Auth model is only partly reflected in domain services

The Go auth interceptor is reasonable, but some domain services still rely on request-provided IDs or mock behavior rather than authenticated context.

References:
- [`backend/api/auth.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/auth.go)
- [`backend/api/user.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/api/user.go)

Impact:
- weak security discipline
- confusing identity ownership

## 7.3 Experimental AI path touches high-trust finance context without full hardening

Marco’s tool-calling path is not production-safe yet because its underlying data layer is broken.

References:
- [`src/app/api/marco/chat/route.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/api/marco/chat/route.ts)
- [`src/lib/marco/tools.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/tools.ts)
- [`src/lib/prisma.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/prisma.ts)

Impact:
- unstable AI behavior
- risk of user trust loss

## 8. Performance Problems

## 8.1 OCR is likely bundled too eagerly

The receipts route imports the scanner directly, and the scanner imports `tesseract.js`.

References:
- [`src/app/app/receipts/page.tsx`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/app/app/receipts/page.tsx)
- [`src/lib/ocr/receipt-scanner.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/ocr/receipt-scanner.ts)

Impact:
- heavy client bundle
- unnecessary route cost for users who only browse receipts

## 8.2 The frontend does not fully benefit from typed filtering APIs yet

The transactions hook includes filter parameters in query keys, but does not pass them to the backend list RPC.

Reference:
- [`src/lib/hooks/use-transactions.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks/use-transactions.ts)

Impact:
- overfetching
- client-side filtering burden
- weaker scalability

## 8.3 Too much placeholder work is happening in the UI

When the UI compensates for missing backend fields by inventing data, the result is not only a correctness issue but also an efficiency issue:
- extra adapter logic
- extra re-renders
- duplicated computation

## 8.4 Middleware depends on a live auth fetch

The Supabase middleware calls `supabase.auth.getUser()` per request path match. This may be acceptable, but it is still a latency-sensitive chokepoint and deserves monitoring.

Reference:
- [`src/lib/supabase/middleware.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/supabase/middleware.ts)

## 9. Code Quality Problems

## 9.1 Type safety is bypassed in important places

Patterns:
- `@ts-nocheck`
- widespread `any`
- forced casts instead of schema-trust or proto-trust

References:
- [`src/lib/marco/tools.ts`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/marco/tools.ts)
- hook files under [`src/lib/hooks`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/src/lib/hooks)

Impact:
- real type mismatches slip into production
- weaker confidence in finance-critical transformations

## 9.2 Generated-client architecture is underused

The project has the benefit of protobuf-generated contracts, but many frontend adapters still behave as if the backend were untyped and unstable.

Impact:
- architectural advantage is not fully realized

## 9.3 Console logging is still used for user-affecting failures

Examples:
- import failures
- OCR-related actions
- auth callback issues
- chat streaming issues

Impact:
- poor observability strategy
- user-visible failures do not have structured telemetry

## 10. Testing And Delivery Problems

## 10.1 Backend tests are not currently running cleanly

Observed issue:
- `go test ./...` fails in the current environment before running the merchant normalization test

References:
- [`backend/internal/merchantnorm/merchantnorm_test.go`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/internal/merchantnorm/merchantnorm_test.go)
- [`backend/go.mod`](/Users/ayushchougula/Desktop/Ayush/Projects/Vasoli/backend/go.mod)

Impact:
- low confidence in backend changes
- domain logic is underprotected

## 10.2 Test coverage is too thin for a finance product

There should be robust tests for:
- summary math
- cashflow engine
- recurring expansion
- import parsing
- merchant normalization
- auth interception
- receipt encryption round trips
- zine analytics derivation

Currently, evidence of that depth is not present.

## 10.3 Success signals are misleading if only build/lint pass

Current repo state:
- frontend build passes
- ESLint passes
- that does not mean core product behavior is complete or financially correct

This codebase needs stronger functional verification, not just compilation success.

## 11. Documentation Problems

## 11.1 Internal docs are inconsistent with current implementation

There are multiple architecture and summary docs that still describe older states such as:
- Prisma as active data layer
- NextAuth-era assumptions
- simplified plans not matching the current repo

Impact:
- confusion for future development
- documentation cannot be trusted without re-verification

## 11.2 Product claims should be aligned with implementation maturity

Areas like:
- AI insights
- import automation
- budgeting
- recurring management

need clearer “implemented vs in progress” separation across docs and UI.

## 12. Specific Priority Risks

These are the highest-value fixes:

1. Fix the cashflow type mismatch and summary math.
2. Finish transaction get/update RPCs.
3. Finish recurring rules RPCs end to end.
4. Make statement import actually parse and create transactions.
5. Remove or disable Marco tool-calling until the Prisma dependency is replaced.
6. Stop fabricating frontend data in hooks.
7. Replace mock budget/profile/health score behavior with real domain data or hide the feature.
8. add proper backend and domain tests.

## 13. Recommended Improvement Strategy

### Phase 1: Trust restoration
- fix incorrect financial calculations
- remove or gate features backed by mocks
- align UI claims with actual capability

### Phase 2: Backend completion
- complete transaction, recurring, budget, import, and profile services
- make Go the real source of truth for finance operations

### Phase 3: Frontend normalization
- replace direct RPC page logic with shared hooks
- remove placeholder mappings
- lazy-load heavy OCR logic

### Phase 4: Hardening
- add tests
- add observability
- standardize error handling
- clean outdated docs

## 14. Bottom Line

Vasoli is promising, but right now it behaves like a polished product shell around an uneven core.

The biggest issue is not styling, performance, or framework preference.

The biggest issue is this:

**the app currently presents financial confidence before it has fully earned financial correctness.**

That is the standard the next round of engineering should fix.
