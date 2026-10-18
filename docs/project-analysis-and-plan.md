# Vasoli: project analysis and build plan

Review date: 17 October 2026. This review covers the current working tree, including substantial changes that existed before this review. Findings describe source inspection and local checks, not a production audit or market validation.

## What it does

Vasoli is an India-oriented personal finance web application. Users sign in through Supabase, import bank/UPI CSV statements or enter transactions, categorize spending, set budgets and savings goals, record accounts and debts, manage recurring bills and reminders, and view financial summaries. A receipt vault runs OCR in the browser and encrypts OCR payloads with a passphrase. Marco uses Gemini and authenticated financial tools to answer questions. The Learn section provides calculators; Ledger Zine presents a monthly review.

Next.js handles the interface, authentication integration, and Marco endpoints. A separate Go service exposes Connect RPC APIs backed by PostgreSQL and generated sqlc queries. Supabase hosts authentication and database-facing chat storage. Receipt metadata and OCR ciphertext have different privacy properties; encrypting OCR does not encrypt every field in the application. Marco tool results are sent to the configured model provider.

## Is it practical?

**Yes as a focused, manually maintained financial planning MVP. It is not yet verified as a production-ready banking integration or a complete financial adviser.** The existing architecture can support this product without a rewrite. CSV import avoids waiting for bank integration, but imposes a continuing user-maintenance cost. Success depends on users importing regularly and keeping balances and recurring rules current.

The strongest value proposition is: **Know what needs attention before the next payday.** The practical loop is import -> review/correct -> check upcoming bills and cash shortages -> take one action -> review monthly. Receipts, learning content, achievements, and the editorial digest should support that loop, not compete with it.

Product viability remains an assumption. Test it with a small consenting pilot: observe whether people can import their own statements, reconcile totals, understand the forecast, and return for a weekly review. Do not infer demand from feature count.

## Main findings

| Priority | Finding | Implication / next step |
| --- | --- | --- |
| P0 | Source permitted development authentication bypass in production | Gate bypass/mock responses by environment; add regression coverage. Deploy with an explicit production environment. |
| P0 | Forecast spendability counted later income before earlier bills; simulations kept stale risk fields | Use the lowest projected balance and available cash; recalculate every scenario consistently. |
| P0 | Dashboard described a monthly-surplus heuristic as safe cash | Show monthly net cashflow with a truthful label until reconciled liquid balances and complete obligations drive the calculation. |
| P0 | Startup could continue without a usable database | Fail at startup rather than serve broken requests. |
| P1 | Import parsing and retry lifecycle were unsafe; input lacked bounds | Validate before registering a batch and bound input. Further work: transactional imports and retry-safe recovery. |
| P1 | Transaction list/export only loaded a bounded set | Disclose the subset now; implement server-side filters, pagination, and complete export next. |
| P1 | Go CI version and backend deployment configuration disagreed with code | Align toolchain, configurable binding, and RPC routing; validate staging. |
| P1 | Migration ordering and schema copies are ambiguous | Introduce an ordered migration runner, a clean-database migration test, and a single documented schema authority. |
| P1 | Reminder delivery lacks a transactional claim across worker instances | Add claim/lease state and retry/idempotency handling before scaling workers. |
| P1 | E2E tests can pass on an authentication redirect | Require authenticated workflow assertions and isolated seeded test data. |
| P2 | Settings included unused API-key and disabled demo controls | Remove dead controls. Keep working capabilities accessible. |
| P2 | Documentation asserted universal 100% completion | Replace percentages with observable implementation and validation status. |

## What to keep, simplify, and defer

Keep the existing Next.js + Go + Postgres architecture for this iteration. A rewrite would create risk without fixing the user-facing correctness problems. Retain generated RPC and SQL clients: their volume is not evidence of unnecessary complexity.

Remove duplicate configuration only after checking which file supplies the same configuration. Ignore local build binaries. Remove settings with no working consumer. Preserve original product documents, migrations, existing user edits, and optional features until usage or dependency evidence supports deletion. An apparently unused UI primitive is not sufficient reason for a sweeping dependency purge.

Defer live Account Aggregator/broker integrations, native push, additional gamification, and expanded AI autonomy. Each needs infrastructure or external validation. Keep AI read-only and grounded in recorded data. A provider adapter with placeholder responses is not a live integration.

## Forecast assumptions in this iteration

Forecasts start from recorded INR CASH, SAVINGS, CURRENT, and WALLET account balances. Investments, loan/credit accounts, and other currencies are excluded. Missing accounts produce a setup prompt rather than treating monthly net income as cash. A recorded balance can still be stale or incomplete.

Backend-expanded bill/income occurrences enter the forecast once. Daily balances apply those events and optional goal contributions. Estimated spendable cash is the smaller of current cash and the lowest projected balance, less a buffer: the greater of the low-balance threshold (at least 10% of current cash or the configured minimum reserve) and the minimum reserve plus 10% of modeled bills. Results are floored at zero. These buffer percentages are product heuristics, not a validated financial recommendation. Unrecorded everyday spending is excluded; this is not a guarantee that a purchase is affordable.

## Innovation roadmap

These are product hypotheses, ordered by usefulness and delivery cost.

1. **Explainable cashflow radar.** Show the first projected shortfall date, the obligations that cause it, current balance provenance, and the assumptions behind the number. Purchase/subscription/income-delay simulations should change the same deterministic projection. This iteration fixes the engine; the next adds saved scenarios and reconciliation-aware inputs.
2. **Import trust report.** Before committing an import, report opening/closing balance checks, rejected rows, duplicates, transfer candidates, unknown merchants, and the exact count to be imported. Let users resolve uncertainty instead of silently dropping rows. Reconcile preview and server parsing against shared fixtures.
3. **Weekly action inbox.** Rank a few deterministic actions: an uncategorized large expense, an approaching bill, a possible duplicate subscription, or a stale balance. Show the evidence and let users dismiss/correct it. Use completion feedback instead of arbitrary health-score pressure.
4. **Confidence from data quality.** Base confidence on account coverage, last reconciliation, observed history, and confirmed recurring events. Merely having an income and a bill is coverage, not a probability of forecast accuracy.
5. **Private receipt recovery reminders.** Use known return/warranty dates to suggest a concrete action without sending decrypted receipts to the assistant. Validate how many reminders result in a useful action before investing in more receipt features.

## Sequenced delivery plan

### Phase 1 — Trustworthy local MVP (this iteration)

- Harden production bypass behavior and backend startup.
- Bound and validate imports before batch registration.
- Repair forecast date handling, signed amounts, event ordering, month-end recurrence, and scenario risk recalculation.
- Source forecasts from recorded INR liquid accounts; consume already-expanded backend events once. Show the first projected low-balance day.
- Remove shared demo sign-in credentials and constrain post-login redirects to application paths.
- Replace unsupported dashboard claims and remove dead settings.
- Make bounded transaction export explicit and show meaningful zero-result feedback.
- Align build/deployment configuration and replace unsupported readiness claims.
- Run available lint/type checks, unit tests, backend tests, and production build. Record blockers honestly.

Acceptance: regression checks pass; no simulated scenario returns stale warnings; future salary cannot make currently unavailable money spendable; an invalid CSV does not reserve its import hash; no UI setting asks for an unused payment API key.

### Phase 2 — Reliable private pilot

- Reconcile account balances and transfers; define which accounts count as liquid cash.
- Add server-side ledger search/filter/pagination and complete streamed export.
- Make imports atomic or resumable with explicit failure states and exact decimal money parsing.
- Establish ordered migrations, backups, restore checks, and isolated test fixtures.
- Exercise authenticated sign-in -> import -> reconcile -> forecast -> delete/export flows against staging.
- Verify user isolation, session expiration, storage policies, logging redaction, rate limits, and deletion across all stores.

Acceptance: pilot users can independently import real supported statements, reconcile results, and interpret forecast assumptions. Staging deployment and backup restore are demonstrated, not merely documented.

### Phase 3 — Differentiation

- Ship the import trust report and weekly action inbox.
- Add explainable scenario comparisons and data freshness signals.
- Measure import completion, reconciliation mismatches, weekly review retention, and action usefulness. Use aggregated or consented telemetry; never log statement contents.
- Pilot one external integration only after manual workflow retention supports the investment.

Acceptance: evidence shows users return for a useful decision and understand when the data is incomplete. Set pilot thresholds before collecting results; do not invent outcome metrics.

## Release boundaries

No deployment, provider signup, secret rotation, production database migration, or external-user communication is performed by this local iteration. These require actual infrastructure access and separate validation. Source fixes and passing unit tests cannot establish production readiness on their own.
