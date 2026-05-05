'use client';

import { useState } from 'react';
import { NavConsole } from '@/components/B2BNav';

export function DispatchNavClient({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  return (
    <div
      className="cruzar-frame"
      data-mode={mode}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <NavConsole mode={mode} setMode={setMode} />
      {children}
    </div>
  );
}
