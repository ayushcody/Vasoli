# Vasoli private-pilot status

Updated 18 October 2026. The product boundary is recorded in [PRODUCT.md](PRODUCT.md). Code and local evidence do not establish hosted production readiness.

Implemented: ordered preserving migrations; restricted database role and ownership checks; account-linked Activity with full server search/filter/export; reviewed, atomic and idempotent imports; linked transfers/refunds; India payday planning and server scenarios; focused Today actions; balance confirmation; paid bill occurrences and calendar download; account export/deletion; durable notification claims; optional AI configuration; branded GSAP landing with reduced motion.

Local evidence completed during implementation includes four isolated migration scenarios and a 27-table data restore comparison, authenticated two-user API checks, concurrent/failed import recovery, notification worker claims and local Mailpit delivery. The final production build, all 14 desktop/mobile browser cases and all 9 authenticated API scenario groups pass. Exact scope and limitations are recorded in [build verification](docs/build-verification.md).

Shared-environment gates remain: review exact configuration and pending migrations, restore a backup with roles/permissions and managed storage, run acceptance checks against that environment, then invite users. No hosted deployment, paid provider activation, external messages, regulatory approval or independent security certification has been performed.

The full local recovery gate passed on 18 October: 65 table digests across four schemas, exact owners/grants/default privileges/23 role memberships/RLS, restored Auth and private file access, REST/RPC isolation, and all nine authenticated API groups. The source stack was preserved and the isolated recovery target removed. The read-only deployment configuration checker has six passing tests; hosted launch remains gated by the exact environment's evidence and configuration review.

[Private pilot operations](docs/private-pilot.md) contains commands and the forward-only upgrade procedure. Live bank aggregation and financial actions remain outside this release.
