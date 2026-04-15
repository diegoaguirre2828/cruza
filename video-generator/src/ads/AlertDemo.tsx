import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  Sequence,
} from 'remotion';
import { z } from 'zod';

// Ad composition 2/7 — "Te aviso al bajar de 20 min"
// 18s. Sells the Pro alert feature as the product's retention engine.
// Phone lock screen → push notification arrives → user grabs keys →
// quick cut to empty bridge lanes → CTA.

export const AlertDemoSchema = z.object({});

function LockScreen({ localFrame }: { localFrame: number }) {
  // Shows an iPhone-style lock screen with time ticking, then the push lands.
  const time = new Date();
  const timeStr = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const notificationY = interpolate(localFrame, [60, 78], [-200, 120], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const notificationOpacity = interpolate(localFrame, [60, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 200,
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontWeight: 300,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: 3,
          marginBottom: 8,
        }}
      >
        LUNES 14 DE ABRIL
      </div>
      <div style={{ fontSize: 220, fontWeight: 200, color: 'white', lineHeight: 0.95, letterSpacing: -8 }}>
        {timeStr}
      </div>

      <div
        style={{
          position: 'absolute',
          top: notificationY,
          left: 60,
          right: 60,
          opacity: notificationOpacity,
          background: 'rgba(30,30,40,0.92)',
          backdropFilter: 'blur(20px)',
          borderRadius: 28,
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 18,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 80 80" width={32} height={32}>
            <path d="M 10 50 Q 40 15 70 50" fill="none" stroke="white" strokeWidth={8} strokeLinecap="round" />
            <line x1={10} y1={50} x2={10} y2={62} stroke="white" strokeWidth={8} strokeLinecap="round" />
            <line x1={70} y1={50} x2={70} y2={62} stroke="white" strokeWidth={8} strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>CRUZAR</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'white', marginTop: 4, lineHeight: 1.15 }}>
            🟢 Hidalgo bajó a <span style={{ color: '#22c55e' }}>12 min</span>
          </div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.3 }}>
            Es tu mejor ventana. Sal ahorita.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function KeysScene({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 15, 60, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(localFrame, [0, 30], [0.85, 1], {
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0a1430 0%, #111a3a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          fontSize: 88,
          fontWeight: 900,
          color: 'white',
          textAlign: 'center',
          lineHeight: 0.95,
          letterSpacing: -2,
          padding: '0 60px',
        }}
      >
        Agarras las llaves.
        <br />
        <span style={{ color: '#22c55e' }}>Sales.</span>
      </div>
    </AbsoluteFill>
  );
}

function ProofScene({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 15, 80, 100], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(localFrame, [0, 30], [30, 0], {
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          TU PUENTE · 12 MINUTOS DESPUÉS
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 900,
            color: 'white',
            lineHeight: 0.9,
            letterSpacing: -3,
            marginBottom: 32,
          }}
        >
          PASAS SIN
          <br />
          <span style={{ color: '#22c55e' }}>ESPERAR.</span>
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 0.5,
          }}
        >
          Mientras los demás siguen en el grupo.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #4c1d95 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        padding: '0 60px',
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.8)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}
      >
        ALERTAS PRO
      </div>
      <div
        style={{
          fontSize: 104,
          fontWeight: 900,
          color: 'white',
          lineHeight: 0.9,
          letterSpacing: -3,
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        cruzar.app
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: '#fcd34d',
          background: 'rgba(0,0,0,0.25)',
          padding: '14px 32px',
          borderRadius: 999,
          textAlign: 'center',
        }}
      >
        🎁 Primeros 1,000 · Pro gratis 3 meses
      </div>
    </AbsoluteFill>
  );
}

export const AlertDemo: React.FC<z.infer<typeof AlertDemoSchema>> = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={120}>
        <LockScreen localFrame={frame - 0} />
      </Sequence>
      <Sequence from={120} durationInFrames={90}>
        <KeysScene localFrame={frame - 120} />
      </Sequence>
      <Sequence from={210} durationInFrames={150}>
        <ProofScene localFrame={frame - 210} />
      </Sequence>
      <Sequence from={360} durationInFrames={180}>
        <CtaScene localFrame={frame - 360} />
      </Sequence>
    </AbsoluteFill>
  );
};
