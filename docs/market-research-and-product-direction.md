# Vasoli: market research and purpose-driven product direction

Research date: 17 October 2026. This is a focused review of public product documentation, compared with Vasoli's current source. It is not an exhaustive market census, hands-on competitor benchmark, willingness-to-pay study, or validation of vendor performance claims. Product recommendations below are hypotheses to test.

## Decision

Build Vasoli around **helping salaried people in India cover commitments until payday while progressing toward one personally meaningful goal**.

Start with people managing salary, UPI spending, rent, a few subscriptions, and possibly a credit card. Do not initially optimize for active investors, complex family wealth, small-business bookkeeping, or automated investment advice.

The operating loop should be:

**Bring in data -> verify it -> choose a purpose -> see the next risk -> take an action -> verify the outcome.**

A dashboard, chatbot, or category chart supports that loop. None alone establishes a reason to return.

## What is already available

| Product / reference | Publicly documented capability | Implication for Vasoli |
| --- | --- | --- |
| [Fold](https://fold.money/) | Indian bank aggregation through AA, automatic expense categorization, search, balance and cashflow views. | Aggregation and attractive money dashboards are already established offerings. |
| [Fold MCP](https://fold.money/mcp) | Authorized read-only financial tools for external AI applications; vendor describes it as beta. | Connecting an AI assistant to financial data is already in market. Do not call Marco unique on this basis. |
| [axio](https://www.axio.co.in/faq) | Android money management, SMS-based spend detection, and split/settle capabilities. | Low-effort capture matters. A browser application should not promise parity with device SMS capture. |
| [YNAB targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks) and [Plan Reset](https://www.ynab.com/whats-new/give-your-priorities-a-reset) | User priorities, recurring/custom targets, and reprioritization of available money. | A purpose needs funding and tradeoffs, rather than a goal progress bar alone. |
| [Copilot quick start](https://help.copilot.money/en/articles/11157550-quick-start-guide) | A review queue, learned categorization, name rules, recurring detection, and goal links to balances/transactions; documentation identifies it as US-focused. | Review/correction and automation of repeated work are important reference patterns, not proven India integrations. |
| [Monarch forecasting](https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch) | Forecasting from accounts/history and life events. | What-if forecasts alone are not a novel category. Explain the source, assumptions, and consequences better for the chosen audience. |
| [PocketSmith](https://www.pocketsmith.com/tour/cash-flow-forecasts/) and [forecasting documentation](https://learn.pocketsmith.com/calendar--forecasting/6a6X8SseDAXwf8ZqYunJuU) | Daily forecasts, calendars, scenarios and balance correction concepts. | Reconciliation and timing are necessary foundations for useful forecasts. |
| [Rocket Money](https://www.rocketmoney.com/feature/manage-subscriptions) | Recurring-charge discovery and cancellation assistance. | Concrete completed actions provide a clearer value proposition than another insight chart. Do not assume its cancellation operations work in India. |

These are vendor-published capabilities, not independently verified outcomes. International references inform product design; their banks, payment rails, pricing and operations are not assumed to apply to India.

### Recency matters

Some public marketing pages can remain available after a service relationship changes. For example, [Federal Bank's partnership page](https://www.federal.bank.in/fintech-partnerships) states its Fi partnership ended on 31 March 2026. Consequently, this plan does not treat an older Fi connected-accounts landing page as proof that the former banking setup is currently available. Fold India's `fold.money` is also distinct from the unrelated US Fold bitcoin product.

## What remains in Vasoli

The previous implementation pass repaired specific correctness and build issues. Lint, types, 25 frontend unit tests, Go tests, production build, and 10 public/access-control browser checks passed. Those checks do not demonstrate signed-in financial workflows against a database.

| Remaining work | Why it blocks a useful product | Acceptance criterion |
| --- | --- | --- |
| Ownership of related records | Plain foreign keys do not prove that a related account/category belongs to the caller; liability creation needs owner-scoped checks. | Reject cross-user account/category links and malformed IDs; verify with two authenticated users. |
| Ordered migrations and staging | Mixed schema/migration files do not establish a reproducible installation. | Fresh database migration and upgrade test pass; backup restoration demonstrated. |
| Account-linked ledger | Current transaction RPC messages lack a financial account identifier. Pooled cash can hide a shortage in the account that pays a bill. | Transactions, imports and obligations associate with an account; unsupported legacy rows remain explicitly unassigned. |
| Transfer/refund/card-payment semantics | Moving money between own accounts or paying an already-recorded card purchase must not inflate income/expenses. | Linked transfer pairs and refund relationships reconcile totals; ambiguous matches require confirmation. |
| Import reconciliation and recovery | Bounds and pre-validation are fixed, but the import lifecycle still needs atomicity/recovery and a complete row-level explanation. | Preview and commit agree; opening/closing balances reconcile where present; retries do not duplicate data; every skipped row is explained. |
| Complete ledger search/export | The UI currently loads a bounded set, disclosed as the newest 200 rows. | Filters/search cover the complete ledger; export is complete for its stated scope. |
| Balance provenance and freshness | Recorded liquid balances may be manually entered and stale. | Every forecast displays the balance source/as-of date and unresolved data gaps; reconciliation updates the baseline safely. |
| Realistic variable spending | Current forecast models recorded recurring events, not the whole cost of living. | User can confirm an everyday-spending allowance; history can suggest a baseline with visible assumptions and no fabricated confidence percentage. |
| Connected purpose and allocation model | Goals exist, but protected goal money and planned contributions must influence spending decisions without double counting. | Reserved amounts and real transfers are distinct; a rupee is not assigned to multiple goals; plan remains reversible. |
| Notification reliability | Multiple workers can race without transactional claims. | One logical reminder yields one delivery, with explicit retries/failures. |
| Authenticated test and privacy lifecycle | Current browser coverage is public sign-in/access protection. | Separate-user tests exercise import, correction, forecasting, export and deletion; provider failures and session expiry are tested. |
| Pilot operations | Local success does not prove hosted connectivity or user value. | Staging works over HTTPS; provider configuration is checked; pilot users finish the loop independently. |

## Features to implement, in order

### 1. Import review and a trustworthy ledger — foundation

Ask which account a statement belongs to. Show detected format/period, new rows, duplicates, invalid rows, transfer candidates, and reconciliation status before commit. Preserve original source values. Let a user apply a merchant/category correction to future matches with a preview and undo.

Start with a small set of well-tested CSV formats. Add particular text-PDF statement formats only with real consented fixtures and clear failure handling. Do not promise universal PDF or screenshot understanding.

Relative effort: substantial because the schema, RPC contracts, import parser, ledger and tests must agree. Depends on migration discipline. This is the first engineering priority.

### 2. A payday plan — the main product

Onboarding asks: next expected payday, known commitments, everyday-spending allowance, protected minimum balance, and one current purpose such as an emergency buffer or a planned purchase.

The home screen answers:

- What commitments fall before the next income?
- Which account needs attention, and when?
- How much remains after confirmed commitments, everyday spending and protected money?
- What information is missing or stale?

A pooled total is useful context, but the plan must also show whether the specific paying account can meet a bill. Suggest a manual transfer for review when appropriate; do not move money automatically.

Relative effort: substantial. Depends on account-linked transactions, obligations, balance freshness and correct transfer treatment.

### 3. A weekly action list — turn analysis into behavior

Show at most a few ranked actions. Candidates include a stale balance, unresolved import discrepancy, an upcoming bill shortfall, a subscription price change, or an overdue expected refund.

Each action has evidence, amount/date, relevance to the current purpose, and controls to review, complete, dismiss, or snooze. Distinguish an app suggestion, a user-reported action, and a transaction-verified outcome. Never count projected savings as money already saved.

Relative effort: medium after ledger quality improves. Start with deterministic rules. AI can explain results, not invent or silently execute them.

### 4. Goal tradeoffs and saved scenarios — make the purpose operational

Let users compare a planned purchase, a delayed salary, and a new recurring cost against their actual plan. Show the change to the lowest projected balance and whether the selected purpose remains fundable by its target date. If the goal is infeasible, explain the shortfall rather than invent a completion date.

The current engine supplies useful building blocks; saved scenarios, allocations, account-specific cashflow and reliable everyday-spending inputs remain to be built.

Relative effort: medium to substantial depending on goal funding design. A goal contribution may be a reservation, an internal transfer, or an external outflow: define these separately to prevent double counting.

### 5. Money recovery — a focused extension

Connect receipts to expected refunds, reimbursements and return deadlines. Track expected amount, due date, evidence, status, and optionally a matching credit. A missing credit is a review item, not proof of misconduct.

Provide a copyable follow-up draft or provider instructions. Do not automatically contact anyone or promise cancellation/refund execution. This fits existing receipts/reminders and the Vasoli name, but should follow the main payday loop rather than becoming another broad product.

Relative effort: medium. Depends on refund semantics and transaction matching. Treat value as a pilot hypothesis.

### 6. Marco as an explanation layer

Use computed facts from the same ledger/forecast as the interface. For “Can I buy this?”, show assumptions, relevant dates and goal effects. Offer to open a scenario or correction screen. A numeric recommendation must be reproducible without calling the model.

Give users a clear choice about sharing financial context with the model provider. Scope tools narrowly; explain unavailable data. Avoid stock picks, automatic payments, investment execution, or opaque personalized financial scores as the central promise.

Relative effort: medium for grounding, provenance, cost controls and failure handling; less valuable than ledger corrections if built first.

## Data capture and Account Aggregator feasibility

AA integration is not simply an API key to add to this repository. The [Department of Financial Services](https://www.financialservices.gov.in/account-aggregator-framework) describes FIUs as entities registered with and regulated by a financial sector regulator. [Sahamati's FAQ](https://sahamati.org.in/faq/) explicitly says an unregulated fintech cannot itself be an FIU/FIP.

For Vasoli, the next step is a feasibility workstream: confirm eligibility or an appropriate regulated-entity arrangement, permitted use case, consent responsibilities, contracts, cost, bank/data coverage and deletion obligations with a provider. Do not assume a vendor sandbox or technology-service-provider account grants production access. This report is an engineering/product dependency assessment, not a determination of legal eligibility.

CSV capture can support a small pilot immediately after the foundation is reliable, but ongoing manual maintenance is a retention risk. Measure it. If users value the decisions but abandon importing, lower-effort ingestion becomes an early business priority rather than an optional late embellishment.

## Simplify the experience

Primary destinations: Today, Activity, Plan. Keep account management accessible. Put receipts, monthly review and education behind relevant tasks or a secondary area. Make Marco contextual. Preserve working routes until a navigation change is implemented and verified.

Do not delete useful functionality merely to make the menu smaller. Defer expanded gamification, broad investing/wealth aggregation, more generic learning articles, public AI connectors and a full native app until evidence supports them.

## Delivery sequence and release gates

1. **Reproducible staging and ledger foundation:** enforce ownership of related records first; ordered migrations, account links, complete pagination/export, transfer/refund semantics, transactional or recoverable imports, fixtures.
2. **Working payday loop:** reconcile balances, confirm obligations and spending allowance, choose a purpose, view account-level risk and one actionable next step.
3. **Private pilot:** authenticated E2E, cross-user checks, export/deletion, restore check, notification delivery and configured model behavior. Recruit only through explicitly authorized communication.
4. **Behavior and differentiation:** weekly review, rules learned from confirmed corrections, saved scenarios, then recovery tracking.
5. **Reduce capture friction:** run AA feasibility in parallel with the pilot; prioritize production integration according to eligibility and measured import burden.

No reliable calendar estimate follows from a feature list alone. Sequence and acceptance criteria should control delivery; confirm estimates after the first schema/migration and import slice.

## How to know whether it works

Proposed pilot: 10–15 consenting salaried users for four weekly cycles. This is a proposed test, not evidence of market demand.

Measure import/reconciliation completion, time to first useful plan, unresolved balance differences, weekly review return, useful vs dismissed actions, and transaction-confirmed outcomes. Capture forecast error only against later reconciled balances and record which inputs were missing. Ask whether people would keep using it and what they would pay; do not infer willingness to pay from competitor subscriptions.

The primary success measure should be **people who complete a weekly review and take a useful action**, paired with accurate data and user-reported usefulness. Time in app, chat count and badge streaks are poor substitutes. Report savings only when attributable and verified; separate refunds recovered, spending reduced, and money moved between own accounts.

A direct subscription is a reasonable business-model hypothesis to test. Keep incentives aligned with user outcomes; avoid making lending or product commissions the reason for recommendations. Do not set pricing before validating recurring value and support/ingestion/model costs.

## Immediate next build

**Close relationship-ownership gaps and establish ordered migrations, then build the account-linked ledger and import review flow.** This unlocks truthful account-specific cashflow, reversible goal funding, a useful action list, and credible outcomes. More AI chat or another dashboard should wait behind it.
