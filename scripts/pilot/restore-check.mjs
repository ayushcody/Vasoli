import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
const url = process.env.PILOT_ADMIN_DATABASE_URL;
if (!url) throw new Error('Set the isolated PILOT_ADMIN_DATABASE_URL.');
const parsed = new URL(url);
if (!['localhost','127.0.0.1'].includes(parsed.hostname) || parsed.port !== '55422') throw new Error('Restore rehearsal only runs against the isolated pilot stack.');
const container = 'supabase_db_vasoli-pilot';
const dbName = `vasoli_restore_${crypto.randomBytes(5).toString('hex')}`;
const directory = fs.mkdtempSync(path.join(os.tmpdir(),'vasoli-restore-'));
const archive = path.join(directory,'pilot.dump');
const admin = new pg.Client({connectionString:url}); await admin.connect();
let created = false;
try {
  // Schema-qualified dumps include auth identities and application data; object storage files need a separate backup.
  const dump = execFileSync('docker',['exec',container,'pg_dump','-U','postgres','-d','postgres','--format=custom','--no-owner','--schema=public','--schema=auth'],{maxBuffer:256*1024*1024,stdio:['ignore','pipe','pipe']});
  fs.writeFileSync(archive,dump,{mode:0o600});
  await admin.query(`CREATE DATABASE "${dbName}"`); created=true;
  const restoredURL = new URL(url); restoredURL.pathname=`/${dbName}`;
  const restored = new pg.Client({connectionString:restoredURL.toString()}); await restored.connect();
  try {
    // This connection targets only the brand-new randomized rehearsal database.
    await restored.query('DROP SCHEMA public CASCADE');
    execFileSync('docker',['exec','-i',container,'pg_restore','-U','postgres','-d',dbName,'--no-owner','--no-privileges','--exit-on-error'],{input:dump,maxBuffer:1024*1024,stdio:['pipe','pipe','pipe']});
    const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
    for (const table of tables) {
      if(!/^[a-z_]+$/.test(table))throw new Error('Unexpected table identifier.');
      const sql=`SELECT count(*)::text AS count,COALESCE(md5(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text)),'empty') AS digest FROM public."${table}" t`;
      const before=(await admin.query(sql)).rows[0]; const after=(await restored.query(sql)).rows[0];
      if(JSON.stringify(before)!==JSON.stringify(after))throw new Error(`Restore verification failed for ${table}.`);
    }
    const authBefore=(await admin.query('SELECT id::text FROM auth.users ORDER BY id')).rows;
    const authAfter=(await restored.query('SELECT id::text FROM auth.users ORDER BY id')).rows;
    if(JSON.stringify(authBefore)!==JSON.stringify(authAfter))throw new Error('Restored auth identity IDs differ.');
    console.log(`PASS data restore rehearsal: ${tables.length} public tables and auth identities match. Reapply role grants before operational use; storage file contents are not included.`);
  } finally { await restored.end(); }
} catch(error) {
  console.error('Restore rehearsal failed:',error instanceof Error ? error.message.split('\n')[0] : 'unknown error');
  if(error?.stderr)console.error(String(error.stderr).slice(0,1600));
  process.exitCode=1;
} finally {
  if(created)await admin.query(`DROP DATABASE "${dbName}"`);
  await admin.end(); fs.rmSync(directory,{recursive:true,force:true});
}
