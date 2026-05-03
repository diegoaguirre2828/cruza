import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/chassis/docs/vision-provider';
import { classifyDocument } from '@/lib/chassis/docs/classifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const vision = await extractText({ bytes, mime_type: file.type, language_hint: 'auto' });
  const cls = classifyDocument(vision);
  return NextResponse.json({ classification: cls, ocr_confidence: vision.doc_level_confidence });
}
