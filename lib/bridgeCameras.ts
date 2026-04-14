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
  // - 'hls'     : HLS video stream (.m3u8) rendered via hls.js into a <video>
  kind: 'iframe' | 'image' | 'youtube' | 'hls'
  src: string
  // Attribution required by the source
  credit: string
  creditUrl?: string
  // Optional short description shown below the feed
  note?: string
}

// Populated 2026-04-14 from the camera feed research subagent.
//
// Coverage notes:
//   - California: 3 Caltrans D11 cams (San Ysidro, Otay Mesa, Calexico West)
//   - Arizona: 1 ADOT AZ511 cam (Nogales Mariposa)
//   - El Paso: 3 HLS streams from City of El Paso zoocam infra (BOTA, PDN, Zaragoza)
//   - Texas (RGV / Laredo / Brownsville): ZERO public feeds available.
//     TxDOT rebuilt its CCTV system around SignalR + base64 inline data URIs
//     and retired the legacy snapshot endpoint. Unlocking Texas requires a
//     headless scraper — tracked as future work.
//
// Full research notes, rejected candidates, and backup-angle URLs in
// memory/project_cruzar_camera_feeds.md
//
// DO NOT add entries until the URL has been verified to (a) load, (b) not
// require auth, (c) not silently redirect, (d) not embed malware or ads.
export const BRIDGE_CAMERAS: Record<string, CameraFeed> = {
  // ─── California — Caltrans District 11 ─────────────────────────
  // Direct .jpg auto-refresh, Access-Control-Allow-Origin: *, no auth.
  // Refresh cadence ~60s. Publisher: cwwp2.dot.ca.gov

  '250401': {
    kind: 'image',
    src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c214sb5viadesanysidro/c214sb5viadesanysidro.jpg',
    credit: 'Caltrans District 11',
    creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
    note: 'SB I-5 at Via de San Ysidro — last Caltrans cam before the San Ysidro POE',
  },

  '250501': {
    kind: 'image',
    src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c292sb125atotaymesard/c292sb125atotaymesard.jpg',
    credit: 'Caltrans District 11',
    creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
    note: 'SB SR-125 at Otay Mesa Rd — directly above the Otay Mesa POE',
  },

  '250302': {
    kind: 'image',
    src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c430nb111jno2ndst/c430nb111jno2ndst.jpg',
    credit: 'Caltrans District 11',
    creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
    note: 'NB SR-111 just north of 2nd St — first Caltrans cam north of Calexico West POE',
  },

  // ─── Arizona — ADOT AZ511 ──────────────────────────────────────
  // Direct image/jpeg, Cache-Control max-age=30, CORS open.
  // Publisher: az511.gov

  '260402': {
    kind: 'image',
    src: 'https://www.az511.gov/map/Cctv/1218',
    credit: 'ADOT AZ511',
    creditUrl: 'https://www.az511.gov/cctv',
    note: 'SR-189 at Loma Mariposa — right at the Mariposa POE exit',
  },

  // ─── El Paso — City of El Paso zoocam HLS streams ──────────────
  // CORS-open .m3u8 streams. Rendered via hls.js into a <video> tag.
  // Publisher: zoocams.elpasozoo.org (City of El Paso)

  '240201': {
    kind: 'hls',
    src: 'https://zoocams.elpasozoo.org/memfs/15-bota-hq.m3u8',
    credit: 'City of El Paso',
    creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
    note: 'Bridge of the Americas (BOTA) live HLS stream',
  },

  '240204': {
    kind: 'hls',
    src: 'https://zoocams.elpasozoo.org/memfs/10-pdn-hq.m3u8',
    credit: 'City of El Paso',
    creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
    note: 'Paso del Norte (PDN) live HLS stream',
  },

  '240221': {
    kind: 'hls',
    src: 'https://zoocams.elpasozoo.org/memfs/20-zar-hq.m3u8',
    credit: 'City of El Paso',
    creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
    note: 'Ysleta / Zaragoza live HLS stream',
  },
}

export function getBridgeCamera(portId: string): CameraFeed | null {
  return BRIDGE_CAMERAS[portId] ?? null
}

export function hasCamera(portId: string): boolean {
  return portId in BRIDGE_CAMERAS
}
