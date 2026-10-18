# Private pilot launch checklist

This checklist prepares a hosted, invite-only Vasoli pilot. A passing configuration preflight checks the supplied declarations and URL syntax; it does not connect to a provider, inspect database grants, prove backup recovery, or activate a service.

## Before launch

- [ ] Provision a fresh staging environment and apply only the ordered `supabase/migrations` set. Reconcile any existing database before release; do not run historical SQL files sequentially.
- [ ] Capture an encrypted backup of application and auth data, migration history, roles/grants, and managed storage objects. Restore it in isolation and verify identities, ownership, row counts, money totals, permissions, and storage access.
- [ ] Create a dedicated PostgreSQL role named `vasoli_app` for the service. Inspect its grants against the full migration schema and verify that it cannot create roles, databases, or extensions, or access unrelated schemas. The preflight file's `DATABASE_ROLE_RESTRICTED` value is an operator assertion, not proof of the grants.
- [ ] Set `ENV=production`, disable `BYPASS_AUTH` and `NEXT_PUBLIC_BYPASS_AUTH`, enable invite-only signup, and disable public Supabase signup.
- [ ] Configure a unique HTTPS frontend origin, HTTPS backend origin, and HTTPS Supabase project origin. Set `CORS_ORIGINS` to the one exact frontend origin. Set `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE=authenticated`, and the configured JWKS URL. Use only algorithms accepted by `backend/api/auth.go`; use HS256 only when the explicit server-only secret is configured.
- [ ] Keep service-role keys, database URLs, SMTP credentials, and AI keys in the hosting provider's secret store. Never add them to browser variables, JSON preflight reports, screenshots, or logs.
- [ ] Keep Marco disabled unless the team explicitly chooses an available Gemini model, configures its key server-side, confirms generation support, and reviews the data-sharing impact. Core money workflows must work without Marco.
- [ ] Keep `ENABLE_EMAIL_NOTIFICATIONS=false`, leave SMTP unconfigured, and do not enable paid features or external email delivery as part of this pilot.
- [ ] Run the read-only check against a private, reviewed configuration file: `node scripts/pilot/deployment-preflight.mjs /path/to/deployment.json`. The command prints check codes and pass/fail states only. A failing result blocks launch.
- [ ] Run schema baseline, migration, authenticated API, restore, Go, and frontend checks against staging. Run real authenticated desktop and mobile journeys; do not count an unauthenticated redirect as a product pass.
- [ ] Review `/healthz` and `/readyz`, log redaction, rate limits, session expiry, cross-user ownership, export, deletion retries, and notification behavior. Confirm no credentials, statements, receipt text, or AI conversations appear in operational logs.
- [ ] Record remaining release gates, on-call ownership, recovery steps, provider contacts, and the invite list. Share invitations only after the gates above pass.

## Configuration input

Start from [`scripts/pilot/deployment.example.json`](../scripts/pilot/deployment.example.json). It contains angle-bracket placeholders by design and must fail until replaced with reviewed values. The JSON file includes a database URL, so store it with restricted permissions and never check in the filled file. The checker does not open network connections or change any provider, database, payment, or email state.

## Launch decision

- [ ] All blocking checklist items have evidence attached to the release record.
- [ ] Every open limitation has an owner and a user-facing response.
- [ ] The pilot owner has approved the exact hosted configuration and invite scope.
