// OpenRouter wrapper for the NVIDIA Nemotron 3 Super (120B-a12b:free)
// model. Used inside the intel-brief A/B per
// docs/superpowers/specs/cruzar-nemotron-experiment-spec.md.
//
// fetch-based (no SDK dep) to match the project pattern used by
// lib/whatsapp.ts and the Resend/Twilio call sites in app/api/cron/.

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

export interface NemotronResult {
  text: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
}

export class NemotronError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NemotronError';
    this.status = status;
  }
}

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
}

/**
 * Single-shot Nemotron call against OpenRouter's OpenAI-compatible API.
 * Throws NemotronError on rate limits, 5xx, missing creds, or empty
 * output — caller wraps in try/catch and falls back to Anthropic.
 */
export async function callNemotron(
  systemPrompt: string,
  userPrompt: string,
): Promise<NemotronResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new NemotronError('OPENROUTER_API_KEY not configured');
  }

  const start = Date.now();
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // OpenRouter accepts these for attribution + rate-limit tier:
      'HTTP-Referer': 'https://www.cruzar.app',
      'X-Title': 'Cruzar Intelligence',
    },
    body: JSON.stringify({
      model: NEMOTRON_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2200,
    }),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as OpenRouterChatResponse;
      if (body.error?.message) detail += `: ${body.error.message}`;
    } catch {
      /* non-JSON error body — keep status code only */
    }
    throw new NemotronError(detail, res.status);
  }

  const json = (await res.json()) as OpenRouterChatResponse;
  if (json.error) {
    throw new NemotronError(json.error.message ?? 'unknown error');
  }
  const text = json.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw new NemotronError('empty completion');
  }

  return {
    text,
    latencyMs,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
}

export function nemotronModelLabel(): string {
  return 'nemotron-3-super-free';
}
