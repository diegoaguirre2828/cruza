import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import { CRUZAR_VOICE_SYSTEM_PROMPT, CRUZAR_VOICE_VERSION, factsBlock } from "@/lib/cruzarVoice"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Reads up to N undrafted non-dismissed spikes from `port_spikes`,
 * generates a bilingual FB post draft via Anthropic, and writes it to
 * `post_drafts` (status=pending). Also flips the spike's `drafted` flag
 * and links `draft_id` back.
 *
 * Auth: CRON_SECRET via `?secret=` or `Authorization: Bearer`.
 * Intended caller: cron-job.org, every 15 min (runs after detect-spikes).
 */

const MAX_PER_RUN = 8
const MODEL = "claude-haiku-4-5-20251001" // cheap, fast, good enough for short posts

const LANE_LABEL_ES: Record<string, string> = {
  vehicle: "línea regular",
  sentri: "SENTRI",
  pedestrian: "peatonal",
  commercial: "comercial",
}
const LANE_LABEL_EN: Record<string, string> = {
  vehicle: "regular lane",
  sentri: "SENTRI",
  pedestrian: "pedestrian",
  commercial: "commercial",
}

function isAuthed(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret")
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return secret === cronSecret || authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const anthropic = new Anthropic({ apiKey })

  const { data: spikes, error: spikesErr } = await supabase
    .from("port_spikes")
    .select("id, port_id, port_name, region, lane, current_wait, baseline_wait, delta_minutes, delta_pct, severity")
    .eq("drafted", false)
    .eq("dismissed", false)
    .order("detected_at", { ascending: true })
    .limit(MAX_PER_RUN)

  if (spikesErr) {
    return NextResponse.json({ error: spikesErr.message }, { status: 500 })
  }
  if (!spikes || spikes.length === 0) {
    return NextResponse.json({ ok: true, drafted: 0, note: "no open spikes" })
  }

  const results: Array<{ spikeId: number; draftId: number | null; error?: string }> = []

  for (const s of spikes) {
    const portLabel = s.port_name ?? s.port_id
    const laneEs = LANE_LABEL_ES[s.lane] ?? s.lane
    const laneEn = LANE_LABEL_EN[s.lane] ?? s.lane

    const userPromptEs = `Escribe UN post corto para Facebook (3-5 líneas, en español RGV, sin emojis) avisando de una subida de tiempo en el puente ${portLabel}.

${factsBlock({
  puente: portLabel,
  tipo_linea: laneEs,
  tiempo_ahora_min: s.current_wait,
  tiempo_normal_min: s.baseline_wait,
  subida_min: s.delta_minutes,
  severidad: s.severity,
})}

Termina con: "Tiempos en vivo en cruzar.app"
Devuelve SOLO el texto del post. Nada más.`

    const userPromptEn = `Write ONE short Facebook post (3-5 lines, casual RGV English, no emojis) warning about a wait-time spike at the ${portLabel} bridge.

${factsBlock({
  bridge: portLabel,
  lane_type: laneEn,
  current_min: s.current_wait,
  typical_min: s.baseline_wait,
  spike_min: s.delta_minutes,
  severity: s.severity,
})}

End with: "Live times at cruzar.app"
Return ONLY the post text. Nothing else.`

    try {
      const [esMsg, enMsg] = await Promise.all([
        anthropic.messages.create({
          model: MODEL,
          max_tokens: 400,
          temperature: 0.6,
          system: CRUZAR_VOICE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPromptEs }],
        }),
        anthropic.messages.create({
          model: MODEL,
          max_tokens: 400,
          temperature: 0.6,
          system: CRUZAR_VOICE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPromptEn }],
        }),
      ])

      const captionEs = esMsg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("")
        .trim()
      const captionEn = enMsg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("")
        .trim()

      if (!captionEs) throw new Error("empty ES caption")

      const { data: draftRow, error: insertErr } = await supabase
        .from("post_drafts")
        .insert({
          source_kind: "spike",
          source_ref_id: s.id,
          port_id: s.port_id,
          region: s.region,
          caption_es: captionEs,
          caption_en: captionEn || null,
          landing_url: "https://cruzar.app",
          model: MODEL,
          prompt_version: CRUZAR_VOICE_VERSION,
          status: "pending",
        })
        .select("id")
        .single()

      if (insertErr || !draftRow) throw new Error(insertErr?.message || "insert failed")

      await supabase
        .from("port_spikes")
        .update({ drafted: true, draft_id: draftRow.id })
        .eq("id", s.id)

      results.push({ spikeId: s.id, draftId: draftRow.id })
    } catch (err) {
      results.push({ spikeId: s.id, draftId: null, error: (err as Error).message })
    }
  }

  const drafted = results.filter((r) => r.draftId !== null).length
  return NextResponse.json({ ok: true, drafted, total: spikes.length, results })
}
