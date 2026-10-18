# Final local verification

Verified 18 October 2026 against the production Next.js bundle, Go API and the dedicated local Supabase pilot stack. This is local evidence, not hosted deployment approval or independent security certification.

| Check | Result |
| --- | --- |
| Production build | Passed; 33 routes generated, with application/API routes served dynamically |
| Lint and TypeScript | Passed |
| Frontend unit tests | 10 files / 29 tests passed |
| Backend tests and vet | Passed across all Go packages |
| Protobuf/sqlc generation | Repeat generation hashes stable; generator versions pinned |
| Canonical schema fingerprint | Passed |
| Preserving migration fixtures | All 4 isolated scenarios passed |
| Real authenticated API scenarios | All 9 groups passed against the final running source |
| Production browser suite | All 14 tests passed across Desktop Chrome and Mobile Chrome; final run 12.0 seconds |
| Notification database concurrency | Passed; exclusive claiming and expired claims becoming UNCERTAIN without automatic resend |
| Local SMTP | Test message received by Mailpit; no external message sent |
| Database data restore | 27 public table row digests/counts and auth identity IDs match after restoration into a disposable database |
| Full local recovery | Passed: 65 table digests across 4 schemas; exact owners, ACL grantors, default privileges, 23 role memberships and RLS; restored Auth, private file bytes, REST/RPC isolation and all 9 API groups |
| Deployment configuration guards | All 6 tests passed; placeholder example rejected as intended |
| Working-tree whitespace | Passed |

## What the checks establish

Migration fixtures cover fresh installation, exact preservation of Go paise records, exact legacy rupee conversion with IDs retained, and rejection/rollback of ambiguous money. Tests use disposable databases; no existing database is reset.

The authenticated API groups cover account/category/goal/receipt/rule ownership, direct REST isolation, future-payday and stale-balance rules, account shortages, paid occurrences, scenarios, same-day statement/snapshot handling, rejected rows and exact reconciliation, duplicate inclusion, concurrent commits, injected failure rollback/recovery, existing payment linking/reuse prevention, linked transfers and card payments, refund limits, complete paging/CSV beyond 200 records, formula injection protection, streaming authentication, data export and deletion.

The browser journey provisions real local Supabase identities. It signs in, prepares a profile, creates and confirms an account, records Activity, reviews a reconciled statement with explicit invalid-row consent and legitimate-repeat inclusion, downloads CSV, creates a goal and account-linked bill, configures the payday plan on Cashflow, links the bill to an existing payment without another expense, verifies the forecast change, reviews Today, exports JSON and deletes the account. Both desktop and mobile complete this flow. Authentication bypass is disabled; required authenticated CI runs fail if credentials are missing.

Today was inspected in empty and configured states on desktop/mobile. Mobile action cards were corrected to stack text above controls. Today now shows the position and up to three actions; setup and scenarios live on the existing Cashflow URL. Saved screenshots in `.impeccable/review/today-*.png` show synthetic test accounts, not customer data. The branded landing was checked on desktop/mobile, including calculator keyboard controls and reduced motion; its final review and design direction are recorded in `DESIGN.md` and `.impeccable/surfaces/landing.md`.

## Operational limits

The full local rehearsal restored a repeatable-read database snapshot and separate storage archive into a fresh isolated Supabase stack. It compared 65 table digests across public, auth, storage and migration history, plus exact permission manifests including grantors, default privileges, role attributes, 23 memberships and RLS. Restored password sign-in, byte-identical private-file reads, cross-user file/REST/RPC denial, the preserved 10,029-paise transaction and all nine API groups passed. Source fixtures were removed and verified; the target was removed. A protected backup and result manifest were retained locally under ignored `.pilot-backups/`.

The application currently stores receipt OCR payloads in PostgreSQL, not image blobs. The recovery file was a synthetic private object created specifically to prove file restoration; this does not introduce a Storage upload feature. The quick restore command still excludes permissions and files. A shared environment requires its own protected backup and recovery evidence before an upgrade. No hosted deployment, live AI-provider response, AA connection, payment action, hosted SMTP or independent security audit was performed. CI now includes full recovery and configuration-guard tests but has not been reported as a completed GitHub run.

The build emits non-failing Browserslist/cache warnings. Existing financial records and environment files were preserved. Follow [private-pilot.md](private-pilot.md) for installation, forward-only upgrades and handoff gates, and [pilot-user-guide.md](pilot-user-guide.md) for the user workflow.
