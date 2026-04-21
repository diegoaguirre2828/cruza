#!/usr/bin/env node
// Generic: apply any migration file via Supabase Management API.
// Usage: node scripts/apply-migration.mjs supabase/migrations/v43-*.sql
import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

config({ path: '.env.local' })

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: node scripts/apply-migration.mjs <path-to-sql>')
  process.exit(1)
}
const SQL_PATH = resolve(process.cwd(), arg)

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
console.log(text.slice(0, 1200))
if (!res.ok) process.exit(1)
