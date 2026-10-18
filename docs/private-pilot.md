# Private pilot operations

Vasoli targets salaried people in India who want a trustworthy view of their money until payday. See `PRODUCT.md` for the release boundary. No hosted deployment or external email delivery is required for this pilot.

## Local installation

Requirements: Node 22.12+, Go 1.25, Docker with daemon access, and Supabase CLI 2.121.0. Run from the repository root. Existing `.env` files are preserved.

1. Install dependencies with `npm ci`.
2. Start the dedicated local stack with `supabase start`. Its API is on 55421, PostgreSQL on 55422 and Mailpit on 55424. Keep the printed local keys private.
3. Apply pending migrations with `supabase migration up --local`. Never use a database reset on an existing database.
4. Run `node scripts/pilot/local-env.mjs`. It creates an ignored, private `.env.pilot.local` containing local keys and a restricted `vasoli_app` database credential. To use a separately installed CLI, set `SUPABASE_CLI` to its executable path.
5. Run `node --env-file=.env.pilot.local scripts/pilot/dev.mjs`. Open http://127.0.0.1:3001. The API listens on 8080. Port 3001 avoids colliding with another project's default server; `PILOT_WEB_PORT` can override it when corresponding origins and test configuration are updated.

Public signup is disabled. Provision invited local test identities through Supabase's admin API; email/password authentication remains enabled. Mailpit captures local messages at http://127.0.0.1:55424. The test suites provision and remove their own identities. Never expose the service-role key to browser code.

## Verification commands

```sh
npm run check
node scripts/pilot/build-baseline.mjs --check
node --env-file=.env.pilot.local scripts/pilot/migration-check.mjs
node --env-file=.env.pilot.local scripts/pilot/api-check.mjs
E2E_APP_URL=http://127.0.0.1:3001 node --env-file=.env.pilot.local node_modules/@playwright/test/cli.js test
node --env-file=.env.pilot.local scripts/pilot/restore-check.mjs
```

Migration and restore scripts only accept the dedicated local port and create disposable databases. Migration fixtures cover fresh installation, Go paise records, legacy rupee records and rejection of ambiguous amounts. They do not certify an arbitrary production database. Authenticated API/browser tests require the real local stack; skipped tests are not successful verification.

## Existing database upgrades

The only ordered upgrade path is `supabase/migrations`. Older SQL under `backend/migrations` and alternate schema files are historical inputs, not an additional migration sequence. `backend/db/schema.sql` is the sqlc schema snapshot. Its baseline fingerprint is checked by `build-baseline.mjs --check`.

Before any shared-environment upgrade:

1. Run the read-only preflight: `PREFLIGHT_DATABASE_URL=… node scripts/pilot/preflight.mjs`, supplying the credential privately. Save its schema classification, counts and monetary checks. Unknown schemas and ambiguous conversions require manual resolution before proceeding.
2. Capture a protected PostgreSQL backup including application and auth schemas, role/grant definitions, migration history and a separate copy of managed storage files. Record versions and backup checksums. Keep credentials out of command history and logs.
3. Restore into an isolated environment. Compare record IDs, ownership, counts, exact integer monetary totals and timestamps, then restore permissions and test authentication, RLS, attachment access and deletion. Stop if any comparison fails.
4. Review pending migration SQL and configuration. Apply forward-only migrations using a dedicated migration credential. Run the Go service as `vasoli_app`; never use the database administrator for normal requests.
5. Run the same isolation and workflow checks before inviting users. Retain the verified backup. A failed upgrade is investigated and repaired forward; never erase records to make the schema fit.

The quick `pilot:restore:check` rehearsal verifies public table row digests and auth identity IDs after restoring a data/schema archive into a disposable database. It deliberately does not restore role privileges or storage objects. Its success is evidence of database data restoration, not a complete operational disaster-recovery rehearsal. Full permission/storage restoration remains a shared-environment release gate.

`npm run pilot:restore:full` is the expanded local rehearsal. It requires the pinned Supabase CLI on `PATH` (or `SUPABASE_CLI`), Docker access, the existing local pilot stack and its API on port 8080, and free recovery ports 55520–55525 and 8181. It creates synthetic identities, a financial record and a private storage object; backs up the four application/auth/storage/migration schemas plus file contents; and restores them into a separate temporary Supabase project. It must compare row digests, ownership, ACL grantors, role memberships and RLS before testing restored sign-in, private-file access and API workflows. A failed comparison is a failed rehearsal, even if the archive itself restores.

The expanded rehearsal retains sensitive backups under ignored `.pilot-backups/` with restricted directory/file permissions. These contain financial data, Auth records and file contents: do not upload them as CI artifacts or commit them. Protect or encrypt any copy before transfer, set a retention policy, and remove it only when the recovery evidence and required backup retention permit. The tool is scoped to the dedicated local stacks; a shared environment still needs its own protected backup and verified recovery.

## Runtime and privacy

Use `/healthz` for process liveness and `/readyz` for database readiness. Configure issuer, audience and public signing keys for Supabase; a legacy HS256 secret must be explicitly configured. Keep authentication bypass disabled. Restrict origins to the actual frontend origin. Enable Marco only with a supported configured model; its absence must not block the pilot.

Notification delivery uses durable claims. Disabled delivery stays disabled; uncertain SMTP outcomes and expired worker claims require review rather than blind retries. Configure only local SMTP during development. Hosted SMTP activation and external messages need separate authorization.

Operational logs must not include statements, tokens, receipt plaintext or chat content. Downloaded exports contain private financial data and must be handled accordingly. Account deletion exposes progress and retryable failures, including attachment and Supabase identity removal.

## Invite-only handoff

Before sharing a hosted pilot, review the exact migration/preflight/restore evidence, signing configuration, restricted credentials, storage permissions and invitation process. Demonstrate real sign-in, account assignment, import review, reconciliation, payday plan, CSV export and deletion on desktop and mobile. Record unresolved failures explicitly. This project makes no claim of regulatory approval, independent security certification or a percentage improvement in credibility.

The [launch checklist](pilot-launch-checklist.md) includes a read-only configuration checker. Keep the filled JSON input private because it can contain a database URL. Its output contains check codes and pass/fail states, not configuration values. Passing this checker does not establish that the hosted configuration has actually been applied.

For the user workflow, see [pilot-user-guide.md](pilot-user-guide.md). After building with the local environment (`node --env-file=.env.pilot.local node_modules/next/dist/bin/next build`), `npm run pilot:start` serves the production bundle and API on the same pilot ports. Stop an existing runner before starting another.
