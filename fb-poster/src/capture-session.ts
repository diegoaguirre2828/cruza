import 'dotenv/config'
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

// One-time session capture tool. Opens a VISIBLE Chrome window so
// Diego can log into Facebook as Natividad Rivera manually. Once
// logged in, saves all cookies to cookies.json for the auto-poster
// to reuse. The session stays valid for weeks/months as long as FB
// doesn't challenge it.
//
// Usage:
//   cd fb-poster
//   npm install
//   npm run capture-session
//
// Instructions:
//   1. A Chrome window will open to facebook.com
//   2. Log in as Natividad Rivera (the alt account)
//   3. Once you see the News Feed, come back here and press Enter
//   4. The script saves cookies.json and exits
//   5. On Railway: upload cookies.json to the persistent volume

const COOKIES_PATH = process.env.FB_COOKIES_PATH || './cookies.json'

async function main() {
  console.log('Opening Chrome...')
  console.log('')
  console.log('STEPS:')
  console.log('  1. Log in to Facebook (any account that manages the Cruzar Page)')
  console.log('  2. Click your profile picture (top right)')
  console.log('  3. Click "See all profiles"')
  console.log('  4. Click the CRUZAR page to switch to it')
  console.log('  5. You should now see "Using Facebook as Cruzar" at the top')
  console.log('  6. Come back here and press Enter')
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  })

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    locale: 'es-MX',
  })

  const page = await context.newPage()
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' })

  // Wait for the user to press Enter in the terminal
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve())
  })

  const cookies = await context.cookies()
  writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
  console.log(`\nSaved ${cookies.length} cookies to ${COOKIES_PATH}`)
  console.log('You can now close this window.')

  await browser.close()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
