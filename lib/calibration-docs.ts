import { createClient } from '@supabase/supabase-js';
import type { DocType, VisionProvider } from './chassis/docs/types';

export interface DocLogEntry {
  ticket_id: string | null;
  shipment_ref: string | null;
  source_blob_url: string | null;
  source_filename: string | null;
  source_mime_type: string | null;
  page_index: number;
  page_count: number;
  doc_type: DocType;
  classifier_confidence: number;
  fields_extracted: unknown;
  extraction_confidence: number;
  vision_provider: VisionProvider;
  flags: Record<string, boolean>;
  duration_ms: number;
  caller: string;
}

export async function logDocExtraction(entry: DocLogEntry): Promise<void> {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supa.from('doc_extractions').insert(entry);
  if (error) console.error('[docs] logDocExtraction insert failed:', error.message);
}
