// scripts/verify-driver-pass-composer.mjs — Module Driver Pass chassis fixtures
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeDriverPass } = await import('../lib/chassis/driver-pass/composer.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/driver-pass/test-fixtures/composer-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];
for (const c of fx.cases) {
  const r = composeDriverPass(c.input, today);
  const e = c.expect;
  const ok =
    (e.readiness === undefined || r.readiness === e.readiness) &&
    (e.blocking_doc_count === undefined || r.blocking_doc_count === e.blocking_doc_count) &&
    (e.blocking_doc_count_at_least === undefined || r.blocking_doc_count >= e.blocking_doc_count_at_least) &&
    (e.expiring_soon_doc_count === undefined || r.expiring_soon_doc_count === e.expiring_soon_doc_count) &&
    (e.expiring_soon_doc_count_at_least === undefined || r.expiring_soon_doc_count >= e.expiring_soon_doc_count_at_least);
  if (ok) pass++;
  else {
    fail++;
    fails.push({ name: c.name, got: { readiness: r.readiness, blocking: r.blocking_doc_count, expiring: r.expiring_soon_doc_count, findings: r.doc_findings.map((f) => ({ id: f.doc_id, status: f.status })) }, want: e });
  }
}
console.log(`Driver pass composer: ${pass}/${fx.cases.length} pass`);
if (fail > 0) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
console.log('PASS');
