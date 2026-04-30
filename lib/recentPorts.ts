// Track ports the user has recently viewed in localStorage.
// Used by /signup to personalize ("we'll set you up with alerts on these
// ports you've been checking") and by the post-detail soft nudge.
//
// Cap at 10. Pure read/write — no React hook required so server-rendered
// pages can read it via dynamic import too.

const STORAGE_KEY = "cruzar.recent_ports.v1";
const MAX = 10;

interface RecentEntry {
  port_id: string;
  last_at: string; // ISO
  views: number;
}

export function recordPortView(portId: string): void {
  if (typeof window === "undefined" || !portId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: RecentEntry[] = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    const idx = list.findIndex((e) => e.port_id === portId);
    const now = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = { ...list[idx], last_at: now, views: list[idx].views + 1 };
    } else {
      list.unshift({ port_id: portId, last_at: now, views: 1 });
    }
    list.sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* SSR or quota — silent */
  }
}

export function readRecentPorts(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function viewCount(portId: string): number {
  return readRecentPorts().find((e) => e.port_id === portId)?.views ?? 0;
}
