# Production readiness

Production readiness has not been established. Earlier percentage-based completion estimates were unsupported and have been removed.

The current implementation, risks, delivery sequence, and acceptance criteria are maintained in [project analysis and plan](project-analysis-and-plan.md). Local check results are recorded in [build verification](build-verification.md). Deployment configuration is described in [deployment](deployment.md).

Release gates:

- Apply ordered migrations to a fresh staging database and verify backup restoration.
- Pass authenticated import/reconcile/forecast and export/deletion workflows against staging; an auth redirect does not count as a successful app test.
- Verify cross-user isolation, authentication enforcement, session expiry, sensitive-data logging, storage access, and API limits.
- Reconcile account balances and transfers and disclose forecast assumptions.
- Verify notification delivery/idempotency and model-provider configuration, limits, and data sharing.
- Confirm the public frontend can reach the backend over the configured authenticated RPC route.

Local compilation and unit tests support these gates but do not replace them.
