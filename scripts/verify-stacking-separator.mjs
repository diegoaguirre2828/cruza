// scripts/verify-stacking-separator.mjs
// Verifies 15 known-answer stacking cases. Threshold: 100%
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { separateStacking } = await import('../lib/chassis/refunds/stacking-separator.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/stacking-separator-known-answers.json'), 'utf-8'));

let pass = 0, fail = 0;
for (const c of cases) {
  const got = separateStacking(c.entry, c.ieepa_principal);
  const exp = c.expected;

  const ieepaDiff = Math.abs(got.ieepa_portion_usd - exp.ieepa_portion_usd);
  const s232Diff = Math.abs(got.section_232_portion_usd - exp.section_232_portion_usd);
  const s301Diff = Math.abs(got.section_301_portion_usd - exp.section_301_portion_usd);
  const unrelatedDiff = Math.abs(got.unrelated_duty_usd - exp.unrelated_duty_usd);

  if (ieepaDiff < 0.01 && s232Diff < 0.01 && s301Diff < 0.01 && unrelatedDiff < 0.01) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL [${c.label}]:`);
    if (ieepaDiff >= 0.01) console.log(`  ieepa_portion: expected $${exp.ieepa_portion_usd}, got $${got.ieepa_portion_usd}`);
    if (s232Diff >= 0.01) console.log(`  section_232: expected $${exp.section_232_portion_usd}, got $${got.section_232_portion_usd}`);
    if (s301Diff >= 0.01) console.log(`  section_301: expected $${exp.section_301_portion_usd}, got $${got.section_301_portion_usd}`);
    if (unrelatedDiff >= 0.01) console.log(`  unrelated: expected $${exp.unrelated_duty_usd}, got $${got.unrelated_duty_usd}`);
  }
}

const total = cases.length;
console.log(`\nStacking Separator: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed — must be 100%`);
  process.exit(1);
}
console.log('PASS: 100%');
