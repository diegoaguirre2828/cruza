import { ImageResponse } from 'next/og'

// Dynamic favicon generated from the Cruzar logo. Next.js app router
// auto-detects this file and serves it as /icon for the browser tab
// icon, overriding /app/favicon.ico. Using ImageResponse (Satori)
// because it ships with Next and doesn't require build-time tooling
// to generate PNGs from an SVG source.
//
// Renders the same blue-square + black-suspension-bridge mark as
// /public/logo-icon.svg so every visible brand surface stays in sync.

export const runtime = 'edge'
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: '#2563eb',
          borderRadius: 14,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Left tower */}
        <div style={{ position: 'absolute', left: 14, top: 17, width: 5, height: 26, background: '#0f172a', borderRadius: 1, display: 'flex' }} />
        {/* Right tower */}
        <div style={{ position: 'absolute', right: 14, top: 17, width: 5, height: 26, background: '#0f172a', borderRadius: 1, display: 'flex' }} />
        {/* Road base */}
        <div style={{ position: 'absolute', left: 8, right: 8, top: 41, height: 4, background: '#0f172a', borderRadius: 1, display: 'flex' }} />
        {/* Road dash */}
        <div style={{ position: 'absolute', left: 28, top: 41.5, width: 8, height: 3, background: '#2563eb', borderRadius: 1, display: 'flex' }} />
      </div>
    ),
    { ...size }
  )
}
