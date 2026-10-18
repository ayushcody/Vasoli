# External Integration Architecture

Vasoli is designed to support a robust, privacy-first integration layer, specifically tailored for the India-first Account Aggregator (AA) ecosystem, Brokerages, UPI apps, and Tax planning platforms.

Currently, **no live integrations are implemented**, but the architectural foundation is laid out here.

## 1. Provider Abstraction

We will introduce a universal `ProviderConnection` abstraction that normalizes external financial data across diverse sources.
- **ACCOUNT_AGGREGATOR**: (e.g., Onemoney, Finvu) - for banking statements, balances, and FDs.
- **BROKER**: (e.g., Zerodha, Upstox, Groww) - for equity, mutual funds, and demat holdings.
- **UPI**: Parsing automated SMS or email reports (future), or direct app integrations if supported.
- **TAX**: Exporting and importing Form 26AS or ITR payloads.

The backend will implement a standard interface (e.g., `FetchTransactions`, `FetchBalances`) for all providers, delegating specific API logic to individual provider clients.

## 2. Consent Model

For India's Account Aggregator framework, consent is critical.
- Every external connection must map to an explicit, cryptographically signed consent artifact.
- Vasoli will record the `consent_id` alongside the `provider_connection`.
- Users must explicitly grant read-only access with defined expiry dates.

## 3. Token Storage Strategy

**Raw credentials and tokens must NEVER be stored in the primary SQL database in plaintext.**
- A dedicated, hardened secrets vault (e.g., AWS KMS + encrypted DB columns, or HashiCorp Vault) will store `access_tokens` and `refresh_tokens`.
- The `provider_connections` table only stores the provider metadata, link status (`ACTIVE`, `REVOKED`, `EXPIRED`), and user relationship.

## 4. Sync Jobs and Data Freshness

- Sync jobs will be managed by a robust background job queue (e.g., River for Go, or robust cron).
- Syncs will be idempotent. They will merge external transactions into Vasoli's `transactions` table using a robust matching heuristic to avoid duplicates with manual entries or statement imports.
- `last_synced_at` will be updated upon successful data fetching.

## 5. Failure Handling

- Webhooks from providers indicating token expiration or revocation will mark the connection `EXPIRED` or `REVOKED`.
- Rate-limiting will trigger exponential backoff.
- The UI will prompt users to "Reconnect" if a sync persistently fails due to auth errors.

## 6. User Revocation

Users can revoke a provider connection directly from Vasoli:
1. The backend immediately fires a revocation request to the upstream Account Aggregator or Provider.
2. Encrypted tokens are hard-deleted.
3. The `provider_connections` row is marked `REVOKED`.
4. Optionally, users can request purging of all transactions synced from that provider (Data Minimization).

## 7. Compliance Notes
- **Read-Only**: Vasoli will never request write access to financial accounts.
- **Data Minimization**: We only pull data required for budgeting and analytics.
- **Audit Trail**: Consent grants, revocations, and sync errors are logged in an immutable audit table.
