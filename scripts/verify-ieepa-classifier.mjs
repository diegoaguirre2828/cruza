// scripts/verify-ieepa-classifier.mjs
// Verifies 40 known-answer cases. Threshold: ≥39/40 (98%)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { classifyEntry } = await import('../lib/chassis/refunds/ieepa-classifier.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/ieepa-classifier-known-answers.json'), 'utf-8'));

let pass = 0, fail = 0;
for (const c of cases) {
  const got = classifyEntry(c.entry);
  const exp = c.expected;

  const isEligibleMatch = got.is_ieepa_eligible === exp.is_ieepa_eligible;
  const eoMatch = got.applicable_eo === exp.applicable_eo;
  const codesMatch = JSON.stringify(got.ieepa_chapter_99_codes.sort()) === JSON.stringify(exp.ieepa_chapter_99_codes.sort());
  const principalMatch = Math.abs(got.ieepa_principal_usd - exp.ieepa_principal_usd) < 1.0;

  if (isEligibleMatch && eoMatch && codesMatch && principalMatch) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL [${c.label}]:`);
    if (!isEligibleMatch) console.log(`  eligible: expected ${exp.is_ieepa_eligible}, got ${got.is_ieepa_eligible}`);
    if (!eoMatch) console.log(`  eo: expected ${exp.applicable_eo}, got ${got.applicable_eo}`);
    if (!codesMatch) console.log(`  codes: expected ${JSON.stringify(exp.ieepa_chapter_99_codes)}, got ${JSON.stringify(got.ieepa_chapter_99_codes)}`);
    if (!principalMatch) console.log(`  principal: expected $${exp.ieepa_principal_usd}, got $${got.ieepa_principal_usd}`);
  }
}

const total = cases.length;
const pct = (pass / total * 100).toFixed(1);
console.log(`\nIEEPA Classifier: ${pass}/${total} = ${pct}%`);
if (pass < 39) {
  console.error(`FAIL: ${pass}/40 is below threshold 39/40 (98%)`);
  process.exit(1);
}
console.log(`PASS: ≥98% threshold met`);
