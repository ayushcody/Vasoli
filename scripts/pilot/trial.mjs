import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// This provisions only an empty synthetic identity on the dedicated local stack.
const api = 'http://127.0.0.1:55421';
const directory = path.resolve('.pilot-trial');
if (process.env.SUPABASE_URL !== api || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Load the dedicated local pilot environment.');
}
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function auth(route, { key = service, method = 'GET', body } = {}) {
  return fetch(`${api}/auth/v1/${route}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function writePrivate(name, contents) {
  const temporary = path.join(directory, `.${name}.${crypto.randomUUID()}`);
  await fs.writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, path.join(directory, name));
  await fs.chmod(path.join(directory, name), 0o600);
}

try {
  await fs.mkdir(directory, { mode: 0o700 });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Trial directory must be a local directory.');
}
await fs.chmod(directory, 0o700);
let access;
try {
  access = JSON.parse(await fs.readFile(path.join(directory, 'access.json'), 'utf8'));
  if (!/^[0-9a-f-]{36}$/.test(access.id) || !/^trial-[0-9a-f-]+@vasoli\.local$/.test(access.email) || typeof access.password !== 'string') throw new Error('Invalid private trial access file.');
  const response = await auth(`admin/users/${access.id}`);
  if (response.status === 404) access = undefined;
  else if (!response.ok || (await response.json()).email !== access.email) throw new Error('Existing local trial identity could not be verified.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!access) {
  const email = `trial-${crypto.randomUUID()}@vasoli.local`;
  const password = crypto.randomBytes(24).toString('base64url');
  const response = await auth('admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
  if (!response.ok) throw new Error(`Local trial identity creation failed (${response.status}).`);
  const user = await response.json();
  access = { id: user.id, email, password };
  // Save immediately so an interrupted setup can resume without another identity.
  await writePrivate('access.json', `${JSON.stringify(access, null, 2)}\n`);
}
const session = await auth('token?grant_type=password', {
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  method: 'POST', body: { email: access.email, password: access.password },
});
if (!session.ok || (await session.json()).user?.id !== access.id) throw new Error('Genuine local trial sign-in failed.');
const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
await writePrivate('statement.csv', [
  'Date,Narration,Reference,Withdrawal,Deposit,Closing Balance',
  `${date},Trial groceries,TRIAL-001,300.00,,10200.00`,
  `${date},Trial transport,TRIAL-002,200.00,,10000.00`,
  '',
].join('\n'));
await writePrivate('START-HERE.md', `# Your local Vasoli trial

Synthetic account only. Keep real financial records in your own separate account.

Open http://127.0.0.1:3001/auth/signin and sign in with:

- Email: ${access.email}
- Password: ${access.password}

This is a genuine local Supabase identity; authentication bypass is disabled. No email was sent.

Follow docs/pilot-trial.md. The sample statement is .pilot-trial/statement.csv: opening balance ₹10,500, closing balance ₹10,000, two expenses totalling ₹500. Create a trial account with the already-current ₹10,000 balance before importing.

Rerunning npm run pilot:trial reuses this identity and refreshes the statement dates. It does not clear or seed financial records. Import the sample once; review duplicate warnings if you intentionally repeat it. Delete the trial identity through Settings when finished; rerunning the command can then create a fresh one.

These local credentials are private. Do not commit or share this directory.
`);
console.log('Local trial ready. Open .pilot-trial/START-HERE.md for private sign-in details and docs/pilot-trial.md for the walkthrough.');
