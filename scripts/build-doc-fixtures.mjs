// scripts/build-doc-fixtures.mjs
// One-shot generator for data/docs/test-fixtures/*.png — synthetic samples for the classifier verifier.

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../data/docs/test-fixtures');

const FIXTURES = [
  { name: 'commercial-invoice.png', text: 'Commercial Invoice\nInvoice No: INV-2026-001\nSeller: Demo Importer\nBuyer: Demo Buyer\nIncoterms: FOB\nTotal: USD 12,500.00\nCountry of Origin: MX' },
  { name: 'packing-list.png', text: 'Packing List\nMarks and Numbers: ABC-123\nNumber of Packages: 25\nGross Weight: 1500 kg\nNet Weight: 1200 kg' },
  { name: 'bill-of-lading.png', text: 'Bill of Lading\nB/L No: BOL-2026-789\nShipper: ACME Logistics\nCarrier: Maersk\nPort of Loading: Veracruz\nPort of Discharge: Houston\nDescription of Goods: Auto parts' },
  { name: 'certificate-of-origin.png', text: 'USMCA Certificate of Origin\nExporter: Demo Producer\nProducer: Demo Producer\nHS Classification: 8708.30.50\nOrigin Criterion: B\nAuthorized Signature' },
  { name: 'mx-health-cert-clean.png', text: 'CERTIFICADO DE SALUD\nCertificado No: CS-2026-456\nProducto: Tomates frescos\nPais de Origen: Mexico\nPais de Destino: Estados Unidos\nSENASICA\nFecha de Expedicion: 2026-05-04' },
  { name: 'pedimento.png', text: 'PEDIMENTO\nClave del Pedimento: A1\nAduana: Reynosa\nAgente Aduanal: AA Demo\nReferencia: REF-2026-001\nTipo de Cambio: 18.50' },
  { name: 'fda-prior-notice.png', text: 'FDA Prior Notice Confirmation\n21 CFR Sec 1.279\nIndustry Code: 20\nPNSI Confirmation Number: PN-2026-12345' },
];

async function makePng(text, outPath) {
  const lines = text.split('\n');
  const lineHeight = 28;
  const width = 600;
  const height = 100 + lines.length * lineHeight;
  const tspans = lines.map((l, i) => `<tspan x="20" dy="${i === 0 ? lineHeight : lineHeight}">${l.replace(/[<>&]/g, '')}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text font-family="Arial" font-size="20" fill="black">${tspans}</text></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
}

(async () => {
  for (const f of FIXTURES) {
    await makePng(f.text, resolve(OUT, f.name));
    console.log(`Wrote ${f.name}`);
  }
  console.log(`\nWrote ${FIXTURES.length} fixtures to ${OUT}`);
})();
