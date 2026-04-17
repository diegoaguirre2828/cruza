#!/usr/bin/env python3
"""Pull live Sentry issues for Cruzar. Handles the vercel env pull \n quirk
and renders the last-N-days of real production errors so Claude can
triage them against code instead of asking Diego for a bug list."""
import json, os, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from datetime import datetime

env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
env = {}
with open(env_path, encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\r\n')
        if '=' not in line or line.startswith('#'): continue
        k, v = line.split('=', 1)
        v = v.strip()
        if v.startswith('"') and v.endswith('"'): v = v[1:-1]
        if v.endswith('\\n'): v = v[:-2]
        env[k] = v

token = env.get('SENTRY_AUTH_TOKEN', '')
if not token:
    print('ERROR: SENTRY_AUTH_TOKEN not in .env.local', file=sys.stderr)
    sys.exit(1)

org = 'cruzar'
project = 'javascript-nextjs'
stats_period = sys.argv[1] if len(sys.argv) > 1 else '14d'

url = f'https://sentry.io/api/0/projects/{org}/{project}/issues/?statsPeriod={stats_period}&limit=50&sort=freq'
req = Request(url, headers={'Authorization': f'Bearer {token}'})
try:
    with urlopen(req, timeout=15) as resp:
        issues = json.load(resp)
except HTTPError as e:
    print(f'HTTP {e.code}: {e.read()[:500]!r}')
    sys.exit(1)

if not issues:
    print(f'No issues in last {stats_period}.')
    sys.exit(0)

print(f'=== Sentry issues last {stats_period} ({len(issues)} total, sorted by frequency) ===\n')
for i, issue in enumerate(issues, 1):
    title = issue.get('title', '(no title)')[:100]
    culprit = issue.get('culprit', '')[:80]
    count = issue.get('count', 0)
    users = issue.get('userCount', 0)
    first = issue.get('firstSeen', '')[:19]
    last = issue.get('lastSeen', '')[:19]
    issue_id = issue.get('shortId') or issue.get('id', '')
    level = issue.get('level', '')
    status = issue.get('status', '')
    platform = issue.get('platform', '')
    permalink = issue.get('permalink', '')

    print(f'#{i}  [{issue_id}] {level}  — {title}')
    print(f'    culprit: {culprit}')
    print(f'    events: {count}  users: {users}  status: {status}  platform: {platform}')
    print(f'    first: {first}  last: {last}')
    if permalink:
        print(f'    url: {permalink}')
    print()
