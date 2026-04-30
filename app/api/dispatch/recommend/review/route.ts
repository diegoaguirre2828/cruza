// /api/dispatch/recommend/review — 3-persona review of a load advisor result.
//
// POST: { picks: [...], appt_at?, cargo_type?, driver_name? }
// Runs ROUTE_PERSONAS (Driver / Dispatcher / Receiver Operations) against
// the recommended port + alternatives. Returns synthesized verdict +
// per-persona flags. Surfaces issues a single LLM pass would miss
// (driver hours, customer relationships, dock-window practicalities).

import { NextResponse } from "next/server";
import { runPersonaPanel, ROUTE_PERSONAS } from "@/lib/personaPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Pick {
  port_id: string;
  name: string;
  region: string;
  drive_min: number;
  predicted_wait_at_arrival_min: number | null;
  total_eta_min: number | null;
  estimated_arrival_at: string;
  detention_usd_at_risk: number | null;
}

interface ReviewBody {
  picks: Pick[];
  appt_at?: string;
  cargo_type?: string;
  driver_name?: string;
  origin_label?: string;
}

export async function POST(req: Request) {
  let body: ReviewBody = { picks: [] };
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const picks = (body.picks ?? []).slice(0, 5);
  if (picks.length === 0) {
    return NextResponse.json({ error: "no_picks" }, { status: 400 });
  }

  const summary = formatLoadForReview(body, picks);

  try {
    const panel = await runPersonaPanel({
      input: [
        "Pre-execution review of a cross-border load recommendation. The dispatcher is about to send the driver to the #1 ranked port. From your perspective, is this the right call?",
        "",
        "LOAD CONTEXT:",
        "---",
        summary,
        "---",
        "Each persona — assess from your professional standpoint:",
        "- Driver: hours-of-service, fuel/parking availability, route safety, sleep tonight, SENTRI/FAST relevance",
        "- Dispatcher: customer SLA, broker relationships, on-time-percentage impact, what happens to the next load if this one runs late",
        "- Receiver Operations: dock window fit, lumper coordination, OS&D risk, trailer-pool implications",
        "Flag concrete issues — not generic warnings.",
      ].join("\n"),
      personas: ROUTE_PERSONAS,
      synthesisInstruction:
        "Recommend: stick with #1, switch to #2 (or another rank, name which), or pause and reroute. If you recommend #1, say why all 3 perspectives align. If you flag a switch, explain which persona's concern dominates.",
      maxTokens: 1800,
    });

    return NextResponse.json({
      panel,
      top_pick: picks[0],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "review_failed" },
      { status: 502 },
    );
  }
}

function formatLoadForReview(body: ReviewBody, picks: Pick[]): string {
  const lines: string[] = [];
  lines.push(`Origin: ${body.origin_label ?? "?"}`);
  if (body.appt_at) {
    lines.push(`Receiver appointment: ${new Date(body.appt_at).toUTCString()}`);
  } else {
    lines.push("Receiver appointment: not specified");
  }
  lines.push(`Cargo type: ${body.cargo_type ?? "unspecified"}`);
  if (body.driver_name) lines.push(`Driver: ${body.driver_name}`);
  lines.push("");
  lines.push("Ranked recommendations (best total ETA first):");
  picks.forEach((p, i) => {
    const det =
      p.detention_usd_at_risk != null && p.detention_usd_at_risk > 0
        ? `, est detention $${p.detention_usd_at_risk}`
        : "";
    lines.push(
      `  #${i + 1} ${p.name} (${p.region}) — drive ${p.drive_min}m + wait ${p.predicted_wait_at_arrival_min ?? "?"}m = total ${p.total_eta_min ?? "?"}m, arrives ${new Date(p.estimated_arrival_at).toUTCString()}${det}`,
    );
  });
  return lines.join("\n");
}
