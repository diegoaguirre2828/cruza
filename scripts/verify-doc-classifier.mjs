// scripts/verify-doc-classifier.mjs
// Runs each test fixture through the chassis (vision → classify) and asserts the doc_type matches.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { extractText } = await import('../lib/chassis/docs/vision-provider.ts');
const { classifyDocument } = await import('../lib/chassis/docs/classifier.ts');

const FIXTURE_DIR = resolve(__dirname, '../data/docs/test-fixtures');
const FIXTURES = [
  { file: 'commercial-invoice.png', expected: 'commercial_invoice' },
  { file: 'packing-list.png', expected: 'packing_list' },
  { file: 'bill-of-lading.png', expected: 'bill_of_lading' },
  { file: 'certificate-of-origin.png', expected: 'certificate_of_origin' },
  { file: 'mx-health-cert-clean.png', expected: 'mx_health_certificate' },
  { file: 'pedimento.png', expected: 'pedimento' },
  { file: 'fda-prior-notice.png', expected: 'fda_prior_notice' },
];

let passed = 0;
const failures = [];

for (const f of FIXTURES) {
  const bytes = readFileSync(resolve(FIXTURE_DIR, f.file));
  const vision = await extractText({ bytes: new Uint8Array(bytes), mime_type: 'image/png', language_hint: 'auto' }, 'tesseract');
  const cls = classifyDocument(vision);
  if (cls.doc_type === f.expected) passed++;
  else failures.push({ file: f.file, expected: f.expected, got: cls.doc_type, reason: cls.reason, ocr_confidence: vision.doc_level_confidence });
}

const pct = (passed / FIXTURES.length) * 100;
console.log(`Doc classifier: ${passed}/${FIXTURES.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.file}: expected ${f.expected}, got ${f.got} (ocr_conf=${f.ocr_confidence.toFixed(2)}, reason: ${f.reason})`);
if (pct < 95) { console.error(`FAIL: < 95%`); process.exit(1); }
console.log(`PASS: ≥ 95%`);
