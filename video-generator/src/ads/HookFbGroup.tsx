import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  Sequence,
  OffthreadVideo,
  staticFile,
} from 'remotion';
import { z } from 'zod';

// Ad composition 1/7 — "Nunca más preguntes en el grupo"
// Problem/solution narrative targeting FB group users.
// 22s total. 9:16 aspect. Silent-autoplay-ready.
//
// Scene beats:
//   0.0 - 3.5s  | HOOK: Phone scrolling FB group comments "cómo está el puente?"
//   3.5 - 7.0s  | FRUSTRATION: "respuestas contradictorias, tiempos viejos"
//   7.0 - 10.5s | CUT: "Hay una forma más fácil"
//  10.5 - 17.0s | SOLUTION: Open Cruzar, see live wait time in 2 seconds
//  17.0 - 22.0s | CTA: "cruzar.app · gratis · en vivo"
//
// Designed for Meta ads, TikTok, Reels. Captions baked in for silent play.

export const HookFbGroupSchema = z.object({
  currentPortName: z.string(),
  currentWait: z.number(),
});

type Props = z.infer<typeof HookFbGroupSchema>;

const FPS = 30;
const SCENE1 = { start: 0, end: 105 };   // Hook (0-3.5s)
const SCENE2 = { start: 105, end: 210 }; // Frustration (3.5-7s)
const SCENE3 = { start: 210, end: 315 }; // Transition (7-10.5s)
const SCENE4 = { start: 315, end: 510 }; // Solution (10.5-17s)
const SCENE5 = { start: 510, end: 660 }; // CTA (17-22s)

// Fake FB group comments for the hook scene
const FAKE_COMMENTS = [
  { name: 'María', text: 'Cómo está el puente ahorita?', minutes: 12 },
  { name: 'Carlos', text: 'Alguien sabe cómo está Hidalgo?', minutes: 8 },
  { name: 'Raúl', text: 'En Pharr estaba bien a las 7', minutes: 6 },
  { name: 'Lupita', text: 'No, estaba cerrado el sentri', minutes: 4 },
  { name: 'Juan', text: 'Hace media hora estaba lleno', minutes: 2 },
  { name: 'Ana', text: 'Van 2 horas en Anzaldúas', minutes: 1 },
];

function Scene1Hook({ localFrame }: { localFrame: number }) {
  // Phone mockup scrolling through FB-style comments
  const scrollY = interpolate(localFrame, [0, 105], [0, -280], {
    easing: Easing.inOut(Easing.cubic),
  });

  const title1Opacity = interpolate(localFrame, [10, 25, 80, 95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 120,
      }}
    >
      {/* Big title */}
      <div
        style={{
          opacity: title1Opacity,
          fontSize: 76,
          fontWeight: 900,
          color: 'white',
          textAlign: 'center',
          lineHeight: 0.95,
          letterSpacing: -2,
          padding: '0 40px',
          textShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        ¿CÓMO ESTÁ
        <br />
        EL PUENTE?
      </div>

      {/* FB-group-style comment stream underneath */}
      <div
        style={{
          marginTop: 60,
          width: '90%',
          maxWidth: 920,
          background: '#18191a',
          borderRadius: 24,
          padding: '24px 28px',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          height: 700,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#b0b3b8',
            marginBottom: 18,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 14,
          }}
        >
          📘 Filas de Puentes RGV
        </div>
        <div style={{ transform: `translateY(${scrollY}px)` }}>
          {FAKE_COMMENTS.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                marginBottom: 22,
                opacity: interpolate(localFrame, [i * 6, i * 6 + 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: `hsl(${(i * 50) % 360}, 55%, 55%)`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#e4e6eb' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 26, color: '#e4e6eb', marginTop: 4, lineHeight: 1.3 }}>
                  {c.text}
                </div>
                <div style={{ fontSize: 18, color: '#b0b3b8', marginTop: 6 }}>
                  hace {c.minutes} min · Me gusta · Responder
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Scene2Frustration({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 15, 90, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleShake = Math.sin(localFrame / 4) * 2;

  // Subtle Ken-Burns zoom on the b-roll so a 5s clip feels less static
  // when it loops/holds for the 3.5s scene window.
  const videoScale = interpolate(localFrame, [0, 105], [1.0, 1.08], {
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, background: '#000' }}>
      {/* AI b-roll background — POV inside car at border crossing.
          Cinematic frustration shot. Generated via Luma 2026-04-25. */}
      <AbsoluteFill style={{ transform: `scale(${videoScale})` }}>
        <OffthreadVideo
          src={staticFile('broll/frustration-1.mp4')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          startFrom={0}
          // Loop the clip if the scene runs longer than the source.
          // Luma free-tier outputs are 5s; scene is 3.5s so no loop
          // needed today, but keeps behavior safe if scene grows.
        />
      </AbsoluteFill>

      {/* Dark gradient overlay so text stays legible over any frame */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* Text stack — same copy as before, on top of video */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 60px',
        }}
      >
        <div style={{ transform: `translateX(${titleShake}px)` }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              color: 'white',
              textAlign: 'center',
              lineHeight: 1,
              letterSpacing: -1.5,
              marginBottom: 32,
              textShadow: '0 4px 24px rgba(0,0,0,0.85)',
            }}
          >
            Respuestas
            <br />
            contradictorias.
          </div>
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: '#fecaca',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: 24,
            textShadow: '0 2px 14px rgba(0,0,0,0.8)',
          }}
        >
          Tiempos de hace 2 horas.
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: '#fecaca',
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: '0 2px 14px rgba(0,0,0,0.8)',
          }}
        >
          Nadie sabe qué carril
          <br />
          está moviendo.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Scene3Transition({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [5, 20, 90, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(localFrame, [5, 30], [0.9, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
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
          fontSize: 76,
          fontWeight: 900,
          color: 'white',
          textAlign: 'center',
          lineHeight: 0.95,
          letterSpacing: -2,
          padding: '0 50px',
        }}
      >
        Hay una forma
        <br />
        <span style={{ color: '#22c55e' }}>más fácil.</span>
      </div>
    </AbsoluteFill>
  );
}

function Scene4Solution({ localFrame, currentPortName, currentWait }: { localFrame: number; currentPortName: string; currentWait: number }) {
  // Phone mockup showing Cruzar app with the big wait number
  const phoneY = interpolate(localFrame, [0, 25], [80, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });
  const phoneOpacity = interpolate(localFrame, [0, 20, 170, 195], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const numProgress = Math.max(0, Math.min(1, (localFrame - 40) / 35));
  const displayNum = Math.round(
    interpolate(numProgress, [0, 1], [0, currentWait], {
      easing: Easing.out(Easing.cubic),
    })
  );

  const captionOpacity = interpolate(localFrame, [80, 100, 160, 175], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const color = currentWait <= 20 ? '#22c55e' : currentWait <= 45 ? '#f59e0b' : '#ef4444';

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0a1430 0%, #111a3a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          opacity: phoneOpacity,
          transform: `translateY(${phoneY}px)`,
          width: 620,
          background: '#0f172a',
          borderRadius: 48,
          border: '8px solid #1e293b',
          padding: '40px 36px 48px 36px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          CARRIL ESTÁNDAR · AHORA
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: 'white',
            marginBottom: 20,
          }}
        >
          {currentPortName}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              color,
              lineHeight: 0.85,
              letterSpacing: -6,
            }}
          >
            {displayNum}
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
            min
          </div>
        </div>
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#22c55e',
            }}
          />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', letterSpacing: 1 }}>
            LIVE · CBP + COMUNIDAD
          </div>
        </div>
      </div>

      {/* Caption below phone */}
      <div
        style={{
          opacity: captionOpacity,
          marginTop: 60,
          fontSize: 52,
          fontWeight: 900,
          color: 'white',
          textAlign: 'center',
          lineHeight: 0.95,
          letterSpacing: -1,
        }}
      >
        En 2 segundos.
        <br />
        <span style={{ color: '#22c55e' }}>Sin preguntar.</span>
      </div>
    </AbsoluteFill>
  );
}

function Scene5Cta({ localFrame }: { localFrame: number }) {
  const opacity = interpolate(localFrame, [0, 20, 130, 150], [0, 1, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoScale = interpolate(localFrame, [0, 25], [0.85, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: 'clamp',
  });
  const urlScale = interpolate(localFrame, [15, 40], [0.85, 1], {
    easing: Easing.out(Easing.cubic),
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
      }}
    >
      <div
        style={{
          width: 260,
          height: 260,
          borderRadius: 56,
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          border: '2px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${logoScale})`,
          marginBottom: 48,
        }}
      >
        <svg viewBox="0 0 80 80" width={160} height={160}>
          <path
            d="M 10 50 Q 40 15 70 50"
            fill="none"
            stroke="white"
            strokeWidth={7}
            strokeLinecap="round"
          />
          <line x1={10} y1={50} x2={10} y2={62} stroke="white" strokeWidth={7} strokeLinecap="round" />
          <line x1={70} y1={50} x2={70} y2={62} stroke="white" strokeWidth={7} strokeLinecap="round" />
        </svg>
      </div>
      <div
        style={{
          transform: `scale(${urlScale})`,
          fontSize: 104,
          fontWeight: 900,
          color: 'white',
          letterSpacing: -3,
          marginBottom: 20,
        }}
      >
        cruzar.app
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: 1,
          marginBottom: 40,
        }}
      >
        Gratis · En vivo · Sin grupos
      </div>
    </AbsoluteFill>
  );
}

export const HookFbGroup: React.FC<Props> = ({ currentPortName, currentWait }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Sequence from={SCENE1.start} durationInFrames={SCENE1.end - SCENE1.start}>
        <Scene1Hook localFrame={frame - SCENE1.start} />
      </Sequence>
      <Sequence from={SCENE2.start} durationInFrames={SCENE2.end - SCENE2.start}>
        <Scene2Frustration localFrame={frame - SCENE2.start} />
      </Sequence>
      <Sequence from={SCENE3.start} durationInFrames={SCENE3.end - SCENE3.start}>
        <Scene3Transition localFrame={frame - SCENE3.start} />
      </Sequence>
      <Sequence from={SCENE4.start} durationInFrames={SCENE4.end - SCENE4.start}>
        <Scene4Solution
          localFrame={frame - SCENE4.start}
          currentPortName={currentPortName}
          currentWait={currentWait}
        />
      </Sequence>
      <Sequence from={SCENE5.start} durationInFrames={SCENE5.end - SCENE5.start}>
        <Scene5Cta localFrame={frame - SCENE5.start} />
      </Sequence>
    </AbsoluteFill>
  );
};
