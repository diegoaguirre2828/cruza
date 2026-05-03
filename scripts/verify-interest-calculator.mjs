// scripts/verify-interest-calculator.mjs
// Verifies 25 known-answer interest cases. Threshold: ±$0.50 per case.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { computeInterest } = await import('../lib/chassis/refunds/interest-calculator.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/interest-calculator-known-answers.json'), 'utf-8'));

let pass = 0, fail = 0;
for (const c of cases) {
  const got = computeInterest(c.entry_number, c.principal_usd, c.paid_at, c.computed_through);
  const diff = Math.abs(got.interest_usd - c.expected_interest_usd);
  if (diff <= 0.50) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL [${c.entry_number}]: principal=$${c.principal_usd} paid=${c.paid_at} through=${c.computed_through}`);
    console.log(`  expected $${c.expected_interest_usd}, got $${got.interest_usd} (diff $${diff.toFixed(2)})`);
  }
}

const total = cases.length;
console.log(`\nInterest Calculator: ${pass}/${total} within ±$0.50`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) out of tolerance`);
  process.exit(1);
}
console.log('PASS: all within ±$0.50');
