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

### Local Development

For local development, copy the `.env.example` file to `.env` using `cp .env.example .env` (and `cp backend/.env.example backend/.env` for the Go service) and fill in your actual values. The `.gitignore` file is configured to never track `.env` files.
