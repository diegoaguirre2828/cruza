// scripts/verify-paperwork-roundtrip.mjs
// Round-trip: upload commercial-invoice.png → /api/paperwork/extract → verify classification + invoice fields.
// First request can take 30-90s (tesseract.js cold start). Subsequent runs are fast.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CRUZAR_BASE_URL || 'http://localhost:3000';
const TIMEOUT_MS = 180_000;  // 180s — covers tesseract cold-start

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
}

(async () => {
  console.log(`Round-trip target: ${BASE} (timeout ${TIMEOUT_MS}ms — tesseract cold start can be slow)\n`);

  const fixtureBytes = readFileSync(resolve(__dirname, '../data/docs/test-fixtures/commercial-invoice.png'));
  const blob = new Blob([fixtureBytes], { type: 'image/png' });
  const form = new FormData();
  form.append('file', blob, 'commercial-invoice.png');
  form.append('shipment_ref', 'rtrip-m4-' + Date.now());

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch(`${BASE}/api/paperwork/extract`, { method: 'POST', body: form, signal: ctrl.signal });
  } catch (e) {
    console.error(`fetch failed (timeout or network): ${e.message}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }

  check('POST /api/paperwork/extract returned 200', r.ok, `status ${r.status}`);
  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    console.error(`error body: ${errBody.slice(0, 400)}`);
    process.exit(1);
  }

  const body = await r.json();
  check('composition.doc_count is 1', body.composition?.doc_count === 1, `got ${body.composition?.doc_count}`);
  check('detected commercial_invoice', body.composition?.documents_extracted?.[0]?.doc_type === 'commercial_invoice', `got ${body.composition?.documents_extracted?.[0]?.doc_type}`);
  check('per_page array length 1', Array.isArray(body.per_page) && body.per_page.length === 1);
  check('extracted invoice_number', typeof body.per_page?.[0]?.fields?.invoice_number === 'string', `got ${body.per_page?.[0]?.fields?.invoice_number}`);

  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
})();
