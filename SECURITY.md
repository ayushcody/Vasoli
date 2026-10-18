# Security Policy

## Supported Versions

Currently, the `main` and `mvp-secrets` branches are supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within Vasoli, please send an e-mail to the maintainers. All security vulnerabilities will be promptly addressed.

## Secrets Management

**CRITICAL: Never commit secrets to this repository.**

This includes, but is not limited to:
- `SUPABASE_JWT_SECRET`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY`
- `GMAIL_APP_PASSWORD`
- Any Google Pay API keys or certificates

### What to do if a secret is leaked

1. **Rotate Immediately**: If a secret like `SUPABASE_JWT_SECRET` or a database password is leaked, rotate it immediately in the respective provider's dashboard (e.g., Supabase dashboard).
2. **Scrub Git History**: If the secret was committed, it must be removed from the Git history using tools like `git filter-repo` or BFG Repo-Cleaner. Simply adding it to `.gitignore` or deleting it in a new commit is NOT sufficient, as it remains in the history.
3. **Notify Users**: If the compromised secret affects user data, notify affected users in accordance with applicable data privacy laws.

### Environment Variable Rotation Runbook
- **Supabase JWT Secret**: Go to Project Settings -> API -> JWT Settings -> Generate new secret. This logs out all active users. Update `SUPABASE_JWT_SECRET` in your backend host (e.g. Fly.io).
- **Supabase Service Key**: Go to Project Settings -> API -> Service Role Key -> Reveal/Roll. Update `SUPABASE_SERVICE_ROLE_KEY` in the backend.
- **Gemini API Key**: Go to Google AI Studio -> API Keys -> Delete old key, Create new key. Update `GEMINI_API_KEY` in the backend.
- **Gmail App Password**: Go to Google Account -> Security -> 2-Step Verification -> App Passwords. Delete old password, generate a new one. Update `GMAIL_APP_PASSWORD` in the backend.

### Local Development

For local development, copy the `.env.example` file to `.env` using `cp .env.example .env` (and `cp backend/.env.example backend/.env` for the Go service) and fill in your actual values. The `.gitignore` file is configured to never track `.env` files.

## Data Map & Storage Policy

Vasoli handles different types of financial data with different levels of encryption based on utility vs privacy.

### Plain-text Stored Data
The following data must be readable by the backend to perform cashflow projections and budgeting logic:
- Transactions (amounts, dates, normalized merchant names)
- Financial accounts (balances, names)
- Recurring rules
- Application settings and user preferences

### Receipt Vault
Receipt scanning runs in the browser. The current receipt flow saves extracted OCR JSON and receipt metadata in PostgreSQL; it does not retain the selected image bytes or create Supabase Storage objects.
- When a vault passphrase is set, the OCR payload is encrypted in the browser using AES-GCM before saving. Without a passphrase, the OCR JSON is stored unencrypted despite the historical `ocr_payload_encrypted` field name.
- The user's passphrase is run through PBKDF2 locally to derive the encryption key.
- **The passphrase and key material NEVER leave the browser.**
- Encrypted payloads use the `vault:v1:...` format. Receipt metadata such as merchant, amount and dates remains readable by the service.

## Compliance Readiness Roadmap

Vasoli is tracking toward the following compliance frameworks:

### GDPR & "Right to Erasure"
- Settings provides authenticated JSON export and retryable account deletion covering application records, chat records and the Supabase identity. These workflows have local authenticated test coverage; this does not establish legal compliance.
- The application currently manages no Storage blobs. Objects created outside Vasoli must be removed through the Storage API before their owning Auth identity can be deleted; a failed identity removal remains visible and retryable.

### Indian DPDP Act (Digital Personal Data Protection)
- **TODO**: Document data fiduciary boundaries explicitly for Indian users, ensuring consent logging is captured formally during sign-up for bank-statement processing.
- The current implementation (scrubbing emails in logs, isolating user IDs in PostgreSQL `WHERE` clauses) establishes the baseline for DPDP compliance.

## Threat Model
1. **Compromised User Session**: An attacker gaining access to a user's JWT can only access that specific user's data due to strict RLS and backend user ID isolation.
2. **Database Compromise**: Passphrase-encrypted OCR payloads remain ciphertext in a database dump. Unencrypted OCR payloads and receipt metadata are readable; database backups require restricted access.
3. **Cross-Site Scripting (XSS)**: Mitigated by React's default escaping, strict CSP headers (`frame-ancestors 'none'`), and HTTP-only cookies managed by Supabase SSR.
4. **Data Exfiltration via Logs**: Application logs mask email addresses and never log raw OCR text, JWTs, or passwords.

## RLS Verification Checklist
Ensure the following are verified before any major production release:
- [x] User cannot read another user's transactions.
- [x] User cannot read another user's receipts.
- [x] User cannot read another user's reminders.
- [x] User cannot read another user's goals.
- [x] User cannot read another user's budgets.

## Suspicious Access & Failed Logins
Authentication and session anomalies (like bruteforcing or suspicious login locations) are delegated to Supabase Auth's managed infrastructure. Ensure Supabase's native rate limits and anomaly detection toggles remain enabled in your cloud provider dashboard.

## Incident Reporting
If you identify a security or privacy incident:
1. Revoke the suspected compromised keys immediately.
2. Contact the maintainers directly via email.
3. Await acknowledgment before disclosing the vulnerability publicly.
