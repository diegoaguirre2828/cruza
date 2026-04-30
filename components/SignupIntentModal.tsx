"use client";

// Unified inline signup modal for moments-of-want.
//
// Three intents:
//   - alert    : "Text me when Pharr drops below X min"
//   - favorite : "Save Pharr — 3 sec, no email"
//   - notify   : "Want push when this changes? Sign up free"
//
// All routes the guest to /signup with query params (?intent=alert&port=...&
// threshold=...&next=...). The /signup page reads those params and:
//   1. Pre-fills the form (e.g., shows "We'll set you up with: alert on
//      Pharr ≤30min" right above the social buttons)
//   2. After successful signup, executes the intent via existing APIs
//      (/api/alerts POST, /api/saved POST, /api/push/subscribe)
//
// Modal stays out of the path of hard-bouncing visitors — opens only when
// they CHOSE a moment-of-want gesture.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";

export type SignupIntent = "alert" | "favorite" | "notify";

export interface SignupIntentModalProps {
  open: boolean;
  onClose: () => void;
  intent: SignupIntent;
  portId: string;
  portName: string;
  /** For alert intent — the wait threshold in minutes (default 30) */
  defaultThresholdMin?: number;
  /** Path to return to after signup (default: current page) */
  nextPath?: string;
}

export function SignupIntentModal({
  open,
  onClose,
  intent,
  portId,
  portName,
  defaultThresholdMin = 30,
  nextPath,
}: SignupIntentModalProps) {
  const router = useRouter();
  const { lang } = useLang();
  const es = lang === "es";
  const [threshold, setThreshold] = useState(defaultThresholdMin);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Esc to close + focus trap on open
  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const next = nextPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");

  function gotoSignup() {
    const params = new URLSearchParams();
    params.set("intent", intent);
    params.set("port", portId);
    if (intent === "alert") params.set("threshold", String(threshold));
    params.set("next", next);
    router.push(`/signup?${params.toString()}`);
  }

  // Intent-specific copy
  const copy = (() => {
    if (intent === "alert") {
      return {
        title: es ? `Te avisamos cuando ${portName} baje` : `Text me when ${portName} drops`,
        sub: es
          ? `Recibe un mensaje cuando la espera baje del límite que elijas. Sin spam, sin tarjeta.`
          : `Get a text the moment wait drops below your threshold. No spam, no card.`,
        primary: es ? "Crear alerta · 3 seg" : "Create alert · 3 sec",
      };
    }
    if (intent === "favorite") {
      return {
        title: es ? `Guarda ${portName} en tus puentes` : `Save ${portName} as a favorite`,
        sub: es
          ? `Acceso de un toque desde cualquier momento. Tu lista vive en tu cuenta — funciona en todos tus dispositivos.`
          : `One-tap access from anywhere. Your list lives on your account — works across all devices.`,
        primary: es ? "Guardar · 3 seg" : "Save · 3 sec",
      };
    }
    return {
      title: es ? `Activa notificaciones para ${portName}` : `Get push for ${portName}`,
      sub: es
        ? `Recibe un push cuando la espera cambie significativamente. Solo lo importante.`
        : `Get a push when the wait changes significantly. Only the meaningful changes.`,
      primary: es ? "Activar · 3 seg" : "Turn on · 3 sec",
    };
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-intent-title"
    >
      <div className="w-full sm:max-w-md bg-[#0f172a] border-t sm:border border-white/10 sm:rounded-2xl p-6 sm:p-7 shadow-2xl">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 id="signup-intent-title" className="text-[16px] font-semibold text-white">
            {copy.title}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="text-white/40 hover:text-white text-[20px] leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-[13px] text-white/65 leading-[1.55] mb-5">{copy.sub}</p>

        {/* Alert intent — threshold picker */}
        {intent === "alert" && (
          <div className="mb-5">
            <label className="block text-[10.5px] uppercase tracking-[0.18em] text-white/55 mb-2">
              {es ? "Avísame cuando baje de" : "Alert me when wait drops below"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="font-mono text-[18px] tabular-nums text-amber-400 min-w-[56px] text-right">
                {threshold} <span className="text-[12px] text-white/45">min</span>
              </span>
            </div>
          </div>
        )}

        <button
          onClick={gotoSignup}
          className="w-full rounded-xl bg-amber-400 py-3 text-[14px] font-semibold text-[#0a1020] hover:bg-amber-300 transition mb-3"
        >
          {copy.primary} →
        </button>

        <p className="text-[11px] text-white/40 text-center leading-[1.5]">
          {es ? "Continúa con Google o Apple en la siguiente pantalla — un toque, sin contraseña." : "Continue with Google or Apple on the next screen — one tap, no password."}
        </p>
      </div>
    </div>
  );
}
