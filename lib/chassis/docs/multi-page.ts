// lib/chassis/docs/multi-page.ts
// Multi-page document handler: split → vision-extract per page → classify per page → aggregate.
//
// PDF split utility uses pdf-lib (already a Cruzar dep) to extract per-page sub-PDFs,
// but does NOT rasterize to images. Image rasterization for OCR is deferred to v1.5
// (will likely use mupdf or pdf2pic). For v1, the broker uploads multi-page IMAGES.

import { PDFDocument } from 'pdf-lib';
import type { MultiPageInput, MultiPageResult } from './types';
import { extractText } from './vision-provider';
import { classifyDocument } from './classifier';
import { extractFields } from './extractor';

/**
 * Splits a PDF into per-page sub-PDFs (still PDFs, not images).
 * Useful for archival or further processing. To OCR these, the caller must rasterize
 * to PNG via an external rasterizer first (deferred to v1.5).
 */
export async function splitPdf(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdfBytes);
  const pages: Uint8Array[] = [];
  const total = src.getPageCount();
  for (let i = 0; i < total; i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    pages.push(await out.save());
  }
  return pages;
}

/**
 * Process a multi-page document where each page is already an image (PNG/JPEG).
 * Runs vision → classify → extract on each page in sequence.
 */
export async function processMultiPage(input: MultiPageInput): Promise<MultiPageResult> {
  const perPage: MultiPageResult['per_page'] = [];
  for (let i = 0; i < input.pages.length; i++) {
    const vision = await extractText(input.pages[i]);
    const classification = classifyDocument(vision);
    const extraction = extractFields(classification.doc_type, vision);
    perPage.push({ page_index: i, classification, extraction });
  }
  return { page_count: input.pages.length, per_page: perPage };
}
