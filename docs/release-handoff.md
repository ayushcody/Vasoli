# Private-pilot handoff

The approved release is the salaried-India private pilot described in `PRODUCT.md`, not an unrestricted production launch. Installation, forward-only upgrades, backup boundaries and verification commands are in [private-pilot.md](private-pilot.md).

Credibility comes from reproducible migrations, exact monetary preservation, real authenticated ownership checks, recoverable imports and demonstrated workflows. Previous percentage completion estimates are withdrawn; they were not measured evidence.

The pilot excludes live bank aggregation, payments, brokerage connections, paid billing, native apps and automatic financial actions. Account Aggregator eligibility/provider work remains documentation only. Marco is optional.

Do not deploy a shared environment until its backup has been restored with permissions and storage, its invitation/auth configuration has been reviewed, and the authenticated acceptance checks have passed against that exact environment. Local test success is not a hosted-deployment approval or independent audit.

Use the [pilot launch checklist](pilot-launch-checklist.md) to record that decision. Run `npm run pilot:ops:test` for the configuration guard tests, then `npm run pilot:deployment:check -- /private/path/deployment.json` against a privately stored configuration based on `scripts/pilot/deployment.example.json`. The example intentionally fails until its placeholders are replaced. This read-only check validates supplied declarations and URL syntax; it does not inspect a hosted service or prove database privileges.
