#!/usr/bin/env node
// One-shot: apply v42 migration via Supabase Management API.
// Reads SQL from supabase/migrations/v42-business-tier-rebuild.sql and
// POSTs to https://api.supabase.com/v1/projects/{ref}/database/query.
import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const SQL_PATH = resolve(__dirname, '..', 'supabase', 'migrations', 'v42-business-tier-rebuild.sql')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!url || !token) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local')
  process.exit(1)
}
const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
if (!m) { console.error('Bad URL'); process.exit(1) }
const ref = m[1]

const sql = await readFile(SQL_PATH, 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
console.log(`HTTP ${res.status}`)
console.log(text.slice(0, 800))
if (!res.ok) process.exit(1)
