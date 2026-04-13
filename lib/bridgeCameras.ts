// Public bridge camera feed registry.
//
// Maps portId → live feed source. Only bridges with confirmed public feeds
// belong here. When a portId is NOT in this map, the BridgeCameras component
// shows a "próximamente" (coming soon) state instead of a broken player.
//
// Feed discovery workflow: verify the stream URL is public and embeddable
// (iframe-friendly or direct image refresh), then add an entry here.
// Do NOT host or proxy feeds — only embed what the publisher already serves
// publicly. Respect the source's CORS and x-frame-options headers.

export type CameraFeed = {
  // How the feed renders in the browser
  // - 'iframe'  : third-party embed (YouTube live, TxDOT CCTV page, etc.)
  // - 'image'   : still image URL that auto-refreshes every ~10s
  // - 'youtube' : YouTube video ID (rendered as a lite embed)
  kind: 'iframe' | 'image' | 'youtube'
  src: string
  // Attribution required by the source
  credit: string
  creditUrl?: string
  // Optional short description shown below the feed
  note?: string
}

// Empty to start — populate as feeds are confirmed public and stable.
// Each entry maps a Cruzar portId (see lib/portMeta.ts) to its camera.
//
// Known candidate sources to investigate:
//   - TxDOT Lonestar CCTV (its.txdot.gov) — US 281/83 corridor cams near
//     Hidalgo, Pharr, Los Tomates; some are iframe-embeddable
//   - City of Brownsville traffic cams
//   - Public YouTube live streams near border bridges (rare but exist)
//   - Mexican state DOT cams (Tamaulipas, Nuevo León, Chihuahua)
//
// DO NOT add entries until the URL has been verified to (a) load, (b) not
// require auth, (c) not silently redirect, (d) not embed malware or ads.
export const BRIDGE_CAMERAS: Record<string, CameraFeed> = {}

export function getBridgeCamera(portId: string): CameraFeed | null {
  return BRIDGE_CAMERAS[portId] ?? null
}

export function hasCamera(portId: string): boolean {
  return portId in BRIDGE_CAMERAS
}
