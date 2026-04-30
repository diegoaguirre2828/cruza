// MiroFish-pattern shared infrastructure — 3-persona panel runner.
//
// Wraps a single Anthropic call with a structured multi-persona prompt so
// any high-stakes decision in Cruzar (paperwork classification, route
// recommendation, anomaly interpretation, drift-status disclosure) can be
// reviewed from N legitimate stakeholder perspectives before display.
//
// Design choice: ONE Haiku call with all personas in a single prompt + JSON
// schema, NOT N parallel calls. Same per-call cost as today's single-
// perspective LLM features (~$0.0005), much more coherent synthesis (the
// model can balance perspectives in one pass), simpler error handling.
//
// When to call: high-stakes decisions only — recommendations, alerts,
// paperwork drafts, drift interpretations. NOT for raw status displays.
// Cost is real but bounded; pick selectively.

import Anthropic from "@anthropic-ai/sdk";

export interface Persona {
  id: string; // stable key, e.g. 'cbp_officer'
  label: string; // human-facing name, e.g. 'CBP Officer'
  systemRole: string; // first-person framing — "You are a CBP officer with 12 years..."
}

export interface PersonaResponse {
  persona_id: string;
  persona_label: string;
  perspective: string; // 1-3 sentence verdict from this persona
  flags: string[]; // concrete red flags / concerns
  confidence: "high" | "medium" | "low";
}

export interface PanelResult {
  responses: PersonaResponse[];
  synthesis: string; // single recommended display string after weighing all personas
  agreement: "aligned" | "split" | "conflict";
  // aligned   = all 3 personas converge on the same recommendation
  // split     = 2/3 align, 1 dissents
  // conflict  = 3 different recommendations OR major contradiction
  highest_confidence: "high" | "medium" | "low";
  // Worst-case across personas — display this conservatively, not the avg
  raw_text?: string; // unparsed model output (for debug)
  model: string;
  ms: number;
  cost_estimate_usd: number; // Haiku-4.5 prices, approximate
}

export interface RunOptions {
  input: string; // the decision/question to be reviewed
  personas: Persona[]; // 2-5 personas (3 is canonical MiroFish)
  synthesisInstruction?: string; // how the model should merge perspectives
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1500;
const HAIKU_INPUT_USD_PER_1M = 0.8;
const HAIKU_OUTPUT_USD_PER_1M = 4.0;

function buildSystemPrompt(personas: Persona[], synthesisInstruction: string): string {
  return [
    "You are running a structured ${PANEL_SIZE}-persona expert panel review. Each persona analyzes the SAME input independently from their professional perspective, then a synthesis weighs the verdicts.",
    "",
    "PERSONAS:",
    ...personas.map(
      (p, i) => `[${i + 1}] ${p.label} (id=${p.id})\n    Role: ${p.systemRole}`,
    ),
    "",
    "Each persona must:",
    "- Give a 1-3 sentence first-person verdict from their professional standpoint",
    "- List 0-5 concrete flags (red flags, gotchas, missing info) — not generic warnings",
    "- Assign confidence: 'high' (clear-cut), 'medium' (judgment call w/ standard tradeoffs), 'low' (insufficient info or contested)",
    "",
    "Synthesis must:",
    `- ${synthesisInstruction}`,
    "- Acknowledge where personas disagreed (if they did)",
    "- Be 1-3 sentences, written for the end user (not for you/me)",
    "",
    "Determine 'agreement':",
    "- 'aligned' = all personas converge on the same recommendation",
    "- 'split' = a majority agree but at least one persona dissents materially",
    "- 'conflict' = personas disagree fundamentally on the recommendation",
    "",
    "RETURN JSON ONLY — no preamble, no markdown fences:",
    "{",
    '  "responses": [{"persona_id": "...", "perspective": "...", "flags": ["..."], "confidence": "high|medium|low"}, ...],',
    '  "synthesis": "...",',
    '  "agreement": "aligned|split|conflict"',
    "}",
  ]
    .join("\n")
    .replace("${PANEL_SIZE}", String(personas.length));
}

function estimateCost(usage: Anthropic.Usage | undefined): number {
  if (!usage) return 0;
  const inUsd = ((usage.input_tokens ?? 0) / 1_000_000) * HAIKU_INPUT_USD_PER_1M;
  const outUsd = ((usage.output_tokens ?? 0) / 1_000_000) * HAIKU_OUTPUT_USD_PER_1M;
  return Math.round((inUsd + outUsd) * 1_000_000) / 1_000_000;
}

const CONFIDENCE_RANK: Record<PersonaResponse["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function worstConfidence(rs: PersonaResponse[]): PersonaResponse["confidence"] {
  if (rs.length === 0) return "low";
  let worst: PersonaResponse["confidence"] = "high";
  for (const r of rs) {
    if (CONFIDENCE_RANK[r.confidence] < CONFIDENCE_RANK[worst]) worst = r.confidence;
  }
  return worst;
}

export async function runPersonaPanel(opts: RunOptions): Promise<PanelResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  if (opts.personas.length < 2 || opts.personas.length > 5) {
    throw new Error(`runPersonaPanel: expected 2-5 personas, got ${opts.personas.length}`);
  }

  const synthesisInstruction =
    opts.synthesisInstruction ??
    "Produce a single end-user recommendation that integrates all persona perspectives, calling out anything that needs human review";
  const model = opts.model ?? DEFAULT_MODEL;
  const system = buildSystemPrompt(opts.personas, synthesisInstruction);

  const t0 = Date.now();
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system,
    temperature: opts.temperature ?? 0.4,
    messages: [{ role: "user", content: opts.input }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/^```json\s*|```\s*$/g, "")
    .trim();

  type RawResponse = Partial<{
    persona_id: string;
    perspective: string;
    flags: unknown;
    confidence: string;
  }>;
  type RawPanel = Partial<{
    responses: RawResponse[];
    synthesis: string;
    agreement: string;
  }>;

  let parsed: RawPanel = {};
  try {
    parsed = JSON.parse(text) as RawPanel;
  } catch {
    throw new Error(`runPersonaPanel: model returned unparseable JSON. Raw: ${text.slice(0, 400)}`);
  }

  const personaById = new Map(opts.personas.map((p) => [p.id, p.label]));
  const responses: PersonaResponse[] = (parsed.responses ?? [])
    .map((r) => {
      const id = String(r.persona_id ?? "");
      const label = personaById.get(id) ?? id;
      const conf = ["high", "medium", "low"].includes(String(r.confidence)) ? r.confidence : "low";
      return {
        persona_id: id,
        persona_label: label,
        perspective: String(r.perspective ?? "").slice(0, 800),
        flags: Array.isArray(r.flags) ? r.flags.map((f) => String(f).slice(0, 240)).slice(0, 8) : [],
        confidence: conf as PersonaResponse["confidence"],
      };
    })
    .filter((r) => r.persona_id && personaById.has(r.persona_id));

  const agreement: PanelResult["agreement"] = ["aligned", "split", "conflict"].includes(
    String(parsed.agreement),
  )
    ? (parsed.agreement as PanelResult["agreement"])
    : "split";

  return {
    responses,
    synthesis: String(parsed.synthesis ?? "").slice(0, 1200),
    agreement,
    highest_confidence: worstConfidence(responses),
    raw_text: text,
    model,
    ms: Date.now() - t0,
    cost_estimate_usd: estimateCost(res.usage),
  };
}

// ─── Pre-built persona libraries ───────────────────────────────────────

export const CUSTOMS_PERSONAS: Persona[] = [
  {
    id: "cbp_classifier",
    label: "CBP CROSS Classifier",
    systemRole:
      "You are a CBP CROSS-database classification specialist. You apply the General Rules of Interpretation (GRI) strictly, in order. You insist on the most-specific heading per GRI 1, only invoke GRI 2-3 when GRI 1 fails, and always cite the relevant Section/Chapter notes when they override heading text.",
  },
  {
    id: "aduanal_broker",
    label: "Aduanal Broker (MX-side)",
    systemRole:
      "You are a licensed Mexican aduanal broker (agente aduanal) with 15+ years filing pedimentos at the Laredo and Reynosa crossings. You know what classifications actually clear at the booth and what triggers secondary inspection. You think commercially — what's defensible AND duty-optimized.",
  },
  {
    id: "audit_reviewer",
    label: "CBP Audit Reviewer",
    systemRole:
      "You are a CBP Focused Assessment auditor. You evaluate filings 18-36 months after entry. You look for misclassification patterns, undervaluation, missing supporting documentation, and FTA claims that don't reconcile with actual production records. Your job is to flag what would cost the importer a 19 USC § 1592 penalty.",
  },
];

export const ROUTE_PERSONAS: Persona[] = [
  {
    id: "driver",
    label: "Driver",
    systemRole:
      "You are an OTR driver with 10 years on the US-MX corridor. You think about hours-of-service, fuel stops, parking availability, weather, your CDL/SENTRI/FAST status, and whether the recommended route lets you actually sleep tonight. You push back on dispatcher recommendations that look good on paper but fail in practice.",
  },
  {
    id: "dispatcher",
    label: "Dispatcher",
    systemRole:
      "You are a fleet dispatcher managing 25-40 active loads. You think about customer SLAs, broker relationships, on-time-performance KPIs, detention claims, and how this load's outcome affects your dispatcher scorecard. You balance individual-load efficiency against fleet-wide implications.",
  },
  {
    id: "receiver_ops",
    label: "Receiver Operations",
    systemRole:
      "You are the receiver-side dock operations manager. You think about appointment windows, dock door availability, lumper coordination, OS&D risk, and the cost of detention vs trailer-pool churn. You'll call the broker if a load is going to land outside its window.",
  },
];

export const ALERT_PERSONAS: Persona[] = [
  {
    id: "operator",
    label: "Operator on-shift",
    systemRole:
      "You are the dispatcher on shift right now. You need to know in 10 seconds: is this actionable, who needs to be notified, what's the recommended next step. Long context kills you — you have 6 active loads.",
  },
  {
    id: "customer_service",
    label: "Customer service",
    systemRole:
      "You handle the receiver / customer / broker who will call asking about this load. You need a 1-sentence script you can use on the phone. You think about reputation and the next contract, not just this load.",
  },
  {
    id: "driver_in_lane",
    label: "Driver in lane",
    systemRole:
      "You are the driver who will get this alert via SMS while approaching the border. You don't have time to read paragraphs. You need: which port, why, and one decision (cross / reroute / wait).",
  },
];

export const INSIGHTS_TRUST_PERSONAS: Persona[] = [
  {
    id: "buyer",
    label: "Skeptical fleet buyer",
    systemRole:
      "You manage operations for a 30-truck cross-border fleet. You evaluate every SaaS pitch with 'is this real or marketing.' You compare Cruzar's claims to CBP's free baseline and think about what your dispatchers will actually do with the data on Tuesday morning.",
  },
  {
    id: "honest_broker",
    label: "Honest aduanal broker",
    systemRole:
      "You've used Cruzar's data for 3 weeks across your active lanes. You give Diego unfiltered feedback because you want the product to be real. You know which ports the model wins at and which it shouldn't claim coverage on.",
  },
  {
    id: "audit_critic",
    label: "Audit critic",
    systemRole:
      "You read marketing pages adversarially. You catch cherry-picked stats, mislabeled charts, weasel words, and false equivalences. You assume the buyer is non-technical and call out everything that would mislead them.",
  },
];
