// lib/chassis/docs/mx-health-cert.ts
// Mexican health certificate validator. Two critical rules per SENASICA/SAGARPA:
// 1. Must be single-sided (no back-side scan with substantive text)
// 2. No handwritten corrections (every field must be printed)
//
// v1 heuristic: tesseract.js v7 emits page-level confidence, not per-word.
// Handwriting flag fires when: page_confidence < THRESHOLD AND text has >= MIN_WORDS_FOR_HANDWRITING_CHECK.
// False positives acceptable (broker reviews); false negatives are NOT (better to over-flag).
// v2: swap in per-word confidence (tesseract recognize options) or a vision-LLM stroke classifier.

import sharp from 'sharp';
import type { MxHealthCertificateFlags, VisionResult } from './types';

interface ValidationInput {
  page_count: number;          // 1 = single-sided OK; >1 = potentially double-sided
  primary_vision: VisionResult; // OCR result of the front side
  secondary_vision?: VisionResult; // back side, if broker uploaded 2 pages
  primary_image_bytes?: Uint8Array; // raw image for sharp metadata extraction (optional)
}

const HANDWRITING_PAGE_CONF_THRESHOLD = 0.65;  // page conf below this = suspect handwriting
const MIN_WORDS_FOR_HANDWRITING_CHECK = 20;     // need enough text to make the heuristic meaningful
const BACK_PAGE_BLANK_THRESHOLD = 20;            // if back-side text is < this many chars, treat as blank

export async function validateMxHealthCertificate(input: ValidationInput): Promise<MxHealthCertificateFlags> {
  // Rule 1: Single-sided check
  const single_sided = input.page_count === 1;

  // If broker uploaded 2 pages, check whether the second page is essentially blank
  let effective_single_sided = single_sided;
  if (!single_sided && input.secondary_vision) {
    const trimmed = input.secondary_vision.text.replace(/\s+/g, '');
    if (trimmed.length < BACK_PAGE_BLANK_THRESHOLD) {
      // Back side is essentially blank — still passes (broker scanned blank back)
      effective_single_sided = true;
    }
  }

  // Rule 2: Handwriting heuristic — page-level confidence + substantial text
  let handwriting_detected = false;
  const wordCount = input.primary_vision.text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount >= MIN_WORDS_FOR_HANDWRITING_CHECK && input.primary_vision.doc_level_confidence < HANDWRITING_PAGE_CONF_THRESHOLD) {
    handwriting_detected = true;
  }

  // Scan quality score = doc-level confidence (already 0-1)
  const scan_quality_score = input.primary_vision.doc_level_confidence;
  const fields_legible = scan_quality_score > 0.6;

  return {
    single_sided: effective_single_sided,
    handwriting_detected,
    fields_legible,
    scan_quality_score: +scan_quality_score.toFixed(4),
  };
}

// Utility for the API route — extract metadata from an image buffer
export async function imageMetadata(bytes: Uint8Array): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(Buffer.from(bytes)).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? 'unknown',
  };
}
