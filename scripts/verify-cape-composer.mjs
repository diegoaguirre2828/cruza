// scripts/verify-cape-composer.mjs
// Composes 5 small CAPE CSVs and verifies exact string output. Threshold: 100%
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeCapeCsv } = await import('../lib/chassis/refunds/cape-composer.ts');

const testCases = [
  {
    label: 'Single entry',
    rows: [{ entry_number: 'ENT2025001234567' }],
    expectedCsv: 'Entry Number\nENT2025001234567',
    expectedWarnings: [],
  },
  {
    label: 'Three entries',
    rows: [
      { entry_number: 'ENT2025001234567' },
      { entry_number: 'ENT2025001234568' },
      { entry_number: 'ENT2025001234569' },
    ],
    expectedCsv: 'Entry Number\nENT2025001234567\nENT2025001234568\nENT2025001234569',
    expectedWarnings: [],
  },
  {
    label: 'Empty rows — warning but empty csv',
    rows: [],
    expectedCsv: '',
    expectedWarnings: ['No entries to compose'],
  },
  {
    label: 'Five entries mixed alphanumeric',
    rows: [
      { entry_number: 'ENT2025AB1234567' },
      { entry_number: 'ENT2025BC1234568' },
      { entry_number: 'ENT2025CD1234569' },
      { entry_number: 'ENT2025DE1234570' },
      { entry_number: 'ENT2025EF1234571' },
    ],
    expectedCsv: 'Entry Number\nENT2025AB1234567\nENT2025BC1234568\nENT2025CD1234569\nENT2025DE1234570\nENT2025EF1234571',
    expectedWarnings: [],
  },
  {
    label: 'Two entries with all uppercase 14 chars',
    rows: [
      { entry_number: 'ABCDEFGHIJKLMN' },
      { entry_number: '12345678901234' },
    ],
    expectedCsv: 'Entry Number\nABCDEFGHIJKLMN\n12345678901234',
    expectedWarnings: [],
  },
];

let pass = 0, fail = 0;
for (const tc of testCases) {
  const { csv, warnings } = composeCapeCsv(tc.rows);

  const csvMatch = csv === tc.expectedCsv;
  const warningsMatch = JSON.stringify(warnings) === JSON.stringify(tc.expectedWarnings);

  if (csvMatch && warningsMatch) {
    pass++;
    console.log(`PASS: ${tc.label}`);
  } else {
    fail++;
    console.log(`FAIL: ${tc.label}`);
    if (!csvMatch) {
      console.log(`  expected csv: ${JSON.stringify(tc.expectedCsv)}`);
      console.log(`  got csv:      ${JSON.stringify(csv)}`);
    }
    if (!warningsMatch) {
      console.log(`  expected warnings: ${JSON.stringify(tc.expectedWarnings)}`);
      console.log(`  got warnings:      ${JSON.stringify(warnings)}`);
    }
  }
}

const total = pass + fail;
console.log(`\nCAPE Composer: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} case(s) failed — must be 100%`);
  process.exit(1);
}
console.log('PASS: 100%');
