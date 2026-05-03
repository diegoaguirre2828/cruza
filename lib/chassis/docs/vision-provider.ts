// lib/chassis/docs/vision-provider.ts
// Vision-provider abstraction. Default: Tesseract (local, free).
// Opt-in: Claude Vision (Anthropic API), Nemotron Nano Omni (OpenRouter free tier).

import { createWorker } from 'tesseract.js';
import { homedir } from 'os';
import { resolve as resolvePath } from 'path';
import type { VisionInput, VisionResult, VisionProvider } from './types';

const TESSERACT_CACHE_PATH = resolvePath(homedir(), '.cache/tesseract-cruzar');

function selectedProvider(): VisionProvider {
  const p = (process.env.CRUZAR_VISION_PROVIDER ?? 'tesseract').toLowerCase();
  if (p === 'claude' || p === 'nemotron' || p === 'tesseract') return p;
  return 'tesseract';
}

// ── Tesseract adapter ──────────────────────────────────────────────────────
async function tesseractExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const lang = input.language_hint === 'es' ? 'spa' : input.language_hint === 'auto' ? 'eng+spa' : 'eng';
  const worker = await createWorker(lang, undefined, {
    cachePath: TESSERACT_CACHE_PATH,
  });
  try {
    // tesseract.js v7: data.confidence is page-level (0-100). data.words may not be populated by default.
    const recognizeResult = await worker.recognize(Buffer.from(input.bytes));
    const data = recognizeResult.data as { text: string; confidence: number; words?: Array<{ confidence?: number }> };
    const wordConfs = (data.words ?? []).map(w => (w.confidence ?? 0) / 100);
    const docConf = (data.confidence ?? 0) / 100;
    return {
      text: data.text,
      word_confidences: wordConfs,
      doc_level_confidence: docConf,
      provider: 'tesseract',
      duration_ms: Date.now() - t0,
    };
  } finally {
    await worker.terminate();
  }
}

// ── Claude Vision adapter (opt-in) ─────────────────────────────────────────
async function claudeExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CRUZAR_VISION_PROVIDER=claude requires ANTHROPIC_API_KEY');
  // Lazy-import to keep tesseract-only deployments lean
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const b64 = Buffer.from(input.bytes).toString('base64');
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: input.mime_type as 'image/png' | 'image/jpeg', data: b64 } },
        { type: 'text', text: 'Extract ALL text visible in this document, preserving structure and line breaks. Output the raw text only — no summary, no commentary.' },
      ],
    }],
  });
  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');
  return {
    text,
    word_confidences: [],         // Claude doesn't emit per-word confidence
    doc_level_confidence: 0.92,   // calibrated heuristic for Haiku Vision
    provider: 'claude',
    duration_ms: Date.now() - t0,
  };
}

// ── Nemotron adapter (OpenRouter, free tier) ───────────────────────────────
async function nemotronExtract(input: VisionInput): Promise<VisionResult> {
  const t0 = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('CRUZAR_VISION_PROVIDER=nemotron requires OPENROUTER_API_KEY');
  const b64 = Buffer.from(input.bytes).toString('base64');
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'nvidia/nemotron-nano-9b-v2:free',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${input.mime_type};base64,${b64}` } },
          { type: 'text', text: 'Extract ALL text visible in this document, preserving structure. Raw text only.' },
        ],
      }],
      max_tokens: 4096,
    }),
  });
  if (!resp.ok) throw new Error(`Nemotron extract failed: ${resp.status} ${await resp.text()}`);
  const body = await resp.json() as { choices: Array<{ message: { content: string } }> };
  const text = body.choices[0]?.message?.content ?? '';
  return {
    text,
    word_confidences: [],
    doc_level_confidence: 0.85,   // calibrated heuristic for Nemotron Nano free tier
    provider: 'nemotron',
    duration_ms: Date.now() - t0,
  };
}

export async function extractText(input: VisionInput, providerOverride?: VisionProvider): Promise<VisionResult> {
  const provider = providerOverride ?? selectedProvider();
  if (provider === 'claude') return claudeExtract(input);
  if (provider === 'nemotron') return nemotronExtract(input);
  return tesseractExtract(input);
}

export function activeProvider(): VisionProvider {
  return selectedProvider();
}
