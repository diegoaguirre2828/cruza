import { NextRequest, NextResponse } from 'next/server';
import { extractText } from '@/lib/chassis/docs/vision-provider';
import { validateMxHealthCertificate } from '@/lib/chassis/docs/mx-health-cert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const files = form.getAll('files');
  if (files.length === 0) return NextResponse.json({ error: 'files field required (1 or 2 pages)' }, { status: 400 });

  const visions = await Promise.all(files.map(async f => {
    if (!(f instanceof File)) throw new Error('non-file in files field');
    const bytes = new Uint8Array(await f.arrayBuffer());
    return extractText({ bytes, mime_type: f.type, language_hint: 'es' });
  }));

  const flags = await validateMxHealthCertificate({
    page_count: visions.length,
    primary_vision: visions[0],
    secondary_vision: visions[1],
  });

  return NextResponse.json({ flags, page_count: visions.length });
}
