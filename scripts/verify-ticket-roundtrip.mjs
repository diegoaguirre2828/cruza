// scripts/verify-ticket-roundtrip.mjs
// Round-trip: generate Ticket → fetch via /api/ticket/verify → verify locally.
// Tests sign + persist + fetch + verify path end-to-end against a running dev or prod server.

const BASE = process.env.CRUZAR_BASE_URL || 'http://localhost:3000';

const sample = {
  shipment: {
    product_description: 'Brake pads, ceramic, for passenger vehicles',
    origin_country: 'MX',
    destination_country: 'US',
    port_of_entry: '230502',
    bom: [
      { description: 'Ceramic brake pad core', hs6: '870830', origin_country: 'MX', value_usd: 600 },
      { description: 'Steel backing plate', hs6: '720851', origin_country: 'CN', value_usd: 300 },
    ],
    transaction_value_usd: 1000,
    importer_name: 'Demo Auto Importer',
    bol_ref: 'BL-RTRIP-001',
    shipment_ref: 'rtrip-' + Date.now(),
  },
};

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  console.log(`Round-trip target: ${BASE}\n`);

  // 1. Generate
  const genR = await fetch(`${BASE}/api/ticket/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample),
  });
  check('POST /api/ticket/generate returned 200', genR.ok, `status ${genR.status}`);
  const gen = await genR.json();
  check('generate response has ticket_id', typeof gen.ticket_id === 'string', gen.ticket_id);
  check('generate response has signed.signature_b64', typeof gen?.signed?.signature_b64 === 'string');

  if (!gen.ticket_id) {
    console.error('\nNo ticket_id returned, cannot continue round-trip');
    process.exit(1);
  }

  // 2. Fetch verify
  const verR = await fetch(`${BASE}/api/ticket/verify?id=${encodeURIComponent(gen.ticket_id)}`);
  check('GET /api/ticket/verify returned 200', verR.ok);
  const ver = await verR.json();
  check('server_verify.valid', ver.server_verify?.valid === true, ver.server_verify?.reason ?? '');
  check('signed.payload.ticket_id matches', ver.signed?.payload?.ticket_id === gen.ticket_id);

  // 3. Public key fetch
  const keyR = await fetch(`${BASE}/.well-known/cruzar-ticket-key.json`);
  check('public key fetched', keyR.ok);
  const keyBody = await keyR.json();
  check('public key has algorithm Ed25519', keyBody.algorithm === 'Ed25519');

  const failed = checks.filter(c => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) {
    console.error(`${failed} round-trip checks failed`);
    process.exit(1);
  }
})();
