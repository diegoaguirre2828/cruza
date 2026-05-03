// lib/ticket/pdf.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SignedTicket } from './types';
import { generateTicketQrPngBuffer } from './qr';
import { TICKET_EN } from '../copy/ticket-en';
import { TICKET_ES } from '../copy/ticket-es';

interface RenderOptions {
  baseUrl?: string;
}

/**
 * Renders a bilingual EN/ES side-by-side single-page PDF.
 * ES on the left half, EN on the right half. QR + verify URL at bottom.
 */
export async function renderTicketPdf(signed: SignedTicket, opts: RenderOptions = {}): Promise<Uint8Array> {
  const { payload, content_hash } = signed;
  const baseUrl = opts.baseUrl ?? 'https://cruzar.app';

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter portrait
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const leftX = 30;   // ES column
  const rightX = 320; // EN column

  // Header (full width)
  page.drawText('Cruzar - Boleto / Ticket', { x: 30, y: 750, size: 18, font: bold, color: rgb(0.06, 0.09, 0.16) });
  page.drawText(payload.ticket_id, { x: 30, y: 730, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: 30, y: 720 }, end: { x: 582, y: 720 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  let yEs = 700;
  let yEn = 700;
  const lineH = 14;

  function drawSection(es: string, en: string) {
    page.drawText(es, { x: leftX, y: yEs, size: 10, font: bold, color: rgb(0.06, 0.09, 0.16) });
    page.drawText(en, { x: rightX, y: yEn, size: 10, font: bold, color: rgb(0.06, 0.09, 0.16) });
    yEs -= lineH; yEn -= lineH;
  }
  function drawLine2(esLabel: string, enLabel: string, value: string) {
    page.drawText(`${esLabel}: ${value}`, { x: leftX, y: yEs, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`${enLabel}: ${value}`, { x: rightX, y: yEn, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    yEs -= lineH; yEn -= lineH;
  }

  drawSection(TICKET_ES.shipment_section, TICKET_EN.shipment_section);
  drawLine2(TICKET_ES.origin, TICKET_EN.origin, `${payload.shipment.origin.country}${payload.shipment.origin.city ? ' / ' + payload.shipment.origin.city : ''}`);
  drawLine2(TICKET_ES.destination, TICKET_EN.destination, `${payload.shipment.destination.country}${payload.shipment.destination.port_code ? ' (' + payload.shipment.destination.port_code + ')' : ''}`);
  if (payload.shipment.importer_name) drawLine2(TICKET_ES.importer, TICKET_EN.importer, payload.shipment.importer_name);
  if (payload.shipment.bol_ref) drawLine2(TICKET_ES.bol_ref, TICKET_EN.bol_ref, payload.shipment.bol_ref);

  yEs -= 6; yEn -= 6;
  drawSection(TICKET_ES.customs_section, TICKET_EN.customs_section);
  if (payload.customs) {
    drawLine2(TICKET_ES.hs_classification, TICKET_EN.hs_classification, `${payload.customs.hs_classification.hts_10}`);
    drawLine2(TICKET_ES.origin_status, TICKET_EN.origin_status, payload.customs.origin.usmca_originating ? `OK ${TICKET_ES.usmca_originating}` : `X ${TICKET_ES.not_originating}`);
    drawLine2(TICKET_ES.ligie_status, TICKET_EN.ligie_status, payload.customs.origin.ligie.affected ? `! ${payload.customs.origin.ligie.rate_pct}%` : `OK ${TICKET_ES.ligie_clear}`);
    if (payload.customs.rvc.transaction_value_pct != null) {
      drawLine2(TICKET_ES.rvc_status, TICKET_EN.rvc_status, `TV ${payload.customs.rvc.transaction_value_pct}% / NC ${payload.customs.rvc.net_cost_pct ?? '-'}%`);
    }
  }

  if (payload.regulatory) {
    yEs -= 6; yEn -= 6;
    drawSection(TICKET_ES.regulatory_section, TICKET_EN.regulatory_section);
    drawLine2(
      TICKET_ES.agencies_required,
      TICKET_EN.agencies_required,
      payload.regulatory.agencies_required.join(', '),
    );
    drawLine2(
      TICKET_ES.earliest_deadline,
      TICKET_EN.earliest_deadline,
      payload.regulatory.earliest_deadline_iso ?? '-',
    );
  }

  if (payload.paperwork) {
    yEs -= 6; yEn -= 6;
    drawSection(TICKET_ES.paperwork_section, TICKET_EN.paperwork_section);
    drawLine2(TICKET_ES.documents, TICKET_EN.documents, String(payload.paperwork.doc_count));
    if (payload.paperwork.blocking_issues.length > 0) {
      drawLine2(TICKET_ES.blocking, TICKET_EN.blocking, String(payload.paperwork.blocking_issues.length));
    }
  }

  yEs -= 6; yEn -= 6;
  drawSection(TICKET_ES.audit_shield, TICKET_EN.audit_shield);
  drawLine2(TICKET_ES.prior_disclosure, TICKET_EN.prior_disclosure, payload.audit_shield.prior_disclosure_eligible ? 'OK' : 'X');

  // QR + verify URL at the bottom (full width)
  const qrPng = await generateTicketQrPngBuffer(payload.ticket_id, content_hash, baseUrl);
  const qrImg = await doc.embedPng(qrPng);
  page.drawImage(qrImg, { x: 30, y: 30, width: 90, height: 90 });
  page.drawText(`${TICKET_ES.verify_at} / ${TICKET_EN.verify_at}:`, { x: 130, y: 90, size: 9, font: bold });
  page.drawText(`${baseUrl}/ticket/${payload.ticket_id}`, { x: 130, y: 78, size: 8, font, color: rgb(0.15, 0.36, 0.72) });
  page.drawText(`${TICKET_ES.disclaimer}`, { x: 130, y: 60, size: 7, font, color: rgb(0.4, 0.4, 0.4), maxWidth: 440 });
  page.drawText(`${TICKET_EN.disclaimer}`, { x: 130, y: 42, size: 7, font, color: rgb(0.4, 0.4, 0.4), maxWidth: 440 });

  return doc.save();
}
