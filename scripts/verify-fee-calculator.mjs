// scripts/verify-fee-calculator.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { calculateCruzarFee } = await import('../lib/chassis/refunds/fee-calculator.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/fee-calculator-known-answers.json'), 'utf-8'));
let pass = 0, fail = 0;
for (const c of cases) {
  const got = calculateCruzarFee(c.recovery_usd);
  if (Math.abs(got - c.expected_fee_usd) < 0.5) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: recovery $${c.recovery_usd} expected $${c.expected_fee_usd} got $${got}`);
  }
}
console.log(`Fee calc: ${pass}/${cases.length} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed`);
  process.exit(1);
}
console.log('PASS');
