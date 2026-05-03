// scripts/verify-mx-health-cert.mjs
// Tests the MX health cert validator across 5 scenarios.
// Heuristic adapted per M4-T7: page-level confidence + word count threshold.

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { validateMxHealthCertificate } = await import('../lib/chassis/docs/mx-health-cert.ts');

// 25-word substantive primary text for the clean + handwriting cases (clears MIN_WORDS_FOR_HANDWRITING_CHECK=20 threshold)
const SUBSTANTIVE_TEXT = 'CERTIFICADO DE SALUD Numero CS-2026-456 Producto Tomates frescos Pais de Origen Mexico Pais de Destino Estados Unidos SENASICA Fecha de Expedicion 2026-05-04 Firma autorizada Sello oficial';

const cases = [
  {
    label: 'Clean cert (single page, high page-conf, substantial text)',
    input: {
      page_count: 1,
      primary_vision: { text: SUBSTANTIVE_TEXT, word_confidences: [], doc_level_confidence: 0.92, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: true, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Double-sided (2 pages, both substantive)',
    input: {
      page_count: 2,
      primary_vision: { text: SUBSTANTIVE_TEXT, word_confidences: [], doc_level_confidence: 0.92, provider: 'tesseract', duration_ms: 100 },
      secondary_vision: { text: 'Pagina 2 - notas adicionales y firmas. Texto suficiente para confirmar contenido en el reverso del certificado.', word_confidences: [], doc_level_confidence: 0.91, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: false, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Effective single-sided (page 2 blank)',
    input: {
      page_count: 2,
      primary_vision: { text: SUBSTANTIVE_TEXT, word_confidences: [], doc_level_confidence: 0.92, provider: 'tesseract', duration_ms: 100 },
      secondary_vision: { text: '', word_confidences: [], doc_level_confidence: 0, provider: 'tesseract', duration_ms: 50 },
    },
    expected: { single_sided: true, handwriting_detected: false, fields_legible: true },
  },
  {
    label: 'Handwriting detected (low page-conf < 0.65, >= 20 words)',
    input: {
      page_count: 1,
      primary_vision: { text: SUBSTANTIVE_TEXT, word_confidences: [], doc_level_confidence: 0.55, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: true, handwriting_detected: true, fields_legible: false },  // 0.55 < 0.6 → fields_legible false
  },
  {
    label: 'Low conf but few words (heuristic skipped)',
    input: {
      page_count: 1,
      primary_vision: { text: 'CERT CS-2026-456 SENASICA', word_confidences: [], doc_level_confidence: 0.55, provider: 'tesseract', duration_ms: 100 },
    },
    expected: { single_sided: true, handwriting_detected: false, fields_legible: false },
  },
];

let passed = 0;
const failures = [];
for (const c of cases) {
  const got = await validateMxHealthCertificate(c.input);
  const ok =
    got.single_sided === c.expected.single_sided &&
    got.handwriting_detected === c.expected.handwriting_detected &&
    got.fields_legible === c.expected.fields_legible;
  if (ok) passed++; else failures.push({ label: c.label, got, expected: c.expected });
}
const pct = (passed / cases.length) * 100;
console.log(`MX Health Cert: ${passed}/${cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
