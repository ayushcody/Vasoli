import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
const cli=process.env.SUPABASE_CLI || 'supabase';
const status=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if (!/^http:\/\/(127\.0\.0\.1|localhost):55421\/?$/.test(status.API_URL) || !status.DB_URL?.includes(':55422/')) throw new Error('Refusing to configure an unexpected or remote stack.');
const password=randomBytes(24).toString('hex');
const admin=new pg.Client({connectionString:status.DB_URL});
await admin.connect();
try {
  const exists=(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='vasoli_app'")).rowCount;
  if(!exists)throw new Error('Apply pilot migrations before preparing runtime credentials.');
  await admin.query(`ALTER ROLE vasoli_app LOGIN PASSWORD '${password}'`);
} finally {await admin.end();}
const env={
  ENV:'development',BYPASS_AUTH:'false',NEXT_PUBLIC_BYPASS_AUTH:'false',NEXT_PUBLIC_PILOT_INVITE_ONLY:'true',
  NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3001',SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,
  SUPABASE_JWT_SECRET:status.JWT_SECRET,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
  SUPABASE_JWT_ISSUER:`${status.API_URL}/auth/v1`,SUPABASE_JWT_AUDIENCE:'authenticated',
  DATABASE_URL:`postgresql://vasoli_app:${password}@127.0.0.1:55422/postgres`,
  PILOT_ADMIN_DATABASE_URL:status.DB_URL,RPC_BACKEND_URL:'http://127.0.0.1:8080',NEXT_PUBLIC_RPC_BASE_URL:'/rpc',SERVER_ADDR:'127.0.0.1:8080',CORS_ORIGINS:'http://127.0.0.1:3001,http://localhost:3001',
  SMTP_ADDR:'127.0.0.1:55425',SMTP_HOST:'127.0.0.1',SMTP_PORT:'55425',SMTP_FROM:'pilot@vasoli.local',ENABLE_EMAIL_NOTIFICATIONS:'true',MARCO_ENABLED:'false',NEXT_PUBLIC_MARCO_ENABLED:'false',
};
fs.writeFileSync('.env.pilot.local',Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
console.log('Wrote .env.pilot.local with isolated local credentials. No existing environment files were changed.');
