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

## Port IDs (RGV)

| port_id | Crossing |
|---|---|
| 230501 | Hidalgo |
| 230502 | Pharr–Reynosa |
| 230503 | Anzaldúas |
| 230402 | Laredo World Trade Bridge |
| 230401 | Laredo I (Gateway) |
| 230301 | Eagle Pass |
| 535502 | Brownsville Veterans |
| 535504 | Brownsville Gateway |

Full list available via `cruzar_live_wait()` (no args).

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
