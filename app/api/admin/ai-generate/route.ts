import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// General-purpose Claude-backed content generator for Diego's promoter
// + admin workflows. Three types:
//
//   type = 'reply'    → generate 3 short Spanish replies to a pasted FB
//                       group post or comment
//   type = 'post'     → generate 3 new promoter post variants (call-to-
//                       action format, no URLs, "cruzar.app" verbal)
//   type = 'comment'  → generate 3 short comment-style replies (1-sentence,
//                       casual, no greeting)
//
// Shares a single "Cruzar voice" base prompt so every type sounds like
// the same brand. Gated to admin + promoter users.

type Variant = { text: string; tone: string }
type GenType = 'reply' | 'post' | 'comment'

const BASE_VOICE = `You are writing for Cruzar — a free app that shows live US-Mexico border wait times for every bridge.

The audience is RGV / Matamoros / Laredo border commuters on Facebook. They are mostly Spanish speakers. The FB groups are noisy and unstructured.

Voice rules (NON-NEGOTIABLE):
- Write in casual RGV border Spanish. Use "ahorita", "checa", "pa'", "uff", "caramba", "raza", "compas", "la gente".
- NO EMOJIS, EVER. The user is trying NOT to look like a bot. Zero exceptions.
- The app is cruzar.app. Use that exact form when referencing the app. Don't include other URLs (FB groups still reject deep links).
- Never salesy. Don't say "prueba", "descarga", "echenle un ojo a nuestra app", "la mejor app". Frame Cruzar as "the thing I use" / "the thing the community uses" / "pa' la próxima".
- Don't use exclamation marks unless the user's input used them.
- Don't start with "Hola" — FB replies don't need greetings.
- Keep the brand voice local, not corporate. Neighborhood, not marketing.`

const PROMPT_BY_TYPE: Record<GenType, { system: string; user: (ctx: string) => string }> = {
  reply: {
    system: `${BASE_VOICE}

TASK: Generate 3 short Spanish replies to a Facebook post or comment that someone has pasted below.

Each reply:
- 1–3 sentences, never a paragraph
- Acknowledges the specific content of the post first, then drops the Cruzar mention naturally
- Three tones:
    Variant 1 (empathetic): validate their experience first, then mention Cruzar
    Variant 2 (practical): lead with the tip — how Cruzar helps in this exact situation
    Variant 3 (community): frame Cruzar as what everyone in the group uses

Output ONLY valid JSON in this exact shape, no markdown fences:
{
  "variants": [
    { "text": "...", "tone": "empathetic" },
    { "text": "...", "tone": "practical" },
    { "text": "...", "tone": "community" }
  ]
}`,
    user: (ctx: string) => `Post/comment from the FB group:\n"""\n${ctx}\n"""\n\nGenerate 3 variants.`,
  },
  post: {
    system: `${BASE_VOICE}

TASK: Generate 3 promoter-style POSTS for a Facebook border-crossing group. The user will describe a situation or angle ("it's a busy Friday", "people are complaining about Pharr line", "holiday week ahead") and you generate 3 post variants they can paste into FB groups.

Each post:
- 2–5 lines maximum. Short, scannable, neighborhood voice.
- One clear hook at the top (an observation about the situation, NOT a sales line)
- Mentions cruzar.app verbally at least once but NOT as the opening line
- Different angles across the 3 variants:
    Variant 1 (observation): starts from a shared experience ("este finde se puso pesado")
    Variant 2 (tip): leads with a practical tip for crossing smarter
    Variant 3 (community): frames cruzar.app as what the community uses

Output ONLY valid JSON in this exact shape, no markdown fences:
{
  "variants": [
    { "text": "...", "tone": "observation" },
    { "text": "...", "tone": "tip" },
    { "text": "...", "tone": "community" }
  ]
}`,
    user: (ctx: string) => `Situation / angle for the post:\n"""\n${ctx}\n"""\n\nGenerate 3 post variants.`,
  },
  comment: {
    system: `${BASE_VOICE}

TASK: Generate 3 SHORT comment-style replies — the kind you drop under someone else's FB post.

Each comment:
- ONE sentence, maximum two. Never longer.
- Casual, natural, sounds like a neighbor
- Mentions cruzar.app verbally, but gently (not sales)
- Three tones:
    Variant 1 (supportive): short agreement + tip
    Variant 2 (practical): direct instruction / "tecleen cruzar.app en su navegador"
    Variant 3 (light): friendly one-liner

Output ONLY valid JSON in this exact shape, no markdown fences:
{
  "variants": [
    { "text": "...", "tone": "supportive" },
    { "text": "...", "tone": "practical" },
    { "text": "...", "tone": "light" }
  ]
}`,
    user: (ctx: string) => `Thread/post we're commenting under:\n"""\n${ctx}\n"""\n\nGenerate 3 short comments.`,
  },
}

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function POST(req: NextRequest) {
  // Auth: admin OR promoter. Promoters need this too — it's literally
  // their daily tool for generating FB content.
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

  let body: { type?: GenType; context?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body.type
  if (type !== 'reply' && type !== 'post' && type !== 'comment') {
    return NextResponse.json({ error: 'type must be reply | post | comment' }, { status: 400 })
  }
  const context = (body.context || '').trim()
  if (!context) return NextResponse.json({ error: 'Missing context' }, { status: 400 })
  if (context.length > 4000) return NextResponse.json({ error: 'Context too long (4000 char max)' }, { status: 400 })

  const promptConfig = PROMPT_BY_TYPE[type]

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
        max_tokens: 1200,
        system: [{ type: 'text', text: promptConfig.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: promptConfig.user(context) }],
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

    return NextResponse.json({ type, variants: parsed.variants })
  } catch (err) {
    console.error('ai-generate error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
