// scripts/verify-ofac-sdn.mjs
// Tests the OFAC SDN screening against a synthetic mini-SDN CSV.
// Verifies known-bad names hit and known-good (clean) names don't.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { loadSdnSnapshot, screenAgainstSdn } = await import('../lib/chassis/screening/ofac-sdn.ts');

const csvText = readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/ofac-sdn-mini.csv'), 'utf-8');
const snapshot = await loadSdnSnapshot({ csvText });

if (snapshot.entries.length !== 6) {
  console.error(`FAIL: expected 6 SDN entries from fixture, got ${snapshot.entries.length}`);
  process.exit(1);
}
console.log(`PASS: SDN snapshot parsed — ${snapshot.entries.length} entries`);

const cases = [
  { label: 'known-bad — exact cartel name', name: 'CARTEL DE SINALOA', expectBlocked: true },
  { label: 'known-bad — Iran bank', name: 'Bank Melli Iran', expectBlocked: true },
  { label: 'known-bad — token-overlap on cartel', name: 'Sinaloa Cartel', expectBlocked: true },
  { label: 'known-bad — Iran motor company different word order', name: 'Iran Volvo Motor Company', expectBlocked: true },
  { label: 'known-good — RGV broker name', name: 'Rio Grande Customs LLC', expectBlocked: false },
  { label: 'known-good — common biz name', name: 'Acme Imports Inc', expectBlocked: false },
  { label: 'known-good — Mexican IOR not on list', name: 'Industrias Garcia SA de CV', expectBlocked: false },
  { label: 'known-good — common surname Smith alone', name: 'Smith Trading Company', expectBlocked: false },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = await screenAgainstSdn({ name: c.name, snapshot });
  if (result.blocked === c.expectBlocked) {
    pass++;
    console.log(`PASS: ${c.label} — blocked=${result.blocked}, ${result.hits.length} hit(s)`);
  } else {
    fail++;
    console.log(`FAIL: ${c.label} — expected blocked=${c.expectBlocked}, got ${result.blocked}, hits: ${JSON.stringify(result.hits.map(h => `${h.name_match}@${h.match_score}`))}`);
  }
}

console.log(`\nOFAC SDN: ${pass}/${pass + fail} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed — must be 100%`);
  process.exit(1);
}
console.log('PASS: 100%');
