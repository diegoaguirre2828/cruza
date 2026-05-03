#!/bin/bash
set -e
SECRET="${CRUZAR_CRON_SECRET:-${CRON_SECRET:-MISSING}}"
echo "=== /insights — title + AI scan ==="
curl -s https://cruzar.app/insights | grep -oE '<title>[^<]+</title>' | head -1
AI_HITS=$(curl -s https://cruzar.app/insights | grep -ciE 'ai-powered|ai assistant|claude|model[ -]name|mcp' || echo 0)
echo "AI mentions found: $AI_HITS (0 expected)"

echo ""
echo "=== /api/live/board — first 200 chars ==="
curl -s https://cruzar.app/api/live/board | head -c 200; echo ""

echo ""
echo "=== /dispatch — title (no auth, should still render shell) ==="
curl -s https://cruzar.app/dispatch | grep -oE '<title>[^<]+</title>' | head -1

echo ""
echo "=== /dispatch?demo=rgv — title ==="
curl -s "https://cruzar.app/dispatch?demo=rgv" | grep -oE '<title>[^<]+</title>' | head -1

echo ""
echo "=== /insights/accuracy — title (existing page) ==="
curl -s https://cruzar.app/insights/accuracy | grep -oE '<title>[^<]+</title>' | head -1

echo ""
echo "=== /api/cron/insights-briefing dryRun ==="
curl -s "https://cruzar.app/api/cron/insights-briefing?secret=$SECRET&dryRun=1"
echo ""

echo ""
echo "=== /api/cron/insights-anomaly-broadcast dryRun ==="
curl -s "https://cruzar.app/api/cron/insights-anomaly-broadcast?secret=$SECRET&dryRun=1"
echo ""

echo ""
echo "=== /api/insights/preferences (unauth — expects 401) ==="
curl -s -o /dev/null -w "%{http_code}\n" https://cruzar.app/api/insights/preferences

echo ""
echo "=== /api/dispatch/snapshot existing endpoint ==="
curl -s "https://cruzar.app/api/dispatch/snapshot?ports=230502,230501" | head -c 200; echo ""
