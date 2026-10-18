// One-time canonical baseline builder; --check verifies the committed baseline's source fingerprint.
import fs from 'node:fs';
import crypto from 'node:crypto';
const schema = fs.readFileSync('backend/db/schema.sql', 'utf8');
const output = 'supabase/migrations/20261017000001_canonical_baseline.sql';
const fingerprint = crypto.createHash('sha256').update(schema).digest('hex');
if (process.argv.includes('--check')) {
  if (!fs.readFileSync(output,'utf8').includes(`source-sha256: ${fingerprint}`)) throw new Error('Schema snapshot and canonical baseline differ; add/verify the corresponding ordered migration.');
  process.exit(0);
}
const tables = [...schema.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g)].map(m=>({name:m[1],body:m[2]}));
if (!tables.length) throw new Error('No canonical tables found.');
const names = new Set(tables.map(t=>t.name));
const ordered=[], remaining=[...tables];
while(remaining.length) {
  const ready = remaining.findIndex(t=>[...t.body.matchAll(/REFERENCES\s+(\w+)/g)].every(m=>m[1]===t.name || !names.has(m[1]) || ordered.some(x=>x.name===m[1])));
  if (ready < 0) throw new Error('Circular table dependencies need explicit deferred constraints.');
  ordered.push(...remaining.splice(ready,1));
}
let sql = `-- Canonical Go/sqlc schema baseline, with additive legacy upgrades.\n-- source-sha256: ${fingerprint}\n`;
for (const table of ordered) sql += `CREATE TABLE IF NOT EXISTS ${table.name} (${table.body}\n);\n\n`;
// Existing legacy tables retain archival columns; add missing canonical columns explicitly.
for (const table of ordered) {
  for(const line of table.body.split('\n')) {
    const m=line.trim().replace(/,$/,'').match(/^("[^"]+"|[a-z_]\w*)\s+(.+)$/i);
    if(!m || /^(constraint|unique|primary|foreign|check)$/i.test(m[1])) continue;
    let definition=m[2];
    if(/NOT NULL/i.test(definition) && !/DEFAULT|PRIMARY KEY/i.test(definition)) {
      if(/^TEXT\b/i.test(definition)) definition += " DEFAULT ''";
      else if(/^(BIGINT|INTEGER|INT)\b/i.test(definition)) definition += ' DEFAULT 0';
      else if(/^BOOLEAN\b/i.test(definition)) definition += ' DEFAULT false';
      // No invented identifiers/timestamps: if missing on a populated table migration must fail.
    }
    sql += `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${m[1]} ${definition};\n`;
  }
}
// Keep default catalogue entries visible after migration; never convert private categories to global.
sql += `\nUPDATE categories SET is_default=true WHERE user_id IS NULL;\nUPDATE users SET name='' WHERE name IS NULL;\nUPDATE users SET avatar_url='' WHERE avatar_url IS NULL;\nUPDATE categories SET icon='' WHERE icon IS NULL;\nUPDATE categories SET color='' WHERE color IS NULL;\nUPDATE recurring_rules SET cadence=lower(cadence);\n`;
for(const m of schema.matchAll(/CREATE (UNIQUE )?INDEX\s+([\s\S]*?);/g)) sql += m[0].replace(/INDEX\s+/,'INDEX IF NOT EXISTS ')+'\n';
fs.writeFileSync(output,sql);
console.log(`Built ${output}: ${tables.length} tables.`);
