// scripts/verify-regulatory-manifest.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { buildSubmissionManifest } = await import('../lib/chassis/regulatory/submitter.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = buildSubmissionManifest(c.input);
  const agOk = JSON.stringify([...got.agencies_required].sort()) === JSON.stringify([...c.expected.agencies].sort());
  const fdaOk = !!got.fda?.required === c.expected.fda_required;
  const usdaOk = !!got.usda?.required === c.expected.usda_required;
  const isfOk = !!got.isf?.required === c.expected.isf_required;
  const cbpOk = got.cbp_7501.required === c.expected.cbp_7501_required;
  const ok = agOk && fdaOk && usdaOk && isfOk && cbpOk;
  if (ok) passed++;
  else failures.push({ id: c.id, label: c.label, got_agencies: got.agencies_required, expected_agencies: c.expected.agencies, fdaOk, usdaOk, isfOk, cbpOk });
}

const pct = (passed / set.cases.length) * 100;
console.log(`Manifest routing: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  ✗ ${f.id} ${f.label}\n    got [${f.got_agencies.join(',')}], expected [${f.expected_agencies.join(',')}]`);
if (pct < 98) { console.error(`FAIL: < 98%`); process.exit(1); }
console.log(`PASS: ≥ 98%`);
