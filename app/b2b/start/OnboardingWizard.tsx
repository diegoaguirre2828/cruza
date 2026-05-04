'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth';
import { GoogleButton } from '@/components/GoogleButton';

const RGV_PORTS = [
  { id: '230501', label: 'Hidalgo / McAllen' },
  { id: '230502', label: 'Pharr–Reynosa' },
  { id: '230503', label: 'Anzaldúas' },
  { id: '230901', label: 'Progreso' },
  { id: '230701', label: 'Rio Grande City' },
  { id: '535501', label: 'Brownsville Gateway' },
  { id: '535502', label: 'Brownsville Veterans' },
  { id: '230401', label: 'Laredo I (Gateway)' },
  { id: '230402', label: 'Laredo II (World Trade)' },
];

interface WizardCopy {
  step1: {
    title: string;
    sub: string;
    options: { value: string; label: string }[];
  };
  step2: { title: string; sub: string };
  step3: {
    title: string;
    sub: string;
    emailLabel: string;
    passwordLabel: string;
    cta: string;
    orDivider: string;
    googleCta: string;
    alreadyHave: string;
    signIn: string;
  };
  back: string;
  next: string;
  progressOf: string;
}

interface Props {
  lang: 'en' | 'es';
  copy: WizardCopy;
}

export function OnboardingWizard({ lang, copy: c }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [commodity, setCommodity] = useState('');
  const [ports, setPorts] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  function togglePort(id: string) {
    setPorts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function writePrefs() {
    await fetch('/api/b2b/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commodity_type: commodity, watched_ports: ports }),
    });
    router.replace(`/workspace${langSuffix}`);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sb = createClient();
      const { error: signupErr } = await sb.auth.signUp({ email, password });
      if (signupErr) throw new Error(signupErr.message);
      await writePrefs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 sm:px-8 py-16 sm:py-24">
      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={[
              'h-1 flex-1 transition-all',
              n <= step ? 'bg-foreground' : 'bg-border',
            ].join(' ')}
          />
        ))}
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/60 ml-2 shrink-0">
          {step} {c.progressOf} 3
        </span>
      </div>

      {/* Step 1: Commodity type */}
      {step === 1 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step1.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step1.sub}</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {c.step1.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCommodity(opt.value)}
                className={[
                  'text-left border p-4 font-mono text-[12px] uppercase tracking-[0.14em] transition',
                  commodity === opt.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!commodity}
            onClick={() => setStep(2)}
            className="mt-8 w-full bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {c.next}
          </button>
        </div>
      )}

      {/* Step 2: Port picker */}
      {step === 2 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step2.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step2.sub}</p>
          <div className="mt-8 grid grid-cols-1 gap-2">
            {RGV_PORTS.map((port) => {
              const checked = ports.includes(port.id);
              return (
                <button
                  key={port.id}
                  type="button"
                  onClick={() => togglePort(port.id)}
                  className={[
                    'flex items-center justify-between border p-4 font-mono text-[12px] uppercase tracking-[0.14em] transition',
                    checked
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                  ].join(' ')}
                >
                  <span>{port.label}</span>
                  {checked && <span aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border border-border px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {c.back}
            </button>
            <button
              type="button"
              disabled={ports.length === 0}
              onClick={() => setStep(3)}
              className="flex-1 bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {c.next}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Account creation */}
      {step === 3 && (
        <div>
          <h1 className="font-serif text-[2rem] font-medium text-foreground leading-[1.1]">
            {c.step3.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">{c.step3.sub}</p>

          <div className="mt-8">
            <GoogleButton label={c.step3.googleCta} next="/workspace" />
          </div>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/50">
              {c.step3.orDivider}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                {c.step3.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-border bg-card/30 px-4 py-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60 transition"
              />
            </div>
            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1.5">
                {c.step3.passwordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-border bg-card/30 px-4 py-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/60 transition"
              />
            </div>
            {error && <p className="text-[13px] text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-background hover:bg-foreground/90 transition disabled:opacity-60"
            >
              {loading ? '…' : c.step3.cta}
            </button>
          </form>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="border border-border px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {c.back}
            </button>
          </div>

          <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/50">
            {c.step3.alreadyHave}{' '}
            <a
              href={`/login${langSuffix}`}
              className="text-accent hover:text-accent/80 transition"
            >
              {c.step3.signIn}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
