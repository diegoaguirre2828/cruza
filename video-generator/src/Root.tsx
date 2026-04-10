import React from 'react';
import { Composition } from 'remotion';
import { WaitTimeVideo, WaitTimeVideoSchema } from './WaitTimeVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="WaitTimes"
      component={WaitTimeVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      schema={WaitTimeVideoSchema}
      defaultProps={{
        crossings: [
          { portId: '230501', name: 'Hidalgo / McAllen', wait: 35, level: 'medium' },
          { portId: '230502', name: 'Pharr–Reynosa',     wait: 20, level: 'low'    },
          { portId: '230503', name: 'Anzaldúas',         wait: 55, level: 'high'   },
          { portId: '230901', name: 'Progreso',          wait: 15, level: 'low'    },
          { portId: '230902', name: 'Donna',             wait: 40, level: 'medium' },
          { portId: '535501', name: 'Brownsville Gateway', wait: 70, level: 'high' },
          { portId: '535502', name: 'Brownsville Veterans', wait: 25, level: 'low' },
          { portId: '535503', name: 'Los Tomates',       wait: 30, level: 'medium' },
        ],
      }}
    />
  );
};
