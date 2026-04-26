# Cruzar Insights MCP

Remote MCP server exposing US-MX border wait-time data + smart routing to AI clients.

**Endpoint:** `https://www.cruzar.app/mcp` (apex `cruzar.app` 307-redirects to www; clients that don't follow redirects on POST should use `www.` directly)
**Transport:** Streamable HTTP (stateless)
**Auth:** `Authorization: Bearer <CRUZAR_MCP_KEY>`

## Tools (7)

### Decision tools (broker / dispatcher)
- **`cruzar_recommend_route(lat, lng, direction?, departure_offset_min?, candidate_pool?)`** — THE dispatcher killer tool. Ranks crossings by `total_eta = drive_min + predicted_wait_at_arrival_min + departure_offset`, where `predicted_wait_at_arrival_min` uses v0.4 forecast at the driver's actual arrival time (not just current). Composes smart_route + v0.4 forecast.
- **`cruzar_briefing(port_id)`** — One-shot markdown decision artifact: current wait + 90d historical baseline + v0.4 6h forecast + best remaining window. Best for "what should I tell the dispatcher about this bridge right now?"
- **`cruzar_anomaly_now(port_id)`** — Flags ports running ≥1.5× or ≤0.67× their 90-day DOW × hour baseline. Returns status + ratio + pct_above. Broker red-flag signal.

### Forecast tools
- **`cruzar_forecast(port_id, horizon_min)`** — v0.4 RandomForest prediction at 360 (6h) or 1440 (24h). Returns prediction + RMSE + lift vs CBP-climatology and persistence baselines. 8 RGV ports supported.
- **`cruzar_compare_ports(port_ids[], horizon_min)`** — Side-by-side v0.4 forecasts across multiple ports, sorted ascending.

### Data tools
- **`cruzar_smart_route(lat, lng, direction?, limit?)`** — Heuristic ranking by `current_wait + drive_distance`. Faster + cheaper than recommend_route; use when you don't need ML predictions.
- **`cruzar_live_wait(port_id?)`** — Most recent CBP reading for one port, or all RGV ports if omitted. Includes vehicle / SENTRI / pedestrian / commercial lanes.
- **`cruzar_best_times(port_ids[], day?, hour?)`** — Historical average wait by day-of-week × hour over the last 90 days.

## Port IDs (RGV) — 13 ports w/ v0.4 ML coverage

| port_id | Crossing | v0.4 lift vs CBP @ 6h |
|---|---|---|
| 230402 | Laredo World Trade Bridge | +13.6% |
| 535502 | Brownsville Veterans (Los Tomates) | +18.1% |
| 230501 | Hidalgo | +6.4% |
| 230503 | Anzaldúas | +4.6% |
| 230701 | Rio Grande City | **+37.3%** |
| 230401 | Laredo I (Gateway) | ~0% (already accurate) |
| 230301 | Eagle Pass | -3.6% (drift fallback) |
| 535501 | Brownsville Gateway | +0.3% |
| 230502 | Pharr–Reynosa | -289% (drift fallback to CBP climatology) |
| 230901 | Progreso | (fresh — see manifest) |
| 230902 | Donna | (fresh — see manifest) |
| 231001 | Roma | (fresh — see manifest) |
| 535503 | Brownsville Los Indios | (fresh — see manifest) |

`degraded:true` ports automatically fall back to the CBP climatology baseline so callers don't see broken predictions. Models retrained weekly Sundays at 06:00 UTC via GH Actions on `cruzar-insights-ml`.

Full live list: `cruzar_live_wait()` (no args).
Full v0.4 manifest: `GET https://cruzar-insights-api.vercel.app/api/forecast` (with bearer auth).

## Connect from Claude Desktop / Code

```json
{
  "mcpServers": {
    "cruzar-insights": {
      "transport": {
        "type": "http",
        "url": "https://www.cruzar.app/mcp",
        "headers": {
          "Authorization": "Bearer <YOUR_KEY>"
        }
      }
    }
  }
}
```

## Try it from curl

```bash
curl -X POST https://www.cruzar.app/mcp \
  -H "Authorization: Bearer $CRUZAR_MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Backend status

v0.1 wraps the heuristic prediction stack already running on cruzar.app. The v0.4 ML model (RF + XGBoost trained 2026-04-25, +16-18% vs CBP climatology baseline at 6h on Laredo WTB and Brownsville Veterans) is deployed separately and will swap in via Path B without changing this MCP surface.

## Get an API key

DM Diego — keys are issued manually in v0.1.
