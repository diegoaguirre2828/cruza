#!/usr/bin/env node

// Capture App Store screenshots at iPhone 6.9" / 6.7" display size.
// Apple as of 2025: only the 6.9" size (1290×2796) is required — it
// scales down to other device families automatically.
//
// Output: ios/screenshots/ with 6 frames × 2 locales = 12 PNGs.
// Apple wants between 1 and 10 screenshots — we keep 6 so localised
// copy can differ per frame.
//
// Requires: playwright. Installed transitively via fb-poster/. If you
// move this script to CI or a fresh machine, run:
//   cd fb-poster && npx playwright install chromium

import { chromium } from '../fb-poster/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'ios/screenshots')

// Apple 6.9" screenshot spec: 1290×2796 at 3x.
// CSS viewport: 430×932, deviceScaleFactor: 3 → screenshot is 1290×2796.
const VIEWPORT = { width: 430, height: 932 }
const SCALE = 3

// Each frame = one Cruzar URL + a target language. The "?lang=" query
// param is read by LangContext to override browser locale so we get
// deterministic ES/EN output even when Playwright runs under a
// system locale that doesn't match.
const FRAMES = [
  { slug: '01-home',       path: '/' },
  { slug: '02-map',        path: '/todos' },
  { slug: '03-port',       path: '/port/230501' },
  { slug: '04-planner',    path: '/planner' },
  { slug: '05-pricing',    path: '/pricing' },
  { slug: '06-dashboard',  path: '/dashboard' },
]

const LOCALES = ['es', 'en']

async function capture(browser, locale, frame) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: locale === 'es' ? 'es-MX' : 'en-US',
    userAgent:
      // Real iPhone 16 Pro Max UA so the site serves its mobile layout
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  const sep = frame.path.includes('?') ? '&' : '?'
  const url = `https://cruzar.app${frame.path}${sep}lang=${locale}`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Give SWR + Supabase auth hydration a beat so the live numbers
    // render before we snapshot. 2s is overkill on fast networks but
    // keeps us deterministic across CI runners.
    await page.waitForTimeout(2500)
    const outFile = resolve(OUT, `${locale}-${frame.slug}.png`)
    await page.screenshot({ path: outFile, fullPage: false, type: 'png' })
    console.log(`wrote ${locale}-${frame.slug}.png`)
  } catch (err) {
    console.error(`FAILED ${locale} ${frame.slug}: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const locale of LOCALES) {
      for (const frame of FRAMES) {
        await capture(browser, locale, frame)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
