import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { capturePermissions, permissionsSQL } from './permissions.mjs';

const { Client } = pg;
const ROOT = process.cwd();
const CLI = process.env.SUPABASE_CLI || 'supabase';
const SOURCE_API = 'http://127.0.0.1:55421';
const SOURCE_DB_PORT = '55422';
const TARGET_API = 'http://127.0.0.1:55521';
const TARGET_DB_PORT = '55522';
const BACKUP_ROOT = path.join(ROOT, '.pilot-backups');
const SCHEMAS = ['public', 'auth', 'storage', 'supabase_migrations'];
const runSync = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.error || result.status !== 0) throw new Error(`Recovery check failed during ${options.stage || path.basename(command)}.`);
  return result.stdout;
};
const cli = (args, workdir = ROOT) => runSync(CLI, [...args, '--workdir', workdir], { cwd: ROOT, stage: `Supabase ${args[0]}` });
const sqlIdent = (value) => `"${String(value).replaceAll('"', '""')}"`;
const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const escapeConn = (value) => encodeURIComponent(value);

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function writeProtected(file, contents) {
  await fs.writeFile(file, contents, { mode: 0o600, flag: 'wx' });
  await fs.chmod(file, 0o600);
}

async function waitPort(port, timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const connected = await new Promise((resolve) => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(port) });
      socket.setTimeout(350);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Recovery check timed out waiting for local port ${port}.`);
}

async function databaseStatus(workdir) {
  const status = JSON.parse(cli(['status', '-o', 'json'], workdir));
  if (status.API_URL !== TARGET_API || !status.DB_URL) throw new Error('Recovery target did not bind to its expected local endpoints.');
  return status;
}

async function databaseClient(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000, statement_timeout: 120_000 });
  await client.connect();
  return client;
}

async function schemaDigest(client) {
  const tables = (await client.query(`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p')
    ORDER BY n.nspname,c.relname`, [SCHEMAS])).rows;
  const digests = [];
  for (const { schema, name } of tables) {
    const result = await client.query(`SELECT count(*)::text AS rows, md5(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text),'')) AS digest FROM ${sqlIdent(schema)}.${sqlIdent(name)} t`);
    digests.push({ schema, name, rows: result.rows[0].rows, digest: result.rows[0].digest });
  }
  return digests;
}

async function authRequest(base, key, route, body, bearer = key, method = 'POST') {
  const response = await fetch(`${base}/auth/v1/${route}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    ...(body == null ? {} : { body: JSON.stringify(body) }),
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* empty response */ }
  if (!response.ok) throw new Error(`Local fixture Auth request failed (${response.status}).`);
  return payload;
}

async function createFixtureUser(base, serviceKey, anonKey, users) {
  const email = `restore-${crypto.randomUUID()}@vasoli.local`;
  const password = crypto.randomBytes(24).toString('hex');
  const created = await authRequest(base, serviceKey, 'admin/users', { email, password, email_confirm: true });
  const userId = created.user?.id ?? created.id;
  if (!userId) throw new Error('Local Auth did not return a fixture identity.');
  users.push({ id: userId, email, password });
  const session = await authRequest(base, anonKey, 'token?grant_type=password', { email, password }, anonKey);
  if (session.user?.id !== userId || !session.access_token) throw new Error('Local Auth fixture sign-in did not preserve its identity.');
  return { ...users.at(-1), token: session.access_token };
}

async function signInFixture(base, anonKey, fixture) {
  const session = await authRequest(base, anonKey, 'token?grant_type=password', { email: fixture.email, password: fixture.password }, anonKey);
  if (session.user?.id !== fixture.id || !session.access_token) throw new Error('Restored Auth sign-in did not preserve the fixture identity.');
  return { ...fixture, token: session.access_token };
}

async function storageRequest(base, key, token, route, options = {}) {
  const response = await fetch(`${base}/storage/v1/${route}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  return response;
}

async function rpc(base, user, service, method, body = {}, expectedStatus = 200) {
  const response = await fetch(`${base}/rpc/vasoli.v1.${service}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1' },
    body: JSON.stringify(body),
  });
  let result = {};
  try { result = await response.json(); } catch { /* empty response */ }
  if (response.status !== expectedStatus) throw new Error(`Local financial fixture RPC ${service}.${method} returned an unexpected status.`);
  return result;
}

async function dockerNames() {
  return runSync('docker', ['ps', '-a', '--format', '{{.Names}}'], { stage: 'Docker inventory' }).trim().split('\n').filter(Boolean);
}

async function copyDirectoryIntoContainer(container, sourcePath, destination) {
  runSync('docker', ['cp', `${sourcePath}/.`, `${container}:${destination}`], { stage: 'storage restore' });
}

async function dumpDatabase(sourceDB, filePath, snapshotId) {
  const output = await fs.open(filePath, 'wx', 0o600);
  const child = spawn('docker', ['exec', sourceDB, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshotId}`, ...SCHEMAS.flatMap((schema) => ['--schema', schema])], { stdio: ['ignore', 'pipe', 'ignore'] });
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error('Database backup failed.')));
  });
  try {
    for await (const chunk of child.stdout) await output.write(chunk);
    await finished;
  } finally {
    await output.close();
  }
  await fs.chmod(filePath, 0o600);
}

async function restoreDatabase(targetDB, dumpPath, diagnosticPath) {
  const diagnostic = await fs.open(diagnosticPath, 'wx', 0o600);
  const stderr = diagnostic.createWriteStream();
  const child = spawn('docker', ['exec', '-i', targetDB, 'pg_restore', '-U', 'supabase_admin', '-d', 'postgres', '--exit-on-error', '--no-owner', '--no-privileges'], { stdio: ['pipe', 'ignore', 'pipe'] });
  child.stderr.pipe(stderr);
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error('Database restore failed.')));
  });
  const input = await fs.open(dumpPath, 'r');
  const stream = input.createReadStream();
  stream.pipe(child.stdin);
  try { await finished; } finally { await Promise.all([input.close(), diagnostic.close()]); }
}

async function waitProcess(child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error('Recovery API server exited before becoming ready.');
    try {
      await waitPort(8181, 700);
      return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 350)); }
  }
  throw new Error('Recovery API server did not become ready.');
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitHttpHealthy(url, label, headers = {}) {
  let lastStatus = 'unavailable';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(1500) });
      lastStatus = String(response.status);
      if (response.ok) return;
    } catch { /* keep polling the known local health route */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} health check failed (HTTP ${lastStatus}).`);
}

const sourceUsers = [];
const targetUsers = [];
let sourcePolicy = '';
let sourceBucket = '';
let sourceObjectPath = '';
let targetPolicy = '';
let targetBucket = '';
let targetObjectPath = '';
let targetWorkdir = '';
let targetStarted = false;
let succeeded = false;
let sourceAdmin;
let targetAdmin;
let apiProcess;
let recoveryPassword;
let sourceService;
let sourceAnon;
let targetStatus;
let phase = 'preflight';
let sourceFixtureTransaction;
let targetTempBase = '';
let bundlePath = '';
let verificationLines = [];
let apiCheckLines = [];
let cleanupDiagnostics = [];
let restoredOwner;
let restoredOther;

try {
  const sourceURL = process.env.SUPABASE_URL;
  if (sourceURL !== SOURCE_API) throw new Error('Load the local pilot environment for the expected source stack.');
  const sourceAdminURL = new URL(process.env.PILOT_ADMIN_DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost'].includes(sourceAdminURL.hostname) || sourceAdminURL.port !== SOURCE_DB_PORT || sourceAdminURL.pathname !== '/postgres') {
    throw new Error('The source admin database URL must point to the local pilot stack.');
  }
  sourceService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  sourceAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sourceService || !sourceAnon) throw new Error('Local Supabase Auth keys are missing from the pilot environment.');
  const recoveryStatus = JSON.parse(cli(['status', '-o', 'json'], ROOT));
  if (recoveryStatus.API_URL !== SOURCE_API || !recoveryStatus.DB_URL) throw new Error('The source CLI status does not match the protected source stack.');
  sourceAdminURL.username = 'supabase_admin';
  sourceAdmin = await databaseClient(sourceAdminURL.toString());

  const backupId = `restore-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '')}-${crypto.randomBytes(4).toString('hex')}`;
  const bundle = path.join(BACKUP_ROOT, backupId);
  bundlePath = bundle;
  await fs.mkdir(BACKUP_ROOT, { recursive: true, mode: 0o700 });
  await fs.chmod(BACKUP_ROOT, 0o700);
  await fs.mkdir(bundle, { mode: 0o700 });
  await fs.chmod(bundle, 0o700);

  const fixtureTag = crypto.randomBytes(6).toString('hex');
  sourceBucket = `restore-${fixtureTag}`;
  sourceObjectPath = `fixture/${fixtureTag}.bin`;
  sourcePolicy = `restore_owner_${fixtureTag}`;
  const owner = await createFixtureUser(SOURCE_API, sourceService, sourceAnon, sourceUsers);
  const other = await createFixtureUser(SOURCE_API, sourceService, sourceAnon, sourceUsers);
  phase = 'source financial fixture';
  if (!await isPortOpen(8080)) throw new Error('The authenticated source API is not running on local port 8080.');
  await rpc('http://127.0.0.1:8080', owner, 'UserService', 'GetProfile');
  const sourceAccount = (await rpc('http://127.0.0.1:8080', owner, 'AccountService', 'CreateAccount', {
    accountType: 'SAVINGS', institutionName: 'Local recovery fixture', accountName: `Recovery ${fixtureTag}`, balancePaise: '100000', currency: 'INR',
  })).account;
  const transactionDate = new Date().toISOString();
  const sourceTransaction = (await rpc('http://127.0.0.1:8080', owner, 'TransactionService', 'CreateTransaction', {
    accountId: sourceAccount.id, amountPaise: '10029', description: `Recovery fixture ${fixtureTag}`, date: transactionDate, type: 'EXPENSE',
  })).transaction;
  if (!sourceTransaction?.id || sourceTransaction.amountPaise !== '10029') throw new Error('The local financial recovery fixture was not created as expected.');
  const bucketResponse = await fetch(`${SOURCE_API}/storage/v1/bucket`, {
    method: 'POST', headers: { apikey: sourceService, Authorization: `Bearer ${sourceService}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sourceBucket, name: sourceBucket, public: false, file_size_limit: 1024 }),
  });
  if (!bucketResponse.ok) throw new Error(`Could not create isolated local storage fixture (${bucketResponse.status}).`);
  await sourceAdmin.query(`CREATE POLICY ${sqlIdent(sourcePolicy)} ON storage.objects FOR ALL TO authenticated USING (bucket_id = ${sqlLiteral(sourceBucket)} AND owner_id = auth.uid()::text) WITH CHECK (bucket_id = ${sqlLiteral(sourceBucket)} AND owner_id = auth.uid()::text)`);
  const fixtureBytes = crypto.randomBytes(37);
  const upload = await storageRequest(SOURCE_API, sourceAnon, owner.token, `object/${sourceBucket}/${sourceObjectPath}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' }, body: fixtureBytes,
  });
  if (!upload.ok) throw new Error(`Could not upload the owned local storage fixture (${upload.status}).`);
  const deniedSource = await storageRequest(SOURCE_API, sourceAnon, other.token, `object/${sourceBucket}/${sourceObjectPath}`);
  assert.ok([400, 401, 403, 404].includes(deniedSource.status), 'Source fixture must deny cross-user access before backup.');

  phase = 'source snapshot and backup';
  await sourceAdmin.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  sourceFixtureTransaction = true;
  const snapshotId = (await sourceAdmin.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const sourcePermissions = await capturePermissions(sourceAdmin, SCHEMAS);
  const sourceDigests = await schemaDigest(sourceAdmin);
  const sourceAuthIds = (await sourceAdmin.query('SELECT id::text FROM auth.users ORDER BY id')).rows.map((row) => row.id);
  const fixtureTable = sourceDigests.find((table) => table.schema === 'public' && table.name === 'transactions');
  if (!fixtureTable || fixtureTable.rows === '0') throw new Error('Source financial records are absent from the retained snapshot.');
  const sourceDB = 'supabase_db_vasoli-pilot';
  const sourceStorageContainer = 'supabase_storage_vasoli-pilot';
  const databaseDump = path.join(bundle, 'database.dump');
  const storageArchive = path.join(bundle, 'storage-volume.tar.gz');
  await dumpDatabase(sourceDB, databaseDump, snapshotId);
  const storageDirectory = path.join(bundle, '.storage-work');
  await fs.mkdir(storageDirectory, { mode: 0o700 });
  runSync('docker', ['cp', `${sourceStorageContainer}:/mnt`, storageDirectory], { stage: 'storage backup' });
  const storageData = path.join(storageDirectory, 'mnt');
  runSync('tar', ['-czf', storageArchive, '-C', storageData, '.'], { stage: 'storage archive' });
  await fs.chmod(storageArchive, 0o600);
  await fs.rm(storageDirectory, { recursive: true, force: true });

  const checksums = {};
  for (const file of [databaseDump, storageArchive]) checksums[path.basename(file)] = await hashFile(file);
  await writeProtected(path.join(bundle, 'permissions.json'), `${JSON.stringify(sourcePermissions, null, 2)}\n`);
  await writeProtected(path.join(bundle, 'manifest.json'), `${JSON.stringify({
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source: { apiPort: 55421, databasePort: 55422 },
    schemas: SCHEMAS,
    tableDigests: sourceDigests,
    authUserIdCount: sourceAuthIds.length,
    permissionCounts: { roles: sourcePermissions.roles.length, relations: sourcePermissions.relations.length, policies: sourcePermissions.rls.reduce((sum, table) => sum + table.policies.length, 0) },
    storageFixture: { bucket: sourceBucket, ownerId: owner.id, objectPath: sourceObjectPath, sha256: crypto.createHash('sha256').update(fixtureBytes).digest('hex') },
    financialFixture: { userId: owner.id, accountId: sourceAccount.id, transactionId: sourceTransaction.id, amountPaise: '10029' },
    checksums,
  }, null, 2)}\n`);

  await sourceAdmin.query('COMMIT');
  sourceFixtureTransaction = false;
  const postSnapshotDigests = await schemaDigest(sourceAdmin);
  if (JSON.stringify(postSnapshotDigests) !== JSON.stringify(sourceDigests)) throw new Error('Source tables changed while the recovery snapshot was being archived.');

  targetTempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'vasoli-recovery-'));
  await fs.chmod(targetTempBase, 0o700);
  targetWorkdir = path.join(targetTempBase, 'project');
  const supabaseDir = path.join(targetWorkdir, 'supabase');
  await fs.mkdir(path.join(supabaseDir, 'migrations'), { recursive: true, mode: 0o700 });
  let config = await fs.readFile(path.join(ROOT, 'supabase/config.toml'), 'utf8');
  config = config.replace('project_id = "vasoli-pilot"', `project_id = "vasoli-recovery-${fixtureTag}"`)
    .replace(/^port = 55421$/m, 'port = 55521')
    .replace(/^port = 55422$/m, 'port = 55522')
    .replace(/^shadow_port = 55420$/m, 'shadow_port = 55520')
    .replace(/^port = 55423$/m, 'port = 55523')
    .replace(/^port = 55424$/m, 'port = 55524')
    .replace(/^smtp_port = 55425$/m, 'smtp_port = 55525');
  if (!config.includes('project_id = "vasoli-recovery-')) throw new Error('Could not construct an isolated target config.');
  await writeProtected(path.join(supabaseDir, 'config.toml'), config);
  // A blank local project is enough: the retained dump replaces the four application schemas.
  targetStarted = true;
  phase = 'start isolated Supabase target';
  cli(['start'], targetWorkdir);
  targetStatus = await databaseStatus(targetWorkdir);
  await waitPort(TARGET_DB_PORT);
  const targetAdminURL = new URL(targetStatus.DB_URL);
  targetAdminURL.username = 'supabase_admin';
  targetAdmin = await databaseClient(targetAdminURL.toString());

  const targetNames = await dockerNames();
  const targetProject = `vasoli-recovery-${fixtureTag}`;
  const targetDB = `supabase_db_${targetProject}`;
  const targetAuthContainer = `supabase_auth_${targetProject}`;
  const targetRestContainer = `supabase_rest_${targetProject}`;
  const targetStorageContainer = `supabase_storage_${targetProject}`;
  if (!targetNames.includes(targetDB) || !targetNames.includes(targetAuthContainer) || !targetNames.includes(targetRestContainer) || !targetNames.includes(targetStorageContainer)) throw new Error('Isolated target containers were not created with their expected project name.');
  for (const name of [targetAuthContainer, targetRestContainer, targetStorageContainer]) {
    runSync('docker', ['stop', name], { stage: 'pausing target API services' });
  }

  phase = 'replace isolated target schemas';
  for (const schema of SCHEMAS) await targetAdmin.query(`DROP SCHEMA IF EXISTS ${sqlIdent(schema)} CASCADE`);
  recoveryPassword = crypto.randomBytes(32).toString('base64url');
  const sourceAppRole = sourcePermissions.roles.find((role) => role.name === 'vasoli_app');
  if (!sourceAppRole || !sourceAppRole.can_login || sourceAppRole.superuser || sourceAppRole.create_db || sourceAppRole.create_role || sourceAppRole.replication || sourceAppRole.bypass_rls || sourceAppRole.inherit) {
    throw new Error('Source vasoli_app role is not a restricted login role.');
  }
  phase = 'prepare restricted restore role';
  await targetAdmin.query(`DO $role$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='vasoli_app') THEN CREATE ROLE vasoli_app; END IF; END $role$`);
  await targetAdmin.query(`ALTER ROLE vasoli_app LOGIN PASSWORD ${sqlLiteral(recoveryPassword)}`);
  await targetAdmin.query(`ALTER ROLE vasoli_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${Number(sourceAppRole.connection_limit)}`);
  phase = 'restore database dump';
  await restoreDatabase(targetDB, databaseDump, path.join(bundle, 'pg-restore-diagnostics.txt'));
  phase = 'replay permission manifest';
  await targetAdmin.query(permissionsSQL(sourcePermissions));
  phase = 'compare restored permissions and rows';
  const targetPermissions = await capturePermissions(targetAdmin, SCHEMAS);
  await writeProtected(path.join(bundle, 'restored-permissions.json'), `${JSON.stringify(targetPermissions, null, 2)}\n`);
  if (JSON.stringify(targetPermissions) !== JSON.stringify(sourcePermissions)) {
    const mismatches = Object.keys(sourcePermissions).filter((key) => JSON.stringify(targetPermissions[key]) !== JSON.stringify(sourcePermissions[key]));
    throw new Error(`Restored permissions manifest differs from the backup in: ${mismatches.join(', ')}.`);
  }
  verificationLines.push('PASS exact owners, ACL grantors, default privileges, role memberships and RLS match');
  const targetDigests = await schemaDigest(targetAdmin);
  if (JSON.stringify(targetDigests) !== JSON.stringify(sourceDigests)) throw new Error('Restored table row digests differ from the source snapshot.');
  verificationLines.push(`PASS all ${sourceDigests.length} table row digests match across four restored schemas`);
  const targetAuthIds = (await targetAdmin.query('SELECT id::text FROM auth.users ORDER BY id')).rows.map((row) => row.id);
  if (JSON.stringify(targetAuthIds) !== JSON.stringify(sourceAuthIds)) throw new Error('Restored Auth identities differ from the source snapshot.');
  verificationLines.push('PASS restored Auth identities match the source snapshot');
  const restoredTransaction = await targetAdmin.query('SELECT id::text, amount_paise::text, user_id::text FROM public.transactions WHERE id=$1', [sourceTransaction.id]);
  if (restoredTransaction.rowCount !== 1 || restoredTransaction.rows[0].amount_paise !== '10029' || restoredTransaction.rows[0].user_id !== owner.id) throw new Error('The restored financial record did not retain its owner and amount.');
  verificationLines.push('PASS financial transaction owner and amount survive restoration');

  phase = 'restore storage volume';
  const extractedStorage = path.join(targetTempBase, 'storage-data');
  await fs.mkdir(extractedStorage, { mode: 0o700 });
  runSync('tar', ['-xzf', storageArchive, '-C', extractedStorage], { stage: 'storage archive extraction' });
  await copyDirectoryIntoContainer(targetStorageContainer, extractedStorage, '/mnt');
  phase = 'wait for restored Storage API';
  for (const container of [targetAuthContainer, targetRestContainer, targetStorageContainer]) runSync('docker', ['start', container], { stage: 'starting target Auth, REST and Storage' });
  for (const container of [targetAuthContainer, targetRestContainer, targetStorageContainer]) {
    const running = runSync('docker', ['inspect', '--format', '{{.State.Running}}', container], { stage: 'checking target service state' }).trim();
    if (running !== 'true') throw new Error('A required isolated Auth, REST, or Storage container is not running.');
  }
  const anonHeaders = { apikey: targetStatus.ANON_KEY, Authorization: `Bearer ${targetStatus.ANON_KEY}` };
  await waitHttpHealthy(`${TARGET_API}/auth/v1/health`, 'Auth', anonHeaders);
  await waitHttpHealthy(`${TARGET_API}/storage/v1/status`, 'Storage', anonHeaders);
  verificationLines.push('PASS isolated Auth, REST and Storage containers started; Auth and Storage health routes are live');
  targetBucket = sourceBucket;
  targetObjectPath = sourceObjectPath;
  targetPolicy = sourcePolicy;
  phase = 'verify restored Auth and private storage';
  restoredOwner = await signInFixture(TARGET_API, targetStatus.ANON_KEY, owner);
  restoredOther = await signInFixture(TARGET_API, targetStatus.ANON_KEY, other);
  const goodObject = await storageRequest(TARGET_API, targetStatus.ANON_KEY, restoredOwner.token, `object/${targetBucket}/${targetObjectPath}`);
  if (goodObject.status !== 200) throw new Error('Restored owner could not read the private fixture object.');
  const returnedBytes = Buffer.from(await goodObject.arrayBuffer());
  const backupManifest = JSON.parse(await fs.readFile(path.join(bundle, 'manifest.json'), 'utf8'));
  if (crypto.createHash('sha256').update(returnedBytes).digest('hex') !== backupManifest.storageFixture.sha256) throw new Error('Restored private object bytes do not match the retained backup.');
  const deniedTarget = await storageRequest(TARGET_API, targetStatus.ANON_KEY, restoredOther.token, `object/${targetBucket}/${targetObjectPath}`);
  if (![400, 401, 403, 404].includes(deniedTarget.status)) throw new Error('Restored private storage did not deny another user.');
  verificationLines.push('PASS restored Auth login, private object bytes and cross-user denial');
  const restOwnerResponse = await fetch(`${TARGET_API}/rest/v1/financial_accounts?id=eq.${sourceAccount.id}&select=id`, { headers: { apikey: targetStatus.ANON_KEY, Authorization: `Bearer ${restoredOwner.token}` } });
  if (!restOwnerResponse.ok) throw new Error(`Restored authenticated REST owner query failed (${restOwnerResponse.status}).`);
  const ownerRows = await restOwnerResponse.json();
  if (!Array.isArray(ownerRows) || ownerRows.length !== 1 || ownerRows[0].id !== sourceAccount.id) throw new Error('Restored owner could not read the source account through REST.');
  const restOtherResponse = await fetch(`${TARGET_API}/rest/v1/financial_accounts?id=eq.${sourceAccount.id}&select=id`, { headers: { apikey: targetStatus.ANON_KEY, Authorization: `Bearer ${restoredOther.token}` } });
  if (!restOtherResponse.ok || (await restOtherResponse.json()).length !== 0) throw new Error('Restored REST did not isolate the source account from another user.');
  verificationLines.push('PASS authenticated REST access is limited to the restored account owner');

  const sourceRoleURL = new URL(targetStatus.DB_URL);
  sourceRoleURL.username = 'vasoli_app';
  sourceRoleURL.password = recoveryPassword;
  const appClient = await databaseClient(sourceRoleURL.toString());
  try {
    const role = await appClient.query('SELECT current_user AS role, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=current_user');
    assert.equal(role.rows[0].role, 'vasoli_app');
    assert.deepEqual(role.rows[0], { role: 'vasoli_app', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
  } finally { await appClient.end(); }

  const apiAvailable = await isPortOpen(8181);
  if (apiAvailable) throw new Error('Recovery API port 8181 is already in use; refusing to trust an unknown process.');
  if (!apiAvailable) {
    const executable = path.join(targetTempBase, 'vasoli-server');
    runSync('go', ['build', '-o', executable, './cmd/server'], { cwd: path.join(ROOT, 'backend'), stage: 'building recovery API' });
    const runtimeEnv = {
      ...process.env,
      ENV: 'development', BYPASS_AUTH: 'false', SERVER_ADDR: '127.0.0.1:8181',
      DATABASE_URL: `postgresql://vasoli_app:${escapeConn(recoveryPassword)}@127.0.0.1:${TARGET_DB_PORT}/postgres`,
      PILOT_ADMIN_DATABASE_URL: targetStatus.DB_URL,
      SUPABASE_URL: TARGET_API, SUPABASE_SERVICE_ROLE_KEY: targetStatus.SERVICE_ROLE_KEY,
      SUPABASE_JWT_SECRET: targetStatus.JWT_SECRET,
      SUPABASE_JWT_ISSUER: `${TARGET_API}/auth/v1`, SUPABASE_JWT_AUDIENCE: 'authenticated',
      CORS_ORIGINS: 'http://127.0.0.1:3001', SMTP_ADDR: '', ENABLE_EMAIL_NOTIFICATIONS: 'false', MARCO_ENABLED: 'false',
    };
    apiProcess = spawn(executable, [], { cwd: ROOT, env: runtimeEnv, stdio: 'ignore' });
    await waitProcess(apiProcess);
  }
  phase = 'verify restored transaction authorization';
  const restoredRpcRecord = await rpc('http://127.0.0.1:8181', restoredOwner, 'TransactionService', 'GetTransaction', { id: sourceTransaction.id });
  if (restoredRpcRecord.transaction?.id !== sourceTransaction.id || restoredRpcRecord.transaction?.amountPaise !== '10029') throw new Error('Authenticated RPC did not read the restored financial record.');
  await rpc('http://127.0.0.1:8181', restoredOther, 'TransactionService', 'GetTransaction', { id: sourceTransaction.id }, 404);
  verificationLines.push('PASS restored transaction is readable by owner and denied to another user');
  phase = 'authenticated API recovery scenarios';
  const apiCheckEnv = {
    ...process.env,
    PILOT_RECOVERY_CHECK: 'true',
    SUPABASE_URL: TARGET_API,
    PILOT_ADMIN_DATABASE_URL: targetStatus.DB_URL,
    SUPABASE_SERVICE_ROLE_KEY: targetStatus.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: targetStatus.ANON_KEY,
  };
  const apiResult = spawnSync(process.execPath, ['scripts/pilot/api-check.mjs'], { cwd: ROOT, env: apiCheckEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  if (apiResult.error) throw new Error('Authenticated API recovery scenarios could not start.');
  await writeProtected(path.join(bundle, 'api-check.stdout.txt'), apiResult.stdout || '');
  await writeProtected(path.join(bundle, 'api-check.stderr.txt'), apiResult.stderr || '');
  if (apiResult.status !== 0) throw new Error(`Authenticated API recovery scenarios exited with status ${apiResult.status}.`);
  const apiOutput = apiResult.stdout;
  apiCheckLines = apiOutput.split('\n').filter((entry) => entry.startsWith('PASS ') || entry.includes('authenticated pilot API scenario groups passed'));
  succeeded = true;
} catch (error) {
  if (bundlePath && error?.stack) {
    try { await fs.writeFile(path.join(bundlePath, 'failure-diagnostic.txt'), `${error.stack}\n`, { mode: 0o600, flag: 'wx' }); } catch { /* keep the first protected diagnostic */ }
  }
  console.error(`Full local recovery check failed during ${phase}. Details and secret-bearing output were withheld.`);
  process.exitCode = 1;
} finally {
  const cleanupFailures = [];
  if (apiProcess && apiProcess.exitCode == null) apiProcess.kill('SIGTERM');
  if (sourceAdmin && sourceFixtureTransaction) await sourceAdmin.query('ROLLBACK').catch(() => {});
  if (sourceAdmin) {
    let sourceObjectRemoved = !sourceBucket;
    if (sourceBucket) {
      try {
        const response = await fetch(`${SOURCE_API}/storage/v1/object/${sourceBucket}`, { method: 'DELETE', headers: { apikey: sourceService, Authorization: `Bearer ${sourceService}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [sourceObjectPath] }) });
        if (!response.ok) throw new Error(String(response.status));
        const remaining = await sourceAdmin.query('SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id=$1 AND name=$2', [sourceBucket, sourceObjectPath]);
        if (remaining.rows[0].n !== 0) throw new Error('row-remains');
        sourceObjectRemoved = true;
      } catch (error) { cleanupFailures.push('source storage object'); cleanupDiagnostics.push({ source: 'object', outcome: error.message }); }
      if (sourceObjectRemoved) {
        try {
          const response = await fetch(`${SOURCE_API}/storage/v1/bucket/${sourceBucket}`, { method: 'DELETE', headers: { apikey: sourceService, Authorization: `Bearer ${sourceService}` } });
          if (!response.ok) throw new Error(String(response.status));
        } catch (error) { cleanupFailures.push('source storage bucket'); cleanupDiagnostics.push({ source: 'bucket', outcome: error.message }); }
      }
    }
    if (sourcePolicy) {
      try { await sourceAdmin.query(`DROP POLICY IF EXISTS ${sqlIdent(sourcePolicy)} ON storage.objects`); } catch { cleanupFailures.push('source storage policy'); }
    }
    if (sourceObjectRemoved) for (const user of sourceUsers) {
      try { await authRequest(SOURCE_API, sourceService, `admin/users/${user.id}`, null, sourceService, 'DELETE'); } catch { cleanupFailures.push('source Auth fixture'); cleanupDiagnostics.push({ source: 'auth-user', outcome: 'delete-failed' }); }
    } else if (sourceUsers.length) {
      cleanupFailures.push('source Auth fixture preserved because object removal failed');
    }
    try {
      const ids = sourceUsers.map((user) => user.id);
      const remainingUsers = await sourceAdmin.query('SELECT count(*)::int AS n FROM auth.users WHERE id=ANY($1::uuid[])', [ids]);
      const remainingBucket = await sourceAdmin.query('SELECT count(*)::int AS n FROM storage.buckets WHERE id=$1', [sourceBucket]);
      const remainingPolicy = sourcePolicy ? await sourceAdmin.query('SELECT count(*)::int AS n FROM pg_policy WHERE polname=$1', [sourcePolicy]) : { rows: [{ n: 0 }] };
      if (remainingUsers.rows[0].n || remainingBucket.rows[0].n || remainingPolicy.rows[0].n) cleanupFailures.push('source fixture verification');
    } catch { cleanupFailures.push('source fixture verification'); }
    await sourceAdmin.end().catch(() => {});
  }
  if (targetAdmin && targetBucket && targetStatus) {
    let targetObjectRemoved = false;
    try {
      const response = await fetch(`${TARGET_API}/storage/v1/object/${targetBucket}`, { method: 'DELETE', headers: { apikey: targetStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${targetStatus.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [targetObjectPath] }) });
      if (!response.ok) throw new Error(String(response.status));
      const remaining = await targetAdmin.query('SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id=$1 AND name=$2', [targetBucket, targetObjectPath]);
      if (remaining.rows[0].n !== 0) throw new Error('row-remains');
      targetObjectRemoved = true;
    } catch (error) { cleanupFailures.push('target storage object'); cleanupDiagnostics.push({ target: 'object', outcome: error.message }); }
    if (targetObjectRemoved) {
      try {
        const response = await fetch(`${TARGET_API}/storage/v1/bucket/${targetBucket}`, { method: 'DELETE', headers: { apikey: targetStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${targetStatus.SERVICE_ROLE_KEY}` } });
        if (!response.ok) throw new Error(String(response.status));
      } catch (error) { cleanupFailures.push('target storage bucket'); cleanupDiagnostics.push({ target: 'bucket', outcome: error.message }); }
    }
    if (targetPolicy) {
      try { await targetAdmin.query(`DROP POLICY IF EXISTS ${sqlIdent(targetPolicy)} ON storage.objects`); } catch { cleanupFailures.push('target storage policy'); }
    }
    if (targetObjectRemoved) for (const user of sourceUsers) {
      try { await authRequest(TARGET_API, targetStatus.SERVICE_ROLE_KEY, `admin/users/${user.id}`, null, targetStatus.SERVICE_ROLE_KEY, 'DELETE'); } catch { cleanupFailures.push('target Auth fixture'); cleanupDiagnostics.push({ target: 'auth-user', outcome: 'delete-failed' }); }
    } else if (sourceUsers.length) {
      cleanupFailures.push('target Auth fixture preserved because object removal failed');
    }
    try {
      const ids = sourceUsers.map((user) => user.id);
      const remainingUsers = await targetAdmin.query('SELECT count(*)::int AS n FROM auth.users WHERE id=ANY($1::uuid[])', [ids]);
      const remainingBucket = await targetAdmin.query('SELECT count(*)::int AS n FROM storage.buckets WHERE id=$1', [targetBucket]);
      const remainingPolicy = targetPolicy ? await targetAdmin.query('SELECT count(*)::int AS n FROM pg_policy WHERE polname=$1', [targetPolicy]) : { rows: [{ n: 0 }] };
      if (remainingUsers.rows[0].n || remainingBucket.rows[0].n || remainingPolicy.rows[0].n) cleanupFailures.push('target fixture verification');
    } catch { cleanupFailures.push('target fixture verification'); }
  }
  if (targetAdmin) await targetAdmin.end().catch(() => {});
  if (targetStarted && targetWorkdir) {
    try { cli(['stop', '--no-backup'], targetWorkdir); } catch { cleanupFailures.push('isolated target shutdown'); }
  }
  if (targetTempBase) await fs.rm(targetTempBase, { recursive: true, force: true }).catch(() => cleanupFailures.push('temporary target files'));
  if (bundlePath && cleanupDiagnostics.length) {
    try { await writeProtected(path.join(bundlePath, 'cleanup-diagnostics.json'), `${JSON.stringify(cleanupDiagnostics, null, 2)}\n`); } catch { /* preserve the primary failure */ }
  }
  if (cleanupFailures.length) {
    console.error(`Fixture cleanup failed: ${[...new Set(cleanupFailures)].join(', ')}.`);
    process.exitCode = 1;
  } else if (succeeded) {
    const results = [...verificationLines, ...apiCheckLines];
    await writeProtected(path.join(bundlePath, 'result.json'), `${JSON.stringify({ formatVersion: 1, completedAt: new Date().toISOString(), checks: results }, null, 2)}\n`);
    console.log(results.join('\n'));
    console.log(`Full local recovery check passed. Retained backup: ${path.relative(ROOT, bundlePath)}. Source stack preserved; isolated target stopped and removed.`);
  }
}
