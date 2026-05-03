// scripts/verify-cape-validator.mjs
// Verifies 25 known-bad CSV strings — each must produce at least the expected error rule IDs.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { validateCapeCsv } = await import('../lib/chassis/refunds/cape-validator.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/cape-validator-known-bad.json'), 'utf-8'));

let pass = 0, fail = 0;
for (const c of cases) {
  const { valid, errors } = validateCapeCsv(c.csv);
  const actualRuleIds = errors.map(e => e.rule_id);

  // Each expected rule ID must appear in actual
  const missing = c.expected_error_rule_ids.filter(id => !actualRuleIds.includes(id));
  const shouldBeInvalid = !valid;

  if (missing.length === 0 && shouldBeInvalid) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL [${c.label}]:`);
    if (missing.length > 0) console.log(`  missing rule IDs: ${missing.join(', ')}`);
    if (!shouldBeInvalid) console.log(`  expected invalid CSV but got valid=true`);
    console.log(`  actual rule IDs: ${actualRuleIds.join(', ')}`);
  }
}

const total = cases.length;
console.log(`\nCAPE Validator: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed`);
  process.exit(1);
}
console.log('PASS: all 25 known-bad cases caught');
