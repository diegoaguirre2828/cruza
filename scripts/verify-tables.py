#!/usr/bin/env python3
"""Verify Supabase tables exist. Usage: python scripts/verify-tables.py table1 table2 ..."""
import json, os, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

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

url_base = env.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
srk = env.get('SUPABASE_SERVICE_ROLE_KEY', '')

tables = sys.argv[1:] if len(sys.argv) > 1 else ['port_overrides', 'app_events', 'circles', 'circle_members', 'circle_invites']

for t in tables:
    q = f'{url_base}/rest/v1/{t}?select=*&limit=0'
    req = Request(q, headers={'apikey': srk, 'Authorization': f'Bearer {srk}'}, method='HEAD')
    try:
        with urlopen(req, timeout=10) as resp:
            code = resp.getcode()
            print(f'{t:25} OK (HTTP {code}) — table exists')
    except HTTPError as e:
        try:
            body = e.read().decode('utf-8', errors='replace')[:200]
        except Exception:
            body = ''
        print(f'{t:25} HTTP {e.code} — {body}')
    except Exception as e:
        print(f'{t:25} ERROR — {e}')
