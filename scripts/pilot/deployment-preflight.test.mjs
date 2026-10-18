import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDeploymentConfig } from './deployment-preflight.mjs';

function safeConfig() {
  const project = 'pilot-project.supabase.co';
  return {
    mode: 'hosted',
    jwtAlgorithms: ['RS256', 'ES256'],
    env: {
      ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://app.vasoli.invalid',
      RPC_BACKEND_URL: 'https://api.vasoli.invalid',
      SUPABASE_URL: `https://${project}`,
      NEXT_PUBLIC_SUPABASE_URL: `https://${project}`,
      NEXT_PUBLIC_PILOT_INVITE_ONLY: 'true',
      SUPABASE_SIGNUP_ENABLED: false,
      BYPASS_AUTH: 'false',
      NEXT_PUBLIC_BYPASS_AUTH: 'false',
      CORS_ORIGINS: 'https://app.vasoli.invalid',
      SUPABASE_JWT_ISSUER: `https://${project}/auth/v1`,
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: `https://${project}/auth/v1/.well-known/jwks.json`,
      SUPABASE_JWT_SECRET_CONFIGURED: false,
      DATABASE_URL: 'postgresql://vasoli_app:never-print-this@db.vasoli.invalid:5432/app?sslmode=require',
      DATABASE_ROLE_RESTRICTED: true,
      MARCO_ENABLED: 'false',
      NEXT_PUBLIC_MARCO_ENABLED: 'false',
      GEMINI_API_MODEL: '',
      GEMINI_API_KEY_CONFIGURED: false,
      ENABLE_EMAIL_NOTIFICATIONS: 'false',
      SMTP_CONFIGURED: false,
      EXTERNAL_EMAIL_ENABLED: false,
      PAID_FEATURES_ENABLED: false,
    },
  };
}

function checkStatus(report, code) {
  return report.checks.find((check) => check.code === code)?.status;
}

test('accepts a hosted config with invite-only auth, public-key JWTs, restricted app role, and disabled optional services', () => {
  const report = inspectDeploymentConfig(safeConfig());
  assert.equal(report.result, 'PASS');
  assert.ok(report.checks.every((check) => check.status === 'PASS'));
});

test('rejects origin drift, auth bypass, signup, and broad CORS together', () => {
  const config = safeConfig();
  config.env.BYPASS_AUTH = 'true';
  config.env.SUPABASE_SIGNUP_ENABLED = true;
  config.env.CORS_ORIGINS = 'https://app.vasoli.invalid,https://other.vasoli.invalid';
  config.env.RPC_BACKEND_URL = 'http://api.vasoli.invalid';
  const report = inspectDeploymentConfig(config);
  assert.equal(report.result, 'FAIL');
  assert.equal(checkStatus(report, 'AUTH_BYPASS_DISABLED'), 'FAIL');
  assert.equal(checkStatus(report, 'INVITE_ONLY'), 'FAIL');
  assert.equal(checkStatus(report, 'CORS_EXACT_FRONTEND'), 'FAIL');
  assert.equal(checkStatus(report, 'HTTPS_ORIGINS'), 'FAIL');
});

test('refuses weak auth metadata, an unrestricted database identity, and enabled outbound services', () => {
  const config = safeConfig();
  config.jwtAlgorithms = ['none'];
  config.env.SUPABASE_JWT_AUDIENCE = 'service_role';
  config.env.DATABASE_URL = 'postgresql://postgres:never-print-this@db.vasoli.invalid:5432/app';
  config.env.DATABASE_ROLE_RESTRICTED = false;
  config.env.ENABLE_EMAIL_NOTIFICATIONS = 'true';
  config.env.SMTP_CONFIGURED = true;
  config.env.EXTERNAL_EMAIL_ENABLED = true;
  config.env.PAID_FEATURES_ENABLED = true;
  const report = inspectDeploymentConfig(config);
  assert.equal(report.result, 'FAIL');
  assert.equal(checkStatus(report, 'JWT_ALGORITHMS_SUPPORTED'), 'FAIL');
  assert.equal(checkStatus(report, 'JWT_ISSUER_AUDIENCE'), 'FAIL');
  assert.equal(checkStatus(report, 'DATABASE_ROLE_RESTRICTED'), 'FAIL');
  assert.equal(checkStatus(report, 'EMAIL_DISABLED'), 'FAIL');
  assert.equal(checkStatus(report, 'NO_EXTERNAL_EMAIL'), 'FAIL');
  assert.equal(checkStatus(report, 'NO_PAID_ACTIVATION'), 'FAIL');
});

test('requires an explicit model and key when optional AI is enabled', () => {
  const config = safeConfig();
  config.env.MARCO_ENABLED = 'true';
  config.env.NEXT_PUBLIC_MARCO_ENABLED = 'true';
  config.env.GEMINI_API_MODEL = '';
  config.env.GEMINI_API_KEY_CONFIGURED = false;
  assert.equal(checkStatus(inspectDeploymentConfig(config), 'OPTIONAL_AI_CONFIG'), 'FAIL');
  config.env.GEMINI_API_MODEL = 'gemini-configured-model';
  config.env.GEMINI_API_KEY_CONFIGURED = true;
  assert.equal(checkStatus(inspectDeploymentConfig(config), 'OPTIONAL_AI_CONFIG'), 'PASS');
});

test('rejects placeholders and never includes database passwords or URLs in the report', () => {
  const config = safeConfig();
  config.env.NEXT_PUBLIC_SITE_URL = 'https://<frontend-host>';
  config.env.DATABASE_URL = 'postgresql://vasoli_app:secret-do-not-print@private-host.invalid/app?sslmode=require';
  const report = inspectDeploymentConfig(config);
  const serialized = JSON.stringify(report);
  assert.equal(checkStatus(report, 'NO_PLACEHOLDERS'), 'FAIL');
  assert.equal(serialized.includes('secret-do-not-print'), false);
  assert.equal(serialized.includes('private-host.invalid'), false);
  assert.equal(serialized.includes('frontend-host'), false);
});

test('requires a database TLS mode for hosted database access', () => {
  const config = safeConfig();
  config.env.DATABASE_URL = 'postgresql://vasoli_app:secret@db.vasoli.invalid:5432/app';
  assert.equal(checkStatus(inspectDeploymentConfig(config), 'DATABASE_TLS'), 'FAIL');
});
