# Cruzar — Nemotron A/B experiment on intel-brief
**Authored from brain terminal 2026-05-01. Paste this into the Cruzar terminal Claude when ready to ship.**

## Goal
Measure if NVIDIA's free Nemotron 3 Super (via OpenRouter free tier) can replace Anthropic Haiku on the **intel-brief cron** at acceptable quality. 7-day A/B, then decide keep/kill/expand.

## Scope
- **One file** — wherever the intel-brief cron handler lives + its Anthropic client call (search `intel-brief`, `intelBrief`, or check `app/api/cron/` and `lib/`).
- A/B logic: 50% Anthropic Haiku (current), 50% Nemotron 3 Super via OpenRouter.
- Log every call to a new `model_ab_log` table (or extend existing logging).
- **Don't touch** the other 9 Anthropic call sites. This is a single-call-site experiment.

## Non-goals
- No self-hosting. OpenRouter handles model serving.
- No caching layer changes.
- No prompt rewrites. Same system prompt to both models.

## Implementation

### 1. Env vars (Vercel)
```
OPENROUTER_API_KEY=<get from openrouter.ai/keys>
NEMOTRON_AB_ENABLED=true
NEMOTRON_AB_PCT=50
```

### 2. Model client wrapper
Create `lib/models/nemotron.ts`:
```ts
import OpenAI from "openai"; // OpenRouter is OpenAI-API-compatible

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function callNemotron(systemPrompt: string, userPrompt: string) {
  const start = Date.now();
  const res = await client.chat.completions.create({
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    latencyMs: Date.now() - start,
    tokensIn: res.usage?.prompt_tokens ?? 0,
    tokensOut: res.usage?.completion_tokens ?? 0,
  };
}
```

### 3. A/B switch in the intel-brief handler
```ts
const useNemotron =
  process.env.NEMOTRON_AB_ENABLED === "true" &&
  Math.random() * 100 < Number(process.env.NEMOTRON_AB_PCT ?? 0);

const result = useNemotron
  ? await callNemotron(systemPrompt, userPrompt)
  : await callAnthropic(systemPrompt, userPrompt); // existing path

await supabase.from("model_ab_log").insert({
  call_site: "intel-brief",
  model: useNemotron ? "nemotron-3-super-free" : "claude-haiku-4-5",
  latency_ms: result.latencyMs,
  tokens_in: result.tokensIn,
  tokens_out: result.tokensOut,
  output_chars: result.text.length,
  ts: new Date().toISOString(),
});
```

### 4. Migration
```sql
create table if not exists model_ab_log (
  id bigserial primary key,
  call_site text not null,
  model text not null,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  output_chars int,
  ts timestamptz not null default now()
);
create index on model_ab_log (call_site, ts);
```
Run via `npm run apply-migration -- supabase/migrations/<timestamp>_model_ab_log.sql`

### 5. Failure mode
OpenRouter free tier can rate-limit or 503. Wrap the Nemotron call in a try/catch — on failure, fall back to Anthropic, log it as `model = "nemotron-failed-fallback"`.

## Measurement (after 7 days)

Run this query and paste results back to brain terminal:
```sql
select
  model,
  count(*) as calls,
  avg(latency_ms)::int as avg_latency_ms,
  avg(output_chars)::int as avg_output_chars,
  sum(tokens_in) as total_in,
  sum(tokens_out) as total_out
from model_ab_log
where call_site = 'intel-brief' and ts > now() - interval '7 days'
group by model;
```

Plus eyeball ~10 random briefs from each model side-by-side. Quality bar: are the Nemotron briefs usable for the founder dashboard, or do they look noticeably worse?

## Decision tree
- **Quality holds + Nemotron failure rate <10%** → flip pct to 100%, kill the Anthropic path for intel-brief, expand experiment to fb-post next.
- **Quality holds + failure rate >10%** → keep A/B but skew Anthropic-heavy, wait for OpenRouter reliability or self-host.
- **Quality drops** → kill Nemotron path, document specifically what dropped, archive lesson.

## Rollback
Set `NEMOTRON_AB_ENABLED=false` in Vercel. No code revert needed. Migration stays (harmless).

## Verification before claiming done
- One real cron fire hits Nemotron (check `model_ab_log` has at least one `nemotron-3-super-free` row)
- Output is non-empty + parseable for the downstream brief consumer
- Anthropic side still works (one row with `claude-haiku-4-5`)
- `pacer` agent verifies all three before reporting "shipped"
