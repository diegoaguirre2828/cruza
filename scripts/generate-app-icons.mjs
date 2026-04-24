#!/usr/bin/env node

// Generate the full iOS AppIcon set from the 1024 master.
//
// Source: ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
// (1024×1024 PNG, no alpha — iOS icons must not include an alpha
// channel or App Store Connect rejects the binary)
//
// Output: every size iOS 14+ uses, plus the 1024 marketing icon,
// with a fresh Contents.json that Xcode will pick up automatically.
// Run whenever the icon art changes: `node scripts/generate-app-icons.mjs`

import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const APPICON_DIR = resolve(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const MASTER = resolve(APPICON_DIR, 'AppIcon-512@2x.png')

// idiom × size(pt) × scale = filename + pixel-size
const ICONS = [
  { idiom: 'iphone', size: '20x20',   scale: '2x', px: 40   },
  { idiom: 'iphone', size: '20x20',   scale: '3x', px: 60   },
  { idiom: 'iphone', size: '29x29',   scale: '2x', px: 58   },
  { idiom: 'iphone', size: '29x29',   scale: '3x', px: 87   },
  { idiom: 'iphone', size: '40x40',   scale: '2x', px: 80   },
  { idiom: 'iphone', size: '40x40',   scale: '3x', px: 120  },
  { idiom: 'iphone', size: '60x60',   scale: '2x', px: 120  },
  { idiom: 'iphone', size: '60x60',   scale: '3x', px: 180  },
  { idiom: 'ipad',   size: '20x20',   scale: '1x', px: 20   },
  { idiom: 'ipad',   size: '20x20',   scale: '2x', px: 40   },
  { idiom: 'ipad',   size: '29x29',   scale: '1x', px: 29   },
  { idiom: 'ipad',   size: '29x29',   scale: '2x', px: 58   },
  { idiom: 'ipad',   size: '40x40',   scale: '1x', px: 40   },
  { idiom: 'ipad',   size: '40x40',   scale: '2x', px: 80   },
  { idiom: 'ipad',   size: '76x76',   scale: '1x', px: 152  },
  { idiom: 'ipad',   size: '83.5x83.5', scale: '2x', px: 167 },
  { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', px: 1024 },
]

function filenameFor(entry) {
  const safeSize = entry.size.replace(/\./g, '_')
  return `AppIcon-${entry.idiom}-${safeSize}-${entry.scale}.png`
}

async function main() {
  await mkdir(APPICON_DIR, { recursive: true })
  const master = sharp(MASTER).flatten({ background: '#0f172a' })
  const masterMeta = await master.metadata()
  if (masterMeta.width !== 1024 || masterMeta.height !== 1024) {
    throw new Error(`Master icon must be 1024×1024, got ${masterMeta.width}×${masterMeta.height}`)
  }

  const images = []
  for (const entry of ICONS) {
    const filename = filenameFor(entry)
    const buf = await sharp(MASTER)
      .flatten({ background: '#0f172a' })
      .resize(entry.px, entry.px, { fit: 'cover', kernel: 'lanczos3' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()
    await writeFile(resolve(APPICON_DIR, filename), buf)
    images.push({
      filename,
      idiom: entry.idiom,
      scale: entry.scale,
      size:  entry.size,
    })
    console.log(`wrote ${filename}  (${entry.px}×${entry.px})`)
  }

  const contents = {
    images,
    info: { author: 'xcode', version: 1 },
  }
  await writeFile(
    resolve(APPICON_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2) + '\n',
  )
  console.log(`\nwrote Contents.json (${images.length} icons)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
