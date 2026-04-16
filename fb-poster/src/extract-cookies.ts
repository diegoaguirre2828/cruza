import 'dotenv/config'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

// Extract cookies from Diego's real Chrome profile.
// Requires Chrome to be CLOSED first (can't share a profile).
// Launches Chrome with his actual profile, navigates to the target
// site, grabs all cookies, saves them, and exits.

const site = process.argv[2] || 'https://www.tiktok.com'
const outFile = process.argv[3] || './tiktok-cookies.json'
const profilePath = process.env.CHROME_PROFILE || '/tmp/chrome-extract'

async function main() {
  console.log(`Extracting cookies for ${site}...`)
  console.log(`Using Chrome profile at ${profilePath}`)
  console.log('(Chrome must be closed)')
  console.log('')

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    channel: 'chrome',
    args: ['--no-first-run', '--no-default-browser-check'],
    viewport: { width: 800, height: 600 },
  })

  const page = context.pages()[0] || await context.newPage()
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Wait a moment for any redirects to settle
  await new Promise((r) => setTimeout(r, 3000))

  const cookies = await context.cookies()
  const filtered = cookies.filter((c) =>
    c.domain.includes('tiktok') || c.domain.includes(new URL(site).hostname)
  )

  writeFileSync(outFile, JSON.stringify(filtered, null, 2))
  console.log(`Saved ${filtered.length} cookies to ${outFile}`)

  await context.close()
}

main().catch((err) => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
