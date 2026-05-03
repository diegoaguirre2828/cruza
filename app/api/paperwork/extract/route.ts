import { NextRequest, NextResponse } from 'next/server';
import { composePaperwork } from '@/lib/chassis/docs/composer';
import { logDocExtraction } from '@/lib/calibration-docs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  const shipment_ref = form.get('shipment_ref') as string | null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { composition, per_page } = await composePaperwork({
    pages: [{ bytes, mime_type: file.type, language_hint: 'auto' }],
  });

  // Log each extracted page
  for (let i = 0; i < per_page.length; i++) {
    const ex = per_page[i];
    await logDocExtraction({
      ticket_id: null,
      shipment_ref,
      source_blob_url: null,
      source_filename: file.name,
      source_mime_type: file.type,
      page_index: i,
      page_count: per_page.length,
      doc_type: ex.doc_type,
      classifier_confidence: composition.documents_extracted[i]?.confidence ?? 0,
      fields_extracted: ex.fields,
      extraction_confidence: ex.doc_level_confidence,
      vision_provider: ex.provider_used,
      flags: ex.flags,
      duration_ms: 0,
      caller: 'api/paperwork/extract',
    });
  }

  return NextResponse.json({ composition, per_page });
}
