const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);

export const supabaseURL = process.env.E2E_SUPABASE_URL ?? process.env.SUPABASE_URL;
export const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
export const appURL = process.env.E2E_APP_URL ?? 'http://127.0.0.1:3001';

function assertLocalURL(value: string, label: string, port: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a local URL.`); }
  if (parsed.protocol !== 'http:' || !loopbackHosts.has(parsed.hostname) || parsed.port !== port) {
    throw new Error(`${label} must target the local ${port} service.`);
  }
}

const appPort = new URL(appURL).port || '3000';
if (!['3000', '3001'].includes(appPort)) throw new Error('E2E_APP_URL must use the local development port.');
assertLocalURL(appURL, 'E2E_APP_URL', appPort);
if (supabaseURL) assertLocalURL(supabaseURL, 'E2E Supabase URL', '55421');

if (process.env.E2E_REQUIRE_AUTH === 'true' && (!supabaseURL || !anonKey || !serviceRoleKey)) {
  throw new Error('Authenticated E2E is required, but local Supabase credentials are missing.');
}
