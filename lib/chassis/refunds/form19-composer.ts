// lib/chassis/refunds/form19-composer.ts
// For entries past the 80-day cliff but within 180-day protest window,
// compose a CBP Form 19 protest packet (PDF) that the IOR files via ACE
// Protest module or at port of entry.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Entry, IorProfile, Form19Field, CliffRouting } from './types';
import { computeInterest } from './interest-calculator';

const LEGAL_BASIS = 'Trump v. V.O.S. Selections / Learning Resources, Inc. v. Trump (S. Ct. Feb. 20, 2026); IEEPA does not authorize the imposition of tariffs. Liquidation including IEEPA duties is contrary to law.';

export async function composeForm19Packet(
  ior: IorProfile,
  entries: Entry[],
  routings: CliffRouting[],
  ieepaPrincipalByEntry: Map<string, number>,
): Promise<Uint8Array> {
  const protestEntries = entries.filter(e => {
    const r = routings.find(x => x.entry_number === e.entry_number);
    return r?.cliff_status === 'protest_required';
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Cover page
  const cover = pdf.addPage([612, 792]);  // US Letter
  let y = 740;
  cover.drawText('CBP FORM 19 — PROTEST PACKET', { x: 50, y, size: 18, font: fontBold });
  y -= 30;
  cover.drawText(`Importer of Record: ${ior.ior_name}`, { x: 50, y, size: 12, font });
  y -= 18;
  cover.drawText(`IOR Number: ${ior.ior_id_number}`, { x: 50, y, size: 12, font });
  y -= 18;
  cover.drawText(`Total entries protested: ${protestEntries.length}`, { x: 50, y, size: 12, font });
  y -= 30;
  cover.drawText('Legal Basis:', { x: 50, y, size: 12, font: fontBold });
  y -= 16;
  // Wrap legal basis
  const wrapped = wrapText(LEGAL_BASIS, 70);
  for (const line of wrapped) {
    cover.drawText(line, { x: 50, y, size: 11, font });
    y -= 14;
  }
  y -= 20;
  cover.drawText('FILING INSTRUCTIONS:', { x: 50, y, size: 12, font: fontBold });
  y -= 16;
  cover.drawText('1. File via ACE Protest Module OR at the port of entry where original CBP decision occurred.', { x: 50, y, size: 10, font });
  y -= 14;
  cover.drawText('2. Each entry below has its own protest-deadline date — file before that date.', { x: 50, y, size: 10, font });
  y -= 14;
  cover.drawText('3. Save submission confirmation; track via ACE Protest module.', { x: 50, y, size: 10, font });

  // Per-entry pages
  for (const entry of protestEntries) {
    const routing = routings.find(r => r.entry_number === entry.entry_number)!;
    const principal = ieepaPrincipalByEntry.get(entry.entry_number) ?? 0;
    const interest = computeInterest(entry.entry_number, principal, entry.entry_date, new Date().toISOString());

    const page = pdf.addPage([612, 792]);
    let py = 740;
    page.drawText(`Protest — Entry ${entry.entry_number}`, { x: 50, y: py, size: 14, font: fontBold });
    py -= 24;
    page.drawText(`Liquidation Date: ${entry.liquidation_date}`, { x: 50, y: py, size: 11, font });
    py -= 16;
    page.drawText(`Protest Deadline: ${routing.protest_deadline}`, { x: 50, y: py, size: 11, font: fontBold, color: rgb(0.7, 0.1, 0.1) });
    py -= 16;
    page.drawText(`Country of Origin: ${entry.country_of_origin}`, { x: 50, y: py, size: 11, font });
    py -= 16;
    page.drawText(`IEEPA Principal: $${principal.toFixed(2)}`, { x: 50, y: py, size: 11, font });
    py -= 16;
    page.drawText(`Interest (estimated): $${interest.interest_usd.toFixed(2)}`, { x: 50, y: py, size: 11, font });
    py -= 16;
    page.drawText(`Total Recovery Sought: $${(principal + interest.interest_usd).toFixed(2)}`, { x: 50, y: py, size: 11, font: fontBold });
    py -= 24;
    page.drawText('Decision Protested:', { x: 50, y: py, size: 11, font: fontBold });
    py -= 16;
    page.drawText('Liquidation including IEEPA duties under invalid statutory authority.', { x: 50, y: py, size: 10, font });
    py -= 24;
    page.drawText('Signature: ____________________________   Date: __________', { x: 50, y: py, size: 11, font });
  }

  return pdf.save();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).length > maxChars && cur.length > 0) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
