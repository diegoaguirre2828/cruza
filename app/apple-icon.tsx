import { ImageResponse } from 'next/og'

// iOS home screen icon for Cruzar. Served at 180×180, the size iOS
// uses for add-to-home-screen shortcuts. Same arch-bridge silhouette
// as app/icon.tsx, public/logo-icon.svg, and the OG image header.

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
          background: '#0f172a',
          borderRadius: 40,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Deck */}
        <div style={{ position: 'absolute', left: 25, right: 25, top: 122, height: 7, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
        {/* Support legs */}
        <div style={{ position: 'absolute', left: 31, top: 129, width: 4, height: 14, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', right: 31, top: 129, width: 4, height: 14, background: '#ffffff', display: 'flex' }} />
        {/* Pillars — arch approximated by varying heights */}
        <div style={{ position: 'absolute', left: 38, top: 101, width: 3.5, height: 21, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 53, top: 74, width: 3.5, height: 48, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 71, top: 54, width: 3.5, height: 68, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 88, top: 47, width: 4.5, height: 75, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 105, top: 54, width: 3.5, height: 68, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 123, top: 74, width: 3.5, height: 48, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 138, top: 101, width: 3.5, height: 21, background: '#ffffff', display: 'flex' }} />
      </div>
    ),
    { ...size }
  )
}
