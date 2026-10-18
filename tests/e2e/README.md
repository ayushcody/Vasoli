# End-to-end coverage

The suite covers the public sign-in screen, unauthenticated protected-route redirects, and an authenticated local journey when local Supabase E2E credentials are provided. The authenticated test provisions a confirmed throwaway user through the local Supabase Admin API, signs in through the Vasoli UI, bootstraps its profile through the authenticated RPC endpoint, creates a transaction in the UI, then removes the test user. It does not claim authenticated receipt or obligations workflow coverage.

Set `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, and `E2E_SUPABASE_SERVICE_ROLE_KEY` from an isolated local Supabase instance to enable the authenticated test. The test is skipped when those values are absent. Never point it at a production project; the service-role key can create and delete auth users.

Playwright starts the app with `NEXT_PUBLIC_BYPASS_AUTH=false` so protected-route checks exercise the middleware even when a local `.env` enables the bypass for development.
