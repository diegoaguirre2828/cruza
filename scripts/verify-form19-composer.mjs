// scripts/verify-form19-composer.mjs
// Verifies Form 19 PDF packet is non-empty (>1000 bytes) when given protest entries.
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeForm19Packet } = await import('../lib/chassis/refunds/form19-composer.ts');

const ior = {
  ior_name: 'Test Importer LLC',
  ior_id_number: '12-3456789',
  filer_code: 'TST',
  language: 'en',
};

// Protest entries — liquidated 100 days ago (protest_required)
const today = new Date('2026-05-03');
const entries = [
  {
    entry_number: 'ENT2025FM000001',
    entry_date: '2025-03-01',
    liquidation_date: '2026-01-23',
    liquidation_status: 'liquidated',
    country_of_origin: 'MX',
    htsus_codes: ['8703.23.0150', '9903.01.20'],
    duty_lines: [
      { htsus_code: '8703.23.0150', rate_pct: null, amount_usd: 4250.00, is_chapter_99: false },
      { htsus_code: '9903.01.20', rate_pct: null, amount_usd: 0, is_chapter_99: true },
    ],
    total_duty_paid_usd: 4250.00,
    total_dutiable_value_usd: 17000.00,
  },
  {
    entry_number: 'ENT2025FM000002',
    entry_date: '2025-04-10',
    liquidation_date: '2026-01-23',
    liquidation_status: 'liquidated',
    country_of_origin: 'CN',
    htsus_codes: ['8542.31.0000', '9903.01.30'],
    duty_lines: [
      { htsus_code: '8542.31.0000', rate_pct: null, amount_usd: 2000.00, is_chapter_99: false },
      { htsus_code: '9903.01.30', rate_pct: null, amount_usd: 0, is_chapter_99: true },
    ],
    total_duty_paid_usd: 2000.00,
    total_dutiable_value_usd: 10000.00,
  },
];

const routings = entries.map(e => ({
  entry_number: e.entry_number,
  cliff_status: 'protest_required',
  days_since_liquidation: 100,
  protest_deadline: '2026-07-22',
  reason: 'Liquidated 100 days ago',
}));

const ieepaPrincipalByEntry = new Map([
  ['ENT2025FM000001', 4250.00],
  ['ENT2025FM000002', 2000.00],
]);

let pass = 0, fail = 0;

try {
  const pdfBytes = await composeForm19Packet(ior, entries, routings, ieepaPrincipalByEntry);

  if (pdfBytes instanceof Uint8Array && pdfBytes.length > 1000) {
    console.log(`PASS: PDF produced — ${pdfBytes.length} bytes (expected >1000)`);
    pass++;
  } else {
    fail++;
    console.log(`FAIL: PDF too small or wrong type — got ${pdfBytes?.length ?? 'null'} bytes`);
  }
} catch (err) {
  fail++;
  console.log(`FAIL: Exception composing Form 19: ${err.message}`);
}

// Also verify that an empty protest list returns a valid PDF (cover page only)
try {
  const emptyRoutings = entries.map(e => ({
    entry_number: e.entry_number,
    cliff_status: 'cape_eligible',
    days_since_liquidation: 30,
    protest_deadline: null,
    reason: 'Within 80 days',
  }));
  const pdfBytes2 = await composeForm19Packet(ior, entries, emptyRoutings, ieepaPrincipalByEntry);
  if (pdfBytes2 instanceof Uint8Array && pdfBytes2.length > 500) {
    console.log(`PASS: Cover-only PDF produced — ${pdfBytes2.length} bytes`);
    pass++;
  } else {
    fail++;
    console.log(`FAIL: Cover-only PDF too small or wrong type`);
  }
} catch (err) {
  fail++;
  console.log(`FAIL: Exception composing cover-only Form 19: ${err.message}`);
}

const total = pass + fail;
console.log(`\nForm 19 Composer: ${pass}/${total} pass`);
if (fail > 0) {
  console.error(`FAIL: ${fail} check(s) failed`);
  process.exit(1);
}
console.log('PASS');
