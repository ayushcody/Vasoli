# Vasoli deployment plan

This plan takes the approved invite-only salaried-India pilot from the verified local build to a small hosted staging environment, then to a tightly scoped pilot. It does not authorize paid service activation, public signup, external email, or invitations. The pilot remains manual-import only: no live SBI/UPI feed, Account Aggregator, payment initiation, brokerage, or automatic money movement.

## Target shape

- **Vercel project:** one Vercel Services project with `app` (Next.js, rooted at the repository) and `backend` (Go container, rooted at `backend`). Services are currently a Vercel beta feature; confirm availability for the target account before relying on this topology.
- **Public routing:** `/rpc/*` routes to the Go backend; all other paths route to Next.js. This keeps Next.js `/api/*` routes on the app service. The backend's `/lifecycle/*`, `/healthz` and `/readyz` paths are not exposed by these rewrites.
- **Internal calls:** the app declares a service binding to `backend` as `VASOLI_BACKEND_URL`. Server route handlers use it for lifecycle operations and Marco's server-side RPC tools. The browser calls the same-origin `/rpc` path. The backend container listens on port `80`, Vercel's default; do not manually define `VASOLI_BACKEND_URL`.
- **Reminder delivery:** set `DISABLE_NOTIFICATION_WORKER=true` for the Vercel backend. Its request-driven container can scale down while idle, so an in-process polling loop cannot guarantee delivery. Keep email/push delivery disabled until a durable scheduled worker is deployed separately.
- **Data and sign-in:** Supabase PostgreSQL, Auth and private Storage in a region selected for latency and the pilot's data-handling requirements. Use a dedicated, restricted `vasoli_app` database role for normal API requests and a separate migration credential for schema changes.
- **Email and AI:** disabled for the pilot. Enable neither until separately reviewed and configured.
- **Access:** invite-only, HTTPS, one frontend origin, no public registration. Start with a few named testers and synthetic or deliberately selected data.

The Vercel project configuration is in [`vercel.json`](../vercel.json), and the backend container recipe is [`backend/Dockerfile.vercel`](../backend/Dockerfile.vercel). Supabase remains separately provisioned. Before deployment, confirm Vercel Services access, container runtime limits, backup/restore, region, support, and total cost. The repository does not establish a budget or an approved paid plan.

## Ordered rollout

### 0. Confirm the Vercel service topology and environment

Set the Vercel project's framework to **Services**, then confirm service names (`app`, `backend`), public routes (`/rpc/*` to backend and the catch-all to app), and the app-to-backend binding (`VASOLI_BACKEND_URL`). Record the Supabase project/region, domain, cost ceiling, operational owner, invite list, and who can access production secrets. Keep separate local, staging, and pilot environments; never point a deployment at the local database. Do not copy a real user's statement into staging just to test the deployment.

**Gate:** the owner accepts the selected providers, data location, cost, and access model. Until then, prepare the plan but do not create paid services or publish a live endpoint.

### 1. Prepare an isolated staging environment

Create a fresh Supabase project for staging with public signup disabled. Configure both Vercel services in one project and a unique staging domain. Set exact origins in configuration, `ENV=production`, `DISABLE_NOTIFICATION_WORKER=true`, invite-only mode, and both auth-bypass flags set to `false`. Configure the Supabase issuer, `authenticated` audience, JWKS URL and only supported signing algorithms. Keep the service-role key, database URLs and migration credential in server-side secret stores; the anon key is the only Supabase key exposed to browser code.

Build and deploy both services from the same reviewed commit. The service binding supplies `VASOLI_BACKEND_URL`; do not set it manually. Keep the local-only `RPC_BACKEND_URL` rewrite fallback out of hosted configuration. Confirm `/healthz` and `/readyz` through the available service health mechanism and verify that public `/rpc` requests reach the API while Next.js `/api/*` routes still reach the app. Do not expose the database publicly beyond the app/migration connections required by the selected host.

**Gate:** deployment preflight passes using a private config file; secrets are absent from browser bundles, source control, screenshots and logs; both services report healthy.

### 2. Apply schema and prove recovery

For a new staging database, apply only ordered `supabase/migrations`. For any non-empty or previously used database, first run the read-only schema preflight and classify it. Stop on an unknown schema or ambiguous money conversion. Before migrating shared data, take a protected backup covering application and Auth data, migration history, roles/grants and private Storage objects. Establish encryption and retention for backup copies before transfer; the existing local rehearsal uses restricted file permissions but does not prove encryption.

Restore the backup into an isolated target and compare IDs, owners, row counts, exact money totals, timestamps, privileges, RLS and storage access. The current successful full recovery is local evidence only; repeat it for the chosen hosted environment. Apply changes forward only. Keep a tested rollback decision: restore only before accepting new writes, otherwise repair forward without discarding records.

**Gate:** the target backup has been restored and checked, migration results are recorded, and the restricted API role has been inspected against actual grants (the config preflight's role flag is only an operator assertion).

### 3. Run authenticated staging acceptance

Against the deployed staging URLs, run schema/baseline checks, migration checks, authenticated API checks, and desktop/mobile browser journeys using genuine staging identities. Verify sign-in and session expiry; two-user isolation; account assignment; statement preview/commit/retry; reconciliation; search and complete CSV export; payday planning; bill payment linking; deletion and retry; private file access; log redaction; and `/readyz` after a database interruption. Check that transfers and historical statement rows do not double-count balances. Confirm invite-only access from a non-invited account.

Keep notifications and Marco disabled. Confirm the app handles both as unavailable without blocking core finance flows. Record failures with steps to reproduce; do not treat a successful build, a redirect to sign-in, or local-only tests as a hosted acceptance pass.

**Gate:** all blocking checks pass on the exact candidate commit and staging configuration; remaining limitations have an owner and a user-facing explanation.

### 4. Open the private pilot carefully

Promote the reviewed build/configuration to the pilot environment, or use the accepted staging environment as the pilot only if its data, access, backup, and recovery boundaries were explicitly approved. Recheck migration status, recovery evidence, secrets, domains, auth restrictions and health checks. Invite a small, named cohort manually. Begin with the synthetic walkthrough; allow real statement imports only after users understand what is uploaded, what Vasoli stores, and how to delete/export data.

Monitor service health, errors, database capacity, backup completion and restore readiness. Operational telemetry must exclude statement content, tokens, receipt plaintext and chat content. Establish an on-call contact and a clear way to pause invitations or disable the app if data isolation or financial totals are in doubt. Do not claim independent security certification, regulatory approval, or demonstrated financial outcomes.

**Gate:** pilot owner signs the release record and approves the exact invite list and any real-data use.

### 5. Operate and learn

Review only necessary operational metrics and user feedback. Track whether people complete the import/reconciliation/payday journey, where they need help, and what assumptions they misunderstand. Separate usability observations from financial correctness and security evidence. Fix blocking issues, run the affected checks again, and document each release. Consider live Account Aggregator or UPI connectivity later as a separate eligibility, partner, consent, security, and compliance project.

## Release sequence and rollback

Deploy the API and web app from a single tagged commit after staging acceptance. For an application-only failure, roll back the web/API artifacts to the last known-good versions while preserving data. For a schema failure, pause writes/invitations and follow the rehearsed restore or forward-repair decision; do not run destructive resets or assume a down migration is safe. Verify sign-in, `/readyz`, a read-only authenticated activity request, and log redaction after recovery before reopening access.

## Configuration and evidence

Start from [`scripts/pilot/deployment.example.json`](../scripts/pilot/deployment.example.json), keep the filled copy outside the repository with restricted access, and run:

```sh
npm run pilot:deployment:check -- /private/path/deployment.json
npm run pilot:ops:test
```

The checker validates declarations and URL syntax without connecting to the services; a pass is not proof of hosted state. Keep a release record with the commit, migration result, backup/restore evidence, acceptance results, unresolved risks, operator, and launch decision. The detailed security and data gates are in [`pilot-launch-checklist.md`](pilot-launch-checklist.md), and the local setup/trial instructions are in [`private-pilot.md`](private-pilot.md) and [`pilot-trial.md`](pilot-trial.md).

## Current status

Local build, authenticated flows and a full local recovery rehearsal have been verified. Hosted environment provisioning, hosted migration/recovery, hosted authenticated acceptance, provider selection and pilot invitations remain undone. No live hosting configuration or paid service has been activated by this plan.
