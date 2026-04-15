import React from 'react';
import { Composition } from 'remotion';
import { WaitTimeVideo, WaitTimeVideoSchema } from './WaitTimeVideo';
import { HookFbGroup, HookFbGroupSchema } from './ads/HookFbGroup';
import { AlertDemo, AlertDemoSchema } from './ads/AlertDemo';
import { SocialProof153, SocialProof153Schema } from './ads/SocialProof153';

// Remotion composition registry. Every composition here is renderable
// via `node render.mjs <id>`. For multi-aspect-ratio output (9:16, 1:1,
// 4:5), render.mjs overrides width/height at render time — the
// registered width/height below is the PRIMARY aspect (9:16) for each
// video.
//
// Composition IDs map to real-world use:
//
//   WaitTimes            daily organic live wait-time update (10-11s)
//   HookFbGroup          ad #1 — problem/solution narrative (22s)
//   AlertDemo            ad #2 — Pro alerts demo (18s)
//   SocialProof153       ad #3 — real community numbers (14s)
//
// Add new compositions by dropping a file in ./ads/ and importing here.

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* DAILY ORGANIC — rendered every 4h on pre-peak schedule */}
      <Composition
        id="WaitTimes"
        component={WaitTimeVideo}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={WaitTimeVideoSchema}
        defaultProps={{
          crossings: [
            { portId: '230501', name: 'Hidalgo · McAllen', wait: 35, level: 'medium' as const, lanesOpen: 4 },
            { portId: '230502', name: 'Pharr · Reynosa', wait: 20, level: 'low' as const, lanesOpen: 5 },
            { portId: '230503', name: 'Anzaldúas', wait: 55, level: 'high' as const, lanesOpen: 2 },
            { portId: '230901', name: 'Progreso', wait: 15, level: 'low' as const, lanesOpen: 3 },
            { portId: '535501', name: 'Brownsville Gateway', wait: 70, level: 'high' as const, lanesOpen: 2 },
            { portId: '535502', name: 'Veterans B&M', wait: 25, level: 'low' as const, lanesOpen: 4 },
          ],
          totalUsers: 153,
          promoRemaining: 847,
          reportsLast24h: 16,
        }}
      />

      {/* AD LIBRARY — hand-crafted, rendered on demand or weekly */}
      <Composition
        id="HookFbGroup"
        component={HookFbGroup}
        durationInFrames={660}
        fps={30}
        width={1080}
        height={1920}
        schema={HookFbGroupSchema}
        defaultProps={{
          currentPortName: 'Hidalgo · McAllen',
          currentWait: 18,
        }}
      />

      <Composition
        id="AlertDemo"
        component={AlertDemo}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
        schema={AlertDemoSchema}
        defaultProps={{}}
      />

      <Composition
        id="SocialProof153"
        component={SocialProof153}
        durationInFrames={420}
        fps={30}
        width={1080}
        height={1920}
        schema={SocialProof153Schema}
        defaultProps={{
          totalUsers: 153,
          reportsLast7d: 16,
          promoRemaining: 847,
        }}
      />
    </>
  );
};
