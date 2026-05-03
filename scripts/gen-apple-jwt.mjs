#!/usr/bin/env node
// Generate the Apple Sign in with Apple OAuth client secret JWT.
//
// Usage:
//   node scripts/gen-apple-secret.mjs <path-to-AuthKey_XXXXXXXX.p8>
//
// Outputs the JWT to stdout. Paste it into the Supabase Auth provider
// "Secret Key (for OAuth)" field.
//
// Apple's max exp is 180 days. After that you regenerate + repaste.
// (Supabase shows a yellow warning about this — accept it.)

import { createSign } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

const TEAM_ID = '7G5YNXPHWZ'
const KEY_ID = '8P87RKFSB4'
const CLIENT_ID = 'app.cruzar.web'

const path = process.argv[2]
if (!path) {
  console.error('Usage: node scripts/gen-apple-secret.mjs <path-to-AuthKey_XXXXXXXX.p8>')
  process.exit(1)
}
if (!existsSync(path)) {
  console.error(`File not found: ${path}`)
  process.exit(1)
}

const privateKey = readFileSync(path, 'utf8')

const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' }
const now = Math.floor(Date.now() / 1000)
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 86400 * 180,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const signingInput = `${b64url(header)}.${b64url(payload)}`

const signer = createSign('SHA256')
signer.update(signingInput)
const signature = signer
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  .toString('base64url')

console.log(`${signingInput}.${signature}`)
