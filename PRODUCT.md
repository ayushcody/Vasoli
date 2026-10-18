# Vasoli

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Salaried people in India managing salary, UPI spending, rent, bills and a savings goal. The first release is an invite-only private pilot, using free/local services.

## Product Purpose
Help users cover commitments until payday while making progress toward one meaningful goal. The primary journey is sign in, assign records to accounts, import and reconcile, confirm commitments and everyday spending, choose a goal, review the payday plan, and complete a useful action.

## Capabilities and Constraints
Keep Next.js, Go, Connect RPC, PostgreSQL and Supabase Auth. Preserve financial records, original transaction identifiers, ownership and amounts. Unassigned historical records stay visible as Unassigned. Calculations use integer paise and India calendar dates. Live bank aggregation, payments, brokerage integration, billing, native apps and automatic financial actions are outside this release.

AI is optional and explains deterministic calculations; it never supplies invented balances, moves money, or blocks the core financial workflow. No paid service activation or external communication is authorized by implementation.

## Product Principles
- Reconcile inputs before suggesting a financial action.
- Show balance source, freshness, missing data and assumptions.
- Protect commitments and explicitly reserved money without double counting.
- Prefer a few evidence-backed actions over more charts or generic advice.
- Report completed and verified outcomes separately from estimates.

## Operating Context
Existing incumbent interface and URLs remain the visual and navigation authority. Refine the dashboard into Today, Transactions into Activity, and use existing planning routes for payday setup. Preserve working supporting features. Default timezone is Asia/Kolkata; the pilot currency is INR.

## Evidence on Hand
Existing local checks have passed, but authenticated pilot workflows, fresh/upgrade migrations and restore rehearsal require new verification. No regulatory approval, independent security certification, market outcomes, customer claims or trust percentage is established.

## Accessibility & Inclusion
Support desktop and mobile web, keyboard operation, labeled controls, clear errors and loading/empty states. Financial copy must explain uncertainty in plain language without guilt or unsupported confidence claims.
