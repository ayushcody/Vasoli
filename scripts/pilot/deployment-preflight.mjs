#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Keep this aligned with backend/api/auth.go validateJWT's fixed allowlist.
const SUPPORTED_JWT_ALGORITHMS = new Set(['HS256', 'RS256', 'ES256']);
const PLACEHOLDER = /<[^>]+>|\b(?:replace[-_ ]?me|change[-_ ]?me|your[_ -]?[a-z0-9_-]+|placeholder|todo)\b/i;

function push(checks, code, ok) {
  checks.push({ code, status: ok ? 'PASS' : 'FAIL' });
}

function hasPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER.test(value);
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(hasPlaceholder);
  return false;
}

function parseURL(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try { return new URL(value); } catch { return null; }
}

function canonicalOrigin(value) {
  const parsed = parseURL(value);
  if (!parsed || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
  return parsed.origin;
}

function databaseURLInfo(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return null;
    return {
      role: decodeURIComponent(parsed.username),
      sslMode: parsed.searchParams.get('sslmode') || '',
    };
  } catch { return null; }
}

/** Return only code/status values; configuration values and URL credentials never leave memory. */
export function inspectDeploymentConfig(config) {
  const checks = [];
  const hosted = config?.mode === 'hosted';
  push(checks, 'MODE_HOSTED', hosted);
  if (!hosted) {
    return { schemaVersion: 1, result: 'FAIL', checks };
  }

  push(checks, 'NO_PLACEHOLDERS', !hasPlaceholder(config));
  const env = config.env || {};
  const frontend = canonicalOrigin(env.NEXT_PUBLIC_SITE_URL);
  const backend = canonicalOrigin(env.RPC_BACKEND_URL);
  const supabase = canonicalOrigin(env.SUPABASE_URL);
  const publicSupabase = canonicalOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  push(checks, 'HTTPS_ORIGINS', Boolean(
    frontend?.startsWith('https://') && backend?.startsWith('https://') &&
    supabase?.startsWith('https://') && publicSupabase?.startsWith('https://')
  ));
  push(checks, 'SUPABASE_URL_MATCH', Boolean(supabase && publicSupabase === supabase));
  push(checks, 'INVITE_ONLY', env.NEXT_PUBLIC_PILOT_INVITE_ONLY === 'true' && env.SUPABASE_SIGNUP_ENABLED === false);
  push(checks, 'AUTH_BYPASS_DISABLED', env.BYPASS_AUTH === 'false' && env.NEXT_PUBLIC_BYPASS_AUTH === 'false');
  push(checks, 'PRODUCTION_MODE', env.ENV === 'production');
  push(checks, 'CORS_EXACT_FRONTEND', Boolean(frontend && env.CORS_ORIGINS === frontend));

  const issuer = parseURL(env.SUPABASE_JWT_ISSUER);
  const expectedIssuer = supabase ? `${supabase}/auth/v1` : '';
  const audienceOK = env.SUPABASE_JWT_AUDIENCE === 'authenticated';
  const jwks = parseURL(env.SUPABASE_JWKS_URL);
  const expectedJWKS = supabase ? `${supabase}/auth/v1/.well-known/jwks.json` : '';
  const algorithms = config.jwtAlgorithms;
  const algorithmsOK = Array.isArray(algorithms) && algorithms.length > 0 &&
    algorithms.every((algorithm) => SUPPORTED_JWT_ALGORITHMS.has(algorithm));
  const signatureConfigOK = algorithmsOK &&
    (algorithms.includes('HS256') ? env.SUPABASE_JWT_SECRET_CONFIGURED === true : true) &&
    (algorithms.some((algorithm) => algorithm === 'RS256' || algorithm === 'ES256')
      ? Boolean(jwks && jwks.protocol === 'https:' && env.SUPABASE_JWKS_URL === expectedJWKS)
      : true);
  push(checks, 'JWT_ISSUER_AUDIENCE', Boolean(
    issuer && issuer.protocol === 'https:' && env.SUPABASE_JWT_ISSUER === expectedIssuer && audienceOK
  ));
  push(checks, 'JWT_ALGORITHMS_SUPPORTED', algorithmsOK && signatureConfigOK);

  const database = databaseURLInfo(env.DATABASE_URL);
  push(checks, 'DATABASE_ROLE_RESTRICTED', Boolean(database && database.role === 'vasoli_app' && env.DATABASE_ROLE_RESTRICTED === true));
  push(checks, 'DATABASE_TLS', Boolean(database && ['require', 'verify-ca', 'verify-full'].includes(database.sslMode)));

  const marcoEnabled = env.MARCO_ENABLED === 'true';
  const publicMarcoEnabled = env.NEXT_PUBLIC_MARCO_ENABLED === 'true';
  const model = typeof env.GEMINI_API_MODEL === 'string' ? env.GEMINI_API_MODEL.trim() : '';
  const modelExplicit = /^gemini-[a-zA-Z0-9.-]+$/.test(model);
  push(checks, 'OPTIONAL_AI_CONFIG', marcoEnabled === publicMarcoEnabled && (
    !marcoEnabled || (modelExplicit && env.GEMINI_API_KEY_CONFIGURED === true)
  ));
  push(checks, 'EMAIL_DISABLED', env.ENABLE_EMAIL_NOTIFICATIONS === 'false' && env.SMTP_CONFIGURED === false);
  push(checks, 'NO_EXTERNAL_EMAIL', env.EXTERNAL_EMAIL_ENABLED === false);
  push(checks, 'NO_PAID_ACTIVATION', env.PAID_FEATURES_ENABLED === false);

  return { schemaVersion: 1, result: checks.every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL', checks };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, result: 'FAIL', checks: [{ code: 'INPUT_FILE_REQUIRED', status: 'FAIL' }] }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  let report;
  try {
    const raw = await readFile(resolve(args[0]), 'utf8');
    report = inspectDeploymentConfig(JSON.parse(raw));
  } catch {
    report = { schemaVersion: 1, result: 'FAIL', checks: [{ code: 'INPUT_INVALID', status: 'FAIL' }] };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.result !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
