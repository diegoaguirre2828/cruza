import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";

// /dispatch — operator console for B2B Insights subscribers.
// Hard auth gate: anonymous visitors redirect to /login. This is paid-tier
// territory; the marketing pitch lives at /insights.
//
// Four sub-surfaces share this chrome:
//   /dispatch        — live console (watched ports auto-refresh)
//   /dispatch/load   — load enrichment (paste origin+receiver+appt)
//   /dispatch/alerts — alerts manager (anomaly thresholds + channels)
//   /dispatch/export — CSV export for spreadsheet workflows

export const metadata = {
  title: "Cruzar Dispatch — operator console",
  description:
    "Live wait + forecast + anomaly across your watched ports. Built for dispatchers who keep one screen open all shift.",
};

export const dynamic = "force-dynamic";

const NAV: Array<{ href: string; en: string; es: string }> = [
  { href: "/dispatch", en: "Console", es: "Consola" },
  { href: "/dispatch/load", en: "Load advisor", es: "Asesor de carga" },
  { href: "/dispatch/paperwork", en: "Paperwork", es: "Trámites" },
  { href: "/dispatch/alerts", en: "Alerts", es: "Alertas" },
  { href: "/dispatch/account", en: "Account", es: "Cuenta" },
  { href: "/dispatch/export", en: "Export", es: "Exportar" },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth redirectFrom="/dispatch">
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
            <div className="flex items-baseline gap-3">
              <Link href="/dispatch" className="font-mono text-[15px] font-semibold tracking-tight text-foreground hover:text-accent">
                Cruzar Dispatch
              </Link>
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
                operator console
              </span>
            </div>
            <nav className="flex items-center gap-1 text-[12.5px]">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition"
                >
                  {item.en}
                </Link>
              ))}
              <span className="mx-2 text-border">|</span>
              <Link
                href="/workspace"
                className="rounded-lg px-2.5 py-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition"
              >
                ← /workspace
              </Link>
            </nav>
          </div>
        </div>
      </header>
      {children}
    </div>
    </RequireAuth>
  );
}
