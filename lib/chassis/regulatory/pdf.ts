// lib/chassis/regulatory/pdf.ts
// Multi-page bilingual EN/ES regulatory submission PDF.
// One cover page + one page per required agency (FDA / USDA / ISF / CBP 7501).
// Officer/broker uses this as a handoff packet — they file via their own ACE/PNSI/eFile accounts.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { SubmissionManifest, AgencyId } from './types';

interface RenderOptions {
  baseUrl?: string;
}

const AGENCY_LABEL_ES: Record<AgencyId, string> = {
  FDA: 'FDA - Aviso Previo',
  USDA: 'USDA APHIS - PPQ',
  CBP_ISF: 'CBP - ISF 10+2',
  CBP_7501: 'CBP - Formulario 7501 (Resumen de Entrada)',
};
const AGENCY_LABEL_EN: Record<AgencyId, string> = {
  FDA: 'FDA - Prior Notice',
  USDA: 'USDA APHIS - PPQ',
  CBP_ISF: 'CBP - ISF 10+2',
  CBP_7501: 'CBP - Form 7501 (Entry Summary)',
};

// Helvetica WinAnsi cannot encode arbitrary Unicode (e.g. ≥ ≤ § – — ° á é í ó ú ñ).
// Sanitize all text to a safe ASCII subset before drawing.
function ascii(s: string): string {
  return s
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[§]/g, 'Sec.')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•]/g, '-')
    .replace(/[→]/g, '->')
    .replace(/[°]/g, 'deg')
    .replace(/á/g, 'a').replace(/Á/g, 'A')
    .replace(/é/g, 'e').replace(/É/g, 'E')
    .replace(/í/g, 'i').replace(/Í/g, 'I')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ú/g, 'u').replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    // Strip anything still outside printable ASCII (0x20-0x7E).
    .replace(/[^\x20-\x7E]/g, '?');
}

function drawHeader(page: PDFPage, bold: PDFFont, font: PDFFont, titleEs: string, titleEn: string) {
  page.drawText(ascii('Cruzar - Paquete Regulatorio / Regulatory Packet'), { x: 30, y: 750, size: 14, font: bold, color: rgb(0.06, 0.09, 0.16) });
  page.drawText(ascii(`${titleEs} / ${titleEn}`), { x: 30, y: 728, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawLine({ start: { x: 30, y: 716 }, end: { x: 582, y: 716 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
}

function drawBilingual(page: PDFPage, font: PDFFont, bold: PDFFont, yStart: number, lines: Array<{ es: string; en: string; bold?: boolean }>): number {
  let y = yStart;
  for (const line of lines) {
    const f = line.bold ? bold : font;
    page.drawText(ascii(line.es), { x: 30, y, size: 9, font: f, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(ascii(line.en), { x: 320, y, size: 9, font: f, color: rgb(0.15, 0.15, 0.15) });
    y -= 13;
  }
  return y;
}

function drawDisclaimer(page: PDFPage, font: PDFFont) {
  page.drawText(ascii('Este paquete es documentacion privada operativa. No es una credencial regulatoria.'), { x: 30, y: 50, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(ascii('Verifique con su agente aduanal antes de presentar a las agencias.'), { x: 30, y: 40, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(ascii('This packet is private operational documentation. Not a regulatory credential.'), { x: 30, y: 28, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(ascii('Verify with your licensed customs broker before agency submission.'), { x: 30, y: 18, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
}

export async function renderRegulatoryPdf(manifest: SubmissionManifest, _opts: RenderOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Cover page
  const cover = doc.addPage([612, 792]);
  drawHeader(cover, bold, font, 'Resumen', 'Summary');
  const coverLines: Array<{ es: string; en: string; bold?: boolean }> = [
    { es: `Referencia de envio: ${manifest.shipment_ref ?? 'N/A'}`, en: `Shipment ref: ${manifest.shipment_ref ?? 'N/A'}` },
    { es: `Compuesto en: ${manifest.composed_at_iso}`, en: `Composed at: ${manifest.composed_at_iso}` },
    { es: '', en: '' },
    { es: 'Agencias requeridas:', en: 'Agencies required:', bold: true },
  ];
  for (const a of manifest.agencies_required) {
    coverLines.push({ es: `  - ${AGENCY_LABEL_ES[a]}`, en: `  - ${AGENCY_LABEL_EN[a]}` });
  }
  coverLines.push({ es: '', en: '' });
  coverLines.push({ es: `Plazo mas cercano: ${manifest.earliest_deadline_iso ?? 'N/A'}`, en: `Earliest deadline: ${manifest.earliest_deadline_iso ?? 'N/A'}`, bold: true });
  drawBilingual(cover, font, bold, 690, coverLines);
  drawDisclaimer(cover, font);

  // FDA page
  if (manifest.fda?.required) {
    const p = doc.addPage([612, 792]);
    drawHeader(p, bold, font, AGENCY_LABEL_ES.FDA, AGENCY_LABEL_EN.FDA);
    const f = manifest.fda;
    const lines: Array<{ es: string; en: string; bold?: boolean }> = [
      { es: `Razon: ${f.reason_required}`, en: `Reason: ${f.reason_required}` },
      { es: `Codigo de producto FDA: ${f.product_code ?? '-'}`, en: `FDA product code: ${f.product_code ?? '-'}` },
      { es: `Plazo (-2h pre-arribo): ${f.arrival_deadline_iso ?? '-'}`, en: `Deadline (-2h pre-arrival): ${f.arrival_deadline_iso ?? '-'}`, bold: true },
      { es: '', en: '' },
      { es: 'Campos:', en: 'Fields:', bold: true },
      { es: `  Articulo: ${f.fields.article.common_name}`, en: `  Article: ${f.fields.article.common_name}` },
      { es: `  HTS-10: ${f.fields.article.hts_10}`, en: `  HTS-10: ${f.fields.article.hts_10}` },
      { es: `  Pais de produccion: ${f.fields.article.country_of_production}`, en: `  Country of production: ${f.fields.article.country_of_production}` },
      { es: `  Puerto de entrada: ${f.fields.arrival_information.port_of_entry_code}`, en: `  Port of entry: ${f.fields.arrival_information.port_of_entry_code}` },
      { es: `  Modo: ${f.fields.arrival_information.mode_of_transport}`, en: `  Mode: ${f.fields.arrival_information.mode_of_transport}` },
      { es: `  Importador: ${f.fields.importer.name}`, en: `  Importer: ${f.fields.importer.name}` },
      { es: '', en: '' },
      { es: 'Notas para el agente:', en: 'Broker action notes:', bold: true },
    ];
    for (const n of f.manifest_notes) lines.push({ es: `  - ${n}`, en: `  - ${n}` });
    drawBilingual(p, font, bold, 690, lines);
    drawDisclaimer(p, font);
  }

  // USDA page
  if (manifest.usda?.required) {
    const p = doc.addPage([612, 792]);
    drawHeader(p, bold, font, AGENCY_LABEL_ES.USDA, AGENCY_LABEL_EN.USDA);
    const u = manifest.usda;
    const lines: Array<{ es: string; en: string; bold?: boolean }> = [
      { es: `Razon: ${u.reason_required}`, en: `Reason: ${u.reason_required}` },
      { es: `Formularios aplicables: ${u.forms_applicable.join(' + ')}`, en: `Forms applicable: ${u.forms_applicable.join(' + ')}`, bold: true },
      { es: `Tratamiento: ${u.fields.treatment_required ?? 'ninguno'}`, en: `Treatment: ${u.fields.treatment_required ?? 'none'}` },
      { es: '', en: '' },
      { es: 'Campos:', en: 'Fields:', bold: true },
      { es: `  Especie/mercancia: ${u.fields.species_or_commodity}`, en: `  Species/commodity: ${u.fields.species_or_commodity}` },
      { es: `  Pais de origen: ${u.fields.origin_country}`, en: `  Origin country: ${u.fields.origin_country}` },
      { es: `  Puerto de entrada: ${u.fields.port_of_entry}`, en: `  Port of entry: ${u.fields.port_of_entry}` },
      { es: `  ETA arribo: ${u.fields.arrival_date_eta_iso}`, en: `  Arrival ETA: ${u.fields.arrival_date_eta_iso}` },
      { es: `  Importador: ${u.fields.importer.name}`, en: `  Importer: ${u.fields.importer.name}` },
      { es: '', en: '' },
      { es: 'Notas para el agente:', en: 'Broker action notes:', bold: true },
    ];
    for (const n of u.manifest_notes) lines.push({ es: `  - ${n}`, en: `  - ${n}` });
    drawBilingual(p, font, bold, 690, lines);
    drawDisclaimer(p, font);
  }

  // ISF page
  if (manifest.isf?.required) {
    const p = doc.addPage([612, 792]);
    drawHeader(p, bold, font, AGENCY_LABEL_ES.CBP_ISF, AGENCY_LABEL_EN.CBP_ISF);
    const i = manifest.isf;
    const lines: Array<{ es: string; en: string; bold?: boolean }> = [
      { es: `Razon: ${i.reason_required}`, en: `Reason: ${i.reason_required}` },
      { es: `Plazo (-24h pre-carga): ${i.loading_deadline_iso ?? '-'}`, en: `Deadline (-24h pre-loading): ${i.loading_deadline_iso ?? '-'}`, bold: true },
      { es: `Elementos: ${i.elements_complete.importer_count} importador + ${i.elements_complete.carrier_count} transportista`, en: `Elements: ${i.elements_complete.importer_count} importer + ${i.elements_complete.carrier_count} carrier` },
      { es: '', en: '' },
      { es: 'Elementos:', en: 'Elements:', bold: true },
      { es: `  Pais de origen: ${i.elements.country_of_origin ?? '-'}`, en: `  Country of origin: ${i.elements.country_of_origin ?? '-'}` },
      { es: `  HS-6: ${i.elements.hts_6 ?? '-'}`, en: `  HS-6: ${i.elements.hts_6 ?? '-'}` },
      { es: `  Importador (comprador): ${i.elements.buyer?.name ?? '-'}`, en: `  Importer (buyer): ${i.elements.buyer?.name ?? '-'}` },
      { es: `  Vendedor: ${i.elements.seller?.name ?? '-'}`, en: `  Seller: ${i.elements.seller?.name ?? '-'}` },
      { es: `  Fabricante/proveedor: ${i.elements.manufacturer_supplier?.name ?? '-'}`, en: `  Manufacturer/supplier: ${i.elements.manufacturer_supplier?.name ?? '-'}` },
      { es: '', en: '' },
      { es: 'Notas para el agente:', en: 'Broker action notes:', bold: true },
    ];
    for (const n of i.manifest_notes) lines.push({ es: `  - ${n}`, en: `  - ${n}` });
    drawBilingual(p, font, bold, 690, lines);
    drawDisclaimer(p, font);
  }

  // CBP 7501 page
  if (manifest.cbp_7501?.required) {
    const p = doc.addPage([612, 792]);
    drawHeader(p, bold, font, AGENCY_LABEL_ES.CBP_7501, AGENCY_LABEL_EN.CBP_7501);
    const c = manifest.cbp_7501;
    const item = c.fields.line_items[0];
    const lines: Array<{ es: string; en: string; bold?: boolean }> = [
      { es: `Plazo (10 dias habiles): ${c.filing_deadline_iso}`, en: `Filing deadline (10 business days): ${c.filing_deadline_iso}`, bold: true },
      { es: `Tipo de entrada: ${c.fields.entry_type}`, en: `Entry type: ${c.fields.entry_type}` },
      { es: `Puerto de entrada: ${c.fields.port_of_entry_code}`, en: `Port of entry: ${c.fields.port_of_entry_code}` },
      { es: `Modo de transporte: ${c.fields.mode_of_transport}`, en: `Mode of transport: ${c.fields.mode_of_transport}` },
      { es: `BOL: ${c.fields.bill_of_lading ?? '-'}`, en: `BOL: ${c.fields.bill_of_lading ?? '-'}` },
      { es: `Importador: ${c.fields.importer_of_record.name} (EIN: ${c.fields.importer_of_record.ein})`, en: `Importer of Record: ${c.fields.importer_of_record.name} (EIN: ${c.fields.importer_of_record.ein})` },
      { es: '', en: '' },
      { es: 'Linea de articulo:', en: 'Line item:', bold: true },
      { es: `  HTS-10: ${item.hts_10}`, en: `  HTS-10: ${item.hts_10}` },
      { es: `  Descripcion: ${item.description}`, en: `  Description: ${item.description}` },
      { es: `  Valor: $${item.value_usd.toFixed(2)}`, en: `  Value: $${item.value_usd.toFixed(2)}` },
      { es: `  Tasa de arancel: ${item.duty_rate_pct}%`, en: `  Duty rate: ${item.duty_rate_pct}%` },
      { es: `  Arancel: $${item.duty_usd.toFixed(2)}`, en: `  Duty: $${item.duty_usd.toFixed(2)}` },
      { es: `  TLC reclamado: ${item.fta_claimed}${item.fta_criterion ? ' (criterio ' + item.fta_criterion + ')' : ''}`, en: `  FTA claimed: ${item.fta_claimed}${item.fta_criterion ? ' (criterion ' + item.fta_criterion + ')' : ''}` },
      { es: '', en: '' },
      { es: 'Totales:', en: 'Totals:', bold: true },
      { es: `  Total factura: $${c.fields.invoice_total.toFixed(2)}`, en: `  Invoice total: $${c.fields.invoice_total.toFixed(2)}` },
      { es: `  Arancel total: $${c.fields.duty_total.toFixed(2)}`, en: `  Duty total: $${c.fields.duty_total.toFixed(2)}` },
      { es: `  Ahorro USMCA: $${c.fields.fta_savings_usd.toFixed(2)}`, en: `  USMCA savings: $${c.fields.fta_savings_usd.toFixed(2)}` },
      { es: '', en: '' },
      { es: 'Notas para el agente:', en: 'Broker action notes:', bold: true },
    ];
    for (const n of c.manifest_notes) lines.push({ es: `  - ${n}`, en: `  - ${n}` });
    drawBilingual(p, font, bold, 690, lines);
    drawDisclaimer(p, font);
  }

  return doc.save();
}
