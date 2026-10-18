import pg from 'pg';

const url = process.env.PREFLIGHT_DATABASE_URL;
if (!url) throw new Error('Set PREFLIGHT_DATABASE_URL explicitly. This command never applies migrations.');
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
  const columns = new Map();
  for (const row of rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
    columns.get(row.table_name).add(row.column_name);
  }
  const tx = columns.get('transactions');
  const shape = !tx ? (columns.size ? 'unknown' : 'empty') : tx.has('amount_paise') && tx.has('user_id') ? 'go-paise' : tx.has('amount') && tx.has('userid') ? 'legacy-supabase-rupees' : 'unknown';
  if (shape === 'unknown') throw new Error('Unrecognized schema. No automatic upgrade is permitted.');
  const counts = {};
  for (const name of ['users','transactions','budgets','goals','goal_contributions','financial_accounts','receipts','recurring_rules','recurring_transactions']) {
    if (columns.has(name)) counts[name] = Number((await client.query(`SELECT count(*) AS count FROM public."${name}"`)).rows[0].count);
  }
  const ambiguous = [];
  const moneyColumns = {transactions:['amount'],budgets:['amount'],goals:['targetamount','currentamount'],goal_contributions:['amount'],recurring_transactions:['amount'],transaction_splits:['amount']};
  for (const [table, fields] of Object.entries(moneyColumns)) {
    for (const column of fields) {
      if (!columns.get(table)?.has(column)) continue;
      const result = await client.query(`SELECT count(*) AS count FROM public."${table}" WHERE "${column}" IS NOT NULL AND ("${column}"::text IN ('NaN','Infinity','-Infinity') OR abs("${column}"::numeric * 100) > 9223372036854775807 OR "${column}"::numeric * 100 <> trunc("${column}"::numeric * 100))`);
      if (Number(result.rows[0].count)) ambiguous.push(`${table}.${column}`);
    }
  }
  console.log(JSON.stringify({ schema: shape, rowCounts: counts, ambiguousMoneyColumns: ambiguous, safeToPrepareUpgrade: ambiguous.length === 0, appliesChanges: false }, null, 2));
  if (ambiguous.length) process.exitCode = 2;
  await client.query('ROLLBACK');
} finally { await client.end(); }
