// Scoped layout for /insights/* routes only.
//
// Loads an editorial display serif (Fraunces) and exposes it as a CSS
// variable plus a Tailwind v4 utility override so headlines on the
// Cruzar Insights B2B pages can use a serif without touching the
// global font stack used by the consumer app.

import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-insights-serif",
  // Editorial display weights — keep payload light.
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} insights-scope`}
      style={{
        // Override Tailwind's font-serif within this subtree only.
        // Tailwind v4 reads --default-font-serif at the closest scope
        // when font-serif utilities are applied via CSS-var fallback.
        // We also set this directly for completeness.
        ["--font-serif" as string]: "var(--font-insights-serif), ui-serif, Georgia, serif",
      } as React.CSSProperties}
    >
      <style>{`
        .insights-scope .font-serif {
          font-family: var(--font-insights-serif), ui-serif, Georgia, "Times New Roman", serif;
          font-feature-settings: "ss01", "ss02", "kern";
        }
      `}</style>
      {children}
    </div>
  );
}
