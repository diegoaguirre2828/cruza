// scripts/verify-rvc-calculator.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { calculateRvc } = await import('../lib/chassis/customs/rvc-calculator.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/customs/rvc-test-cases.json'), 'utf-8'));

let passed = 0;
const failures = [];

for (const c of set.cases) {
  const got = calculateRvc(c.input);
  const tvOk = c.expected.transaction_value_pct == null
    ? got.transaction_value_pct == null
    : Math.abs((got.transaction_value_pct ?? -999) - c.expected.transaction_value_pct) < 0.05;
  const ncOk = c.expected.net_cost_pct == null
    ? got.net_cost_pct == null
    : Math.abs((got.net_cost_pct ?? -999) - c.expected.net_cost_pct) < 0.05;
  const methodOk = got.recommended_method === c.expected.recommended_method;
  const metOk = got.threshold_met === c.expected.threshold_met;
  const allOk = tvOk && ncOk && methodOk && metOk;
  if (allOk) passed++;
  else failures.push({ id: c.id, label: c.label, got, expected: c.expected });
}

const pct = (passed / set.cases.length) * 100;
console.log(`RVC: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);

if (failures.length > 0) {
  for (const f of failures) console.log(`  ✗ ${f.id} ${f.label}\n    got ${JSON.stringify(f.got)}\n    expected ${JSON.stringify(f.expected)}`);
}

if (pct < 100) {
  console.error(`\nFAIL: RVC must be 100% on known-answer cases (got ${pct.toFixed(1)}%)`);
  process.exit(1);
}
console.log(`\nPASS: RVC 100%`);
