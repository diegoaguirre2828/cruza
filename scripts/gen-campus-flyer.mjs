#!/usr/bin/env node
// UTRGV campus flyer — letter-size (2550×3300 @ 300 DPI) recruitment
// poster for the closed-beta tester push. QR code jumps straight to the
// Google Group join flow.
//
// Design brief:
//   - Cruzar wordmark + bridge icon, top third (brand recognition)
//   - Spanish-first headline (target audience speaks ES primarily)
//   - Single clear ask: 12 testers, 14 days, lifetime Pro
//   - Big QR + printed URL fallback so even if someone can't scan,
//     they can type it (or snap a photo)
//   - Sized for standard US letter printing — home printer or any
//     UTRGV print shop handles it without scaling.

import sharp from 'sharp'
import QRCode from 'qrcode'
import { readFileSync } from 'node:fs'

const W = 2550
const H = 3300
const BG = '#0f172a'

const GROUP_URL = 'https://groups.google.com/g/cruzar-testers'

// Generate QR code as high-quality SVG
const qrSvg = await QRCode.toString(GROUP_URL, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 1,
  color: { dark: '#0f172a', light: '#ffffff' },
  width: 900,
})

// QR needs a white background for print contrast
const qrCard = await sharp(Buffer.from(qrSvg))
  .resize(900, 900)
  .extend({ top: 30, bottom: 30, left: 30, right: 30, background: '#ffffff' })
  .png()
  .toBuffer()

// Bridge icon (reuse the app icon)
const iconBuf = readFileSync('public/icons/icon-512.png')
const iconResized = await sharp(iconBuf).resize(360, 360).toBuffer()

// Text overlay. Coordinates tuned for 2550×3300 canvas.
const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand    { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 900; fill: white; }
    .tagline  { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 500; fill: rgba(255,255,255,0.75); }
    .ask      { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 900; fill: #22c55e; }
    .reward   { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 800; fill: #f59e0b; }
    .step     { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.9); }
    .url      { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 700; fill: rgba(255,255,255,0.92); }
    .scan     { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 800; fill: rgba(255,255,255,0.95); letter-spacing: 6px; }
    .footer   { font-family: -apple-system, 'Segoe UI', Helvetica, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.55); }
  </style>

  <!-- Top: brand lockup -->
  <text x="700" y="370" class="brand" font-size="220">CRUZAR</text>
  <text x="700" y="470" class="tagline" font-size="60">Tiempos de espera en vivo de los puentes</text>
  <text x="700" y="540" class="tagline" font-size="60">US – Mexico border wait times</text>

  <!-- Tester ask — the whole point -->
  <text x="${W/2}" y="830" text-anchor="middle" class="ask" font-size="150">BUSCO 12 TESTERS</text>
  <text x="${W/2}" y="960" text-anchor="middle" class="reward" font-size="90">→ Pro de por vida ←</text>
  <text x="${W/2}" y="1070" text-anchor="middle" class="tagline" font-size="50">Camaras en vivo · Alertas push · Patrones historicos</text>

  <!-- "SCAN" big label above the QR -->
  <text x="${W/2}" y="1280" text-anchor="middle" class="scan" font-size="70">ESCANEA PARA UNIRTE</text>

  <!-- Steps below QR (QR image occupies y=1330 to y=2290) -->
  <text x="${W/2}" y="2450" text-anchor="middle" class="step" font-size="52">1. Escanea o entra al link  ·  2. Pide unirte al grupo</text>
  <text x="${W/2}" y="2530" text-anchor="middle" class="step" font-size="52">3. En unos dias te mando el link pa instalar en Android</text>
  <text x="${W/2}" y="2610" text-anchor="middle" class="step" font-size="52">4. Lo dejas 14 dias seguidos — primero 12 se lleva Pro</text>

  <!-- URL fallback for non-scanners -->
  <text x="${W/2}" y="2820" text-anchor="middle" class="tagline" font-size="44">O entra directo desde tu navegador:</text>
  <text x="${W/2}" y="2910" text-anchor="middle" class="url" font-size="56">groups.google.com/g/cruzar-testers</text>

  <!-- Footer -->
  <text x="${W/2}" y="3180" text-anchor="middle" class="footer" font-size="36">cruzar.app  ·  hecho en el valle  ·  datos de CBP cada 15 min</text>

  <!-- Accent bar bottom -->
  <rect x="0" y="3260" width="${W}" height="12" fill="#22c55e" />
  <rect x="${W/3}" y="3260" width="${W/3}" height="12" fill="#f59e0b" />
  <rect x="${2*W/3}" y="3260" width="${W/3}" height="12" fill="#ef4444" />
</svg>
`

// Compose: dark navy bg → bridge icon top-left → QR center → SVG text overlay
await sharp({
  create: { width: W, height: H, channels: 4, background: BG },
})
  .composite([
    { input: iconResized, top: 270, left: 240 },            // bridge icon next to wordmark
    { input: qrCard,      top: 1330, left: (W - 960) / 2 }, // QR centered, 960×960 total with padding
    { input: Buffer.from(svg), top: 0, left: 0 },
  ])
  .png()
  .toFile('public/campus-flyer-beta-testers.png')

console.log('✓ public/campus-flyer-beta-testers.png ready (' + W + '×' + H + ' @ 300 DPI, US letter)')
console.log('  Print on any home or campus printer. QR → ' + GROUP_URL)
