// scripts/verify-ligie-table.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tablePath = resolve(__dirname, '../data/customs/ligie-table.json');
const data = JSON.parse(readFileSync(tablePath, 'utf-8'));

const checks = [
  { name: 'version present', pass: typeof data.version === 'string' },
  { name: 'effective date is 2026-01-01', pass: data.effective === '2026-01-01' },
  { name: 'source is DOF 5777376', pass: data.source.includes('5777376') },
  { name: 'non_fta_origins includes CN, IN, KR', pass: ['CN','IN','KR'].every(o => data.non_fta_origins.includes(o)) },
  { name: 'entries_count matches array length', pass: data.entries_count === data.entries.length },
  { name: 'every entry has 8-digit tariff_line', pass: data.entries.every(e => /^\d{8}$/.test(e.tariff_line)) },
  { name: 'every entry has rate 5-50%', pass: data.entries.every(e => e.rate_pct >= 5 && e.rate_pct <= 50) },
  { name: 'every entry has sector', pass: data.entries.every(e => typeof e.sector === 'string' && e.sector.length > 0) },
];

let failed = 0;
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}`);
  if (!c.pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
