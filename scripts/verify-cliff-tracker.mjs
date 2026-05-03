// scripts/verify-cliff-tracker.mjs
// Verifies 30 known-answer cliff routing cases. Threshold: 100%
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { routeEntry } = await import('../lib/chassis/refunds/cliff-tracker.ts');

const cases = JSON.parse(readFileSync(resolve(__dirname, '../data/refunds/test-fixtures/cliff-tracker-known-answers.json'), 'utf-8'));

let pass = 0, fail = 0;
for (const c of cases) {
  const today = new Date(c.today);
  const got = routeEntry(c.entry, today);

  const statusMatch = got.cliff_status === c.expected_cliff_status;
  const deadlineMatch = got.protest_deadline === c.expected_protest_deadline;

  if (statusMatch && deadlineMatch) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL [${c.label}]:`);
    if (!statusMatch) console.log(`  cliff_status: expected "${c.expected_cliff_status}", got "${got.cliff_status}"`);
    if (!deadlineMatch) console.log(`  protest_deadline: expected "${c.expected_protest_deadline}", got "${got.protest_deadline}"`);
  }
}

const total = cases.length;
console.log(`\nCliff Tracker: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed — must be 100%`);
  process.exit(1);
}
console.log('PASS: 100%');
