import { ImageResponse } from 'next/og'

// iOS home screen icon for Cruzar. Next.js app router auto-detects
// this file and serves it as /apple-icon at 180x180, the size iOS
// actually uses for home screen shortcuts. Matches the favicon /icon
// and public/logo-icon.svg so the brand is consistent.

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#2563eb',
          borderRadius: 40,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Left tower */}
        <div style={{ position: 'absolute', left: 40, top: 48, width: 14, height: 74, background: '#0f172a', borderRadius: 3, display: 'flex' }} />
        {/* Right tower */}
        <div style={{ position: 'absolute', right: 40, top: 48, width: 14, height: 74, background: '#0f172a', borderRadius: 3, display: 'flex' }} />
        {/* Tower tops */}
        <div style={{ position: 'absolute', left: 37, top: 40, width: 20, height: 10, background: '#0f172a', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', right: 37, top: 40, width: 20, height: 10, background: '#0f172a', borderRadius: 3, display: 'flex' }} />
        {/* Road base */}
        <div style={{ position: 'absolute', left: 22, right: 22, top: 115, height: 11, background: '#0f172a', borderRadius: 3, display: 'flex' }} />
        {/* Road dash */}
        <div style={{ position: 'absolute', left: 80, top: 117, width: 20, height: 7, background: '#2563eb', borderRadius: 2, display: 'flex' }} />
      </div>
    ),
    { ...size }
  )
}
