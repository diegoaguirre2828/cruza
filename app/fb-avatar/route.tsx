import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const revalidate = 3600

// Facebook Page profile picture. Upload recommendation: 720×720
// square — FB crops circular on display but still shows it as a
// rounded square in some surfaces (search, page thumbnails).
// Visit /fb-avatar to save the PNG, then upload as FB page PFP.

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 720,
          height: 720,
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Bridge mark centered at ~75% of canvas. Geometry mirrors
            public/logo-icon.svg scaled 6.4× (100px box → 640px box,
            40px left/top margin to center). All numbers follow:
            base_100 * 6.4 + 40. */}
        {/* Horizontal deck */}
        <div style={{ position: 'absolute', left: 130, top: 475, width: 460, height: 22, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        {/* Short support legs under the deck */}
        <div style={{ position: 'absolute', left: 148, top: 497, width: 13, height: 38, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 559, top: 497, width: 13, height: 38, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        {/* Vertical pillars — heights imply the arch curve */}
        <div style={{ position: 'absolute', left: 174, top: 398, width: 13, height: 77, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 225, top: 302, width: 13, height: 173, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 289, top: 232, width: 13, height: 243, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 353, top: 206, width: 16, height: 269, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 417, top: 232, width: 13, height: 243, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 481, top: 302, width: 13, height: 173, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 533, top: 398, width: 13, height: 77, background: '#ffffff', borderRadius: 3, display: 'flex' }} />
      </div>
    ),
    { width: 720, height: 720 }
  )
}
