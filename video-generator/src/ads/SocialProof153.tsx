import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
  Sequence,
} from 'remotion';
import { z } from 'zod';

// Ad composition 3/7 — "153 ya cruzan con esto"
// 14s. Data-driven social proof piece. Uses real community numbers
// passed as props so it refreshes weekly with current counts.

export const SocialProof153Schema = z.object({
  totalUsers: z.number(),
  reportsLast7d: z.number(),
  promoRemaining: z.number(),
});

type Props = z.infer<typeof SocialProof153Schema>;

function BigNum({ localFrame, value, label }: { localFrame: number; value: number; label: string }) {
  const count = Math.round(
    interpolate(localFrame, [0, 30], [0, value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );
  const opacity = interpolate(localFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(localFrame, [0, 20], [30, 0], { easing: Easing.out(Easing.cubic) });
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 280,
          fontWeight: 900,
          color: 'white',
          lineHeight: 0.85,
          letterSpacing: -10,
          fontFeatureSettings: '"tnum"',
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: 1,
          marginTop: 20,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export const SocialProof153: React.FC<Props> = ({ totalUsers, reportsLast7d, promoRemaining }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0a1430 0%, #111a3a 50%, #1a1f4a 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          opacity: 0.6,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(59,130,246,0.25) 0%, transparent 50%)',
        }}
      />

      <Sequence from={0} durationInFrames={105}>
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: 4,
                textTransform: 'uppercase',
                marginBottom: 20,
              }}
            >
              LA RAZA DEL VALLE
            </div>
            <BigNum localFrame={frame} value={totalUsers} label="YA CRUZAN CON ESTO" />
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={105} durationInFrames={105}>
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: 4,
                textTransform: 'uppercase',
                marginBottom: 20,
              }}
            >
              REPORTES ESTA SEMANA
            </div>
            <BigNum localFrame={frame - 105} value={reportsLast7d} label="TIEMPOS COMPARTIDOS" />
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={210} durationInFrames={210}>
        <AbsoluteFill
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #4c1d95 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 60px',
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 30,
              opacity: interpolate(frame - 210, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            ÚNETE A LOS PRIMEROS
          </div>
          <div
            style={{
              fontSize: 360,
              fontWeight: 900,
              color: 'white',
              lineHeight: 0.85,
              letterSpacing: -12,
              opacity: interpolate(frame - 210, [10, 40], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            1,000
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#fcd34d',
              marginTop: 30,
              letterSpacing: 1,
              textAlign: 'center',
              opacity: interpolate(frame - 210, [30, 60], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            3 MESES DE PRO GRATIS
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.6)',
              marginTop: 20,
              opacity: interpolate(frame - 210, [40, 70], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            Quedan {promoRemaining} cupos
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: 'white',
              marginTop: 60,
              letterSpacing: -2,
              opacity: interpolate(frame - 210, [60, 100], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            cruzar.app
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
