// /api/dispatch/paperwork/hs-suggest — HS subheading suggester via the
// MiroFish 3-persona pattern (lib/personaPanel.ts).
//
// Three customs perspectives evaluate the same goods description:
//   1. CBP CROSS Classifier — applies GRI strictly
//   2. Aduanal Broker (MX-side) — what actually clears at the booth
//   3. CBP Audit Reviewer — what would trigger a § 1592 penalty
//
// Returns: per-persona analysis + synthesized recommendation + agreement
// flag. UI surfaces all three with the synthesis as the headline pick.

import { NextResponse } from "next/server";
import { runPersonaPanel, CUSTOMS_PERSONAS } from "@/lib/personaPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { description?: string } = {};
  try {
    body = (await req.json()) as { description?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const description = (body.description ?? "").trim();
  if (!description || description.length < 5) {
    return NextResponse.json({ error: "description must be at least 5 chars" }, { status: 400 });
  }

  try {
    const panel = await runPersonaPanel({
      input: [
        "Goods description provided by the dispatcher (paste from invoice / packing list):",
        "---",
        description,
        "---",
        "Each persona: from your perspective, what 6-digit HS subheading (XXXX.XX) best classifies this good for US-MX cross-border filing? Include the full 6-digit code in your perspective text.",
        "Flag: any ambiguity in the description, mismatched chapter risks, USMCA preferential-treatment risks, or undervaluation triggers.",
      ].join("\n"),
      personas: CUSTOMS_PERSONAS,
      synthesisInstruction:
        "Pick the single best 6-digit HS subheading (format XXXX.XX) integrating all three perspectives. If they disagreed, lead with the consensus pick and note the dissent. Always emphasize that the certifier owns the final classification.",
      maxTokens: 1800,
    });

    // Best-effort extract a single recommended subheading from the synthesis
    const subheadingMatch = panel.synthesis.match(/\b(\d{4}\.\d{2})\b/);
    const recommended_subheading = subheadingMatch?.[1] ?? null;

    return NextResponse.json({
      panel,
      recommended_subheading,
      disclaimer:
        "Cruzar suggestion via 3-persona panel. The certifier (you) owns the final classification per USMCA Article 5.2 and 19 USC § 1592.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "panel_failed" },
      { status: 502 },
    );
  }
}
