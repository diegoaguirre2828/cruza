// scripts/verify-ace-parser.mjs
// Parses fixture-001, fixture-002, fixture-003 and verifies expected entry counts.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { parseAceCsv } = await import('../lib/chassis/refunds/ace-parser.ts');

const fixturesDir = resolve(__dirname, '../data/refunds/test-fixtures/ace-csv');
const fixtures = [
  { file: 'fixture-001-entry-summary-by-filer.csv', expectedCount: 2 },
  { file: 'fixture-002-ace-reports-format.csv', expectedCount: 1 },
  { file: 'fixture-003-large-multi-line.csv', expectedCount: 30 },
];

let pass = 0, fail = 0;

for (const f of fixtures) {
  const csv = readFileSync(resolve(fixturesDir, f.file), 'utf-8');
  const { entries, errors } = parseAceCsv(csv);

  if (errors.length > 0) {
    fail++;
    console.log(`FAIL: ${f.file} — parse errors: ${errors.join(', ')}`);
    continue;
  }

  if (entries.length !== f.expectedCount) {
    fail++;
    console.log(`FAIL: ${f.file} — expected ${f.expectedCount} entries, got ${entries.length}`);
    continue;
  }

  // Verify all entries have required fields
  const invalid = entries.filter(e =>
    !e.entry_number ||
    !e.entry_date ||
    !e.country_of_origin ||
    e.htsus_codes.length === 0
  );
  if (invalid.length > 0) {
    fail++;
    console.log(`FAIL: ${f.file} — ${invalid.length} entries missing required fields`);
    continue;
  }

  console.log(`PASS: ${f.file} — ${entries.length} entries parsed`);
  pass++;
}

// Also test that fixture-004 through fixture-010 parse without errors
const additionalFixtures = [
  'fixture-004-mx-fentanyl-only.csv',
  'fixture-005-cn-stacked-301.csv',
  'fixture-006-canada-only.csv',
  'fixture-007-reciprocal-mixed-countries.csv',
  'fixture-008-past-180-days.csv',
  'fixture-009-adcvd-mixed.csv',
  'fixture-010-extended-suspended.csv',
];

for (const fname of additionalFixtures) {
  const csv = readFileSync(resolve(fixturesDir, fname), 'utf-8');
  const { entries, errors } = parseAceCsv(csv);
  if (errors.length > 0) {
    fail++;
    console.log(`FAIL: ${fname} — parse errors: ${errors.join(', ')}`);
  } else {
    console.log(`PASS: ${fname} — ${entries.length} entries parsed`);
    pass++;
  }
}

const total = pass + fail;
console.log(`\nACE Parser: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} test(s) failed`);
  process.exit(1);
}
console.log('PASS: 100%');
