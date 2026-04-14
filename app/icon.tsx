import { ImageResponse } from 'next/og'

// Dynamic favicon generated from the Cruzar logo. Next.js app
// router auto-detects this file and serves it as /icon for the
// browser tab icon. Renders the same dark-navy + white-arch-bridge
// mark as /public/logo-icon.svg so every brand surface stays in
// sync.
//
// Uses div positioning (not SVG paths) because Satori doesn't
// render curved SVG paths. The pillar heights approximate the
// arch curve so the implied shape reads as a bridge.

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
          background: '#0f172a',
          borderRadius: 14,
          position: 'relative',
          display: 'flex',
        }}
      >
        {/* Deck */}
        <div style={{ position: 'absolute', left: 9, right: 9, top: 43, height: 2.5, background: '#ffffff', borderRadius: 1, display: 'flex' }} />
        {/* Support legs */}
        <div style={{ position: 'absolute', left: 11, top: 46, width: 1.5, height: 5, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', right: 11, top: 46, width: 1.5, height: 5, background: '#ffffff', display: 'flex' }} />
        {/* Pillars — varying heights form the implied arch */}
        <div style={{ position: 'absolute', left: 13.5, top: 36, width: 1.4, height: 7, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 18.5, top: 26, width: 1.4, height: 17, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 25, top: 19, width: 1.4, height: 24, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 31.3, top: 16.5, width: 1.7, height: 26.5, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 37.5, top: 19, width: 1.4, height: 24, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 44, top: 26, width: 1.4, height: 17, background: '#ffffff', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 49, top: 36, width: 1.4, height: 7, background: '#ffffff', display: 'flex' }} />
      </div>
    ),
    { ...size }
  )
}
