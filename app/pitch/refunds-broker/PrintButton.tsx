'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-foreground px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/85"
    >
      Print → PDF
    </button>
  );
}
