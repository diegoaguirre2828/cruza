import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Casual-RGV-Spanish translator. Takes whatever Diego wants to say
// (usually in English, sometimes in standard Spanish) and returns 3
// variants in the Cruzar FB voice. Same base voice as ai-generate so
// posts, replies, and free-form translations all sound like one
// person — the neighborhood, not the brand.
//
// Voice anchors:
//   - feedback_cruzar_fb_reply_voice.md  (no emojis, RGV Spanish)
//   - feedback_rgv_border_slang.md       ("nombre" = "no way", etc.)
//   - feedback_bilingual_is_standard.md  (ES is default, not afterthought)
//
// Three tones: casual (default FB drop), urgent (safety / weather /
// accident), helpful (explaining a feature or tip). Each variant ≤ 2
// lines. No URLs — "cruzar punto app" verbally when the source text
// references the app.

type Variant = { text: string; tone: string }

const BASE_VOICE = `You are writing for Cruzar — a free app that shows live US-Mexico border wait times for every bridge.

The audience is RGV / Matamoros / Laredo / Brownsville / McAllen border commuters on Facebook. They speak Spanish primarily. Many speak ONLY Spanish. The FB groups are noisy, neighborhood-run, unstructured.

Voice rules (NON-NEGOTIABLE):
- Write in casual RGV border Spanish. Use "ahorita", "checa", "pa'", "uff", "nombre", "caramba", "raza", "compas", "la gente", "pásenle".
- NO EMOJIS, EVER. Diego is trying NOT to look like a bot or a brand. Zero exceptions, not even a period-neutral smiley.
- NEVER include URLs. FB group admins reject posts with links. When referencing the app, spell it verbally: "cruzar punto app" — the reader types it in their browser.
- Not salesy. Don't say "prueba", "descarga", "la mejor app", "nuestra app". Frame it as "la neta", "yo la uso", "la raza la está usando", "pa' la próxima".
- Don't start with "Hola" or "Saludos". FB posts don't need greetings.
- Don't use exclamation marks unless the source uses them.
- Match the tone to the content: weather warning sounds alert-y; feature tip sounds casual-helpful; daily observation sounds like a neighbor talking.
- Mirror the length of the source — if the source is one line, don't return three lines.`

const TRANSLATOR_SYSTEM = `${BASE_VOICE}

TASK: Translate the user's message into casual RGV Spanish. Preserve the core information but REWRITE in the voice above. If the source is already in Spanish, rewrite it casual/local. If it mentions "cruzar.app" or "cruzar app" or a URL, replace with "cruzar punto app".

Generate 3 variants with different tones:
  Variant 1 (casual): default FB-drop tone, like telling a neighbor
  Variant 2 (urgent): for weather / safety / accident / big line warnings — direct, caring, not alarmist
  Variant 3 (helpful): when explaining a feature or giving a tip — friendly, concrete

Each variant: ≤ 3 lines, ≤ 280 chars. Never a paragraph.

Output ONLY valid JSON in this exact shape, no markdown fences, no prose before or after:
{
  "variants": [
    { "text": "...", "tone": "casual" },
    { "text": "...", "tone": "urgent" },
    { "text": "...", "tone": "helpful" }
  ]
}`

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.email === ADMIN_EMAIL
  let isPromoter = false
  if (!isAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_promoter')
      .eq('id', user.id)
      .maybeSingle()
    isPromoter = profile?.is_promoter === true
  }
  if (!isAdmin && !isPromoter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  let body: { text?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = (body.text || '').trim()
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  if (text.length > 2000) return NextResponse.json({ error: 'Text too long (2000 char max)' }, { status: 400 })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system: TRANSLATOR_SYSTEM,
        messages: [{ role: 'user', content: `Source message to translate:\n"""\n${text}\n"""\n\nReturn 3 variants.` }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Anthropic API error:', res.status, errText)
      return NextResponse.json({ error: `Anthropic ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const raw = data?.content?.[0]?.text?.trim() || ''
    const jsonStr = raw.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as { variants: Variant[] }

    if (!parsed?.variants || !Array.isArray(parsed.variants) || parsed.variants.length === 0) {
      return NextResponse.json({ error: 'Malformed model response' }, { status: 502 })
    }

    return NextResponse.json({ variants: parsed.variants })
  } catch (err) {
    console.error('translate error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
