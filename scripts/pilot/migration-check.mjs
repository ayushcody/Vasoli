import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
const adminURL=process.env.PILOT_ADMIN_DATABASE_URL;
if(!adminURL)throw new Error('Set PILOT_ADMIN_DATABASE_URL to the isolated local admin database.');
const parsed=new URL(adminURL);
if(!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.port!=='55422')throw new Error('Migration checks only run on Vasoli local port 55422.');
const admin=new pg.Client({connectionString:adminURL}); await admin.connect();
const migrations=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync(`supabase/migrations/${f}`,'utf8'));
const baseline=fs.readFileSync('supabase/migrations/20261017000001_canonical_baseline.sql','utf8');
const schema=fs.readFileSync('backend/db/schema.sql','utf8');
const tables=[...schema.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g)];
const id='11111111-1111-4111-8111-111111111111';
const txid='22222222-2222-4222-8222-222222222222';
const stubs=`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb DEFAULT '{}'); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`;
let count=0;
async function fixture(name,prepare,verify,expectFailure=false){
 const dbName=`vasoli_migration_${crypto.randomBytes(5).toString('hex')}`;
 await admin.query(`CREATE DATABASE "${dbName}"`);
 const url=new URL(adminURL);url.pathname=`/${dbName}`;const client=new pg.Client({connectionString:url.toString()});await client.connect();
 try{
  await client.query(stubs);await prepare(client);await client.query('BEGIN');
  let failed=false;try{for(const sql of migrations)await client.query(sql);}catch(err){await client.query('ROLLBACK');if(!expectFailure)throw err;failed=true;}
  if(expectFailure){if(!failed)throw new Error(`${name}: unsafe upgrade unexpectedly succeeded`);await verify(client);}
  else{await client.query('COMMIT');await verify(client);}
  console.log(`PASS ${name}`);count++;
 }finally{await client.end();await admin.query(`DROP DATABASE "${dbName}"`);}
}
async function verifyShape(client){
 for(const table of tables){
  const names=(await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',[table[1]])).rows.map(r=>r.column_name);
  for(const line of table[2].split('\n')){
   const m=line.trim().match(/^("[^"]+"|[a-z_]\w*)\s+/i);if(!m||/^(constraint|unique|primary|foreign|check)$/i.test(m[1]))continue;
   if(!names.includes(m[1].replaceAll('"','')))throw new Error(`${table[1]}.${m[1]} missing from migrated schema`);
  }
 }
}
try{
 await fixture('fresh canonical installation',async()=>{},verifyShape);
 await fixture('existing Go paise upgrade preserves records',async c=>{
  // Use the checked-in canonical snapshot as an existing paise-schema fixture.
  const ddl=baseline.slice(baseline.indexOf('CREATE TABLE'),baseline.indexOf('-- Existing legacy tables'));
  // The generated baseline currently has no section delimiter; execute only CREATE TABLE blocks.
  for(const match of ddl.matchAll(/CREATE TABLE IF NOT EXISTS\s+\w+\s*\([\s\S]*?\n\);/g))await c.query(match[0]);
  await c.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,'migration@vasoli.local']);
  await c.query('INSERT INTO users(id,email) VALUES($1,$2)',[id,'migration@vasoli.local']);
  await c.query(`INSERT INTO transactions(id,user_id,amount_paise,description,merchant_raw,merchant_norm,date,type) VALUES($1,$2,29,'preserved','preserved','preserved','2026-01-01T00:00:00Z','EXPENSE')`,[txid,id]);
 },async c=>{await verifyShape(c);const row=(await c.query('SELECT id,user_id,amount_paise,date FROM transactions WHERE id=$1',[txid])).rows[0];if(row?.amount_paise!=='29'||row.user_id!==id||row.date.toISOString()!=='2026-01-01T00:00:00.000Z')throw new Error('Existing paise record changed');});
 await fixture('legacy rupees upgrade preserves exact paise and IDs',async c=>{
  await c.query(fs.readFileSync('backend/supabase_schema.sql','utf8'));
  await c.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,'migration@vasoli.local']);
  await c.query(`INSERT INTO transactions(id,userid,amount,description,date,type) VALUES($1,$2,0.29,'preserved','2026-01-01T00:00:00Z','EXPENSE')`,[txid,id]);
 },async c=>{await verifyShape(c);const row=(await c.query('SELECT id,user_id,amount_paise,amount,date FROM transactions WHERE id=$1',[txid])).rows[0];if(row?.amount_paise!=='29'||row.user_id!==id||Number(row.amount)!==0.29)throw new Error('Legacy money or ownership changed');});
 await fixture('ambiguous legacy money stops without mutation',async c=>{
  await c.query(fs.readFileSync('backend/supabase_schema.sql','utf8'));await c.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,'migration@vasoli.local']);
  await c.query(`INSERT INTO transactions(id,userid,amount,description,date,type) VALUES($1,$2,1.234,'ambiguous','2026-01-01','EXPENSE')`,[txid,id]);
 },async c=>{const row=(await c.query('SELECT amount FROM transactions WHERE id=$1',[txid])).rows[0];if(row?.amount!==1.234)throw new Error('Ambiguous amount changed');},true);
 console.log(`${count} isolated migration scenarios passed.`);
}finally{await admin.end();}
