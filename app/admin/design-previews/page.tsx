'use client'

// Live design direction previews. Visit /admin/design-previews to compare
// three aesthetic directions side by side with real fonts, spacing, and
// motion. All mock data — safe to ignore, safe to delete, not wired to the
// real data layer.

const MOCK_PORTS = [
  { id: '535503', name: 'Los Indios',              city: 'Brownsville', wait: 15, lanes: 2, status: 'fast' as const },
  { id: '535502', name: 'Los Tomates',             city: 'Brownsville', wait: 60, lanes: 1, status: 'slow' as const },
  { id: '535501', name: 'B&M',                     city: 'Brownsville', wait: 90, lanes: 1, status: 'slow' as const },
  { id: '535504', name: 'Gateway',                 city: 'Brownsville', wait: 90, lanes: 1, status: 'slow' as const },
]

export default function DesignPreviewsPage() {
  return (
    <>
      {/* Google Fonts loaded inline — preview-only, not for production */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=Space+Grotesk:wght@500;700&family=Archivo+Black&family=JetBrains+Mono:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <main className="min-h-screen bg-gray-200 py-8 px-4">
        <div className="max-w-3xl mx-auto mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Design direction previews</h1>
          <p className="text-sm text-gray-600">
            Three takes on the main screen. Each preview uses real fonts, real mock data, same content, different visual language.
            Pick one and I&apos;ll rebuild the whole app in that direction.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-10">
          <PreviewFrame label="Option 1 — Swiss Transit">
            <SwissTransit />
          </PreviewFrame>

          <PreviewFrame label="Option 2 — Border Brutalism">
            <BorderBrutalism />
          </PreviewFrame>

          <PreviewFrame label="Option 3 — Terminal Live">
            <TerminalLive />
          </PreviewFrame>
        </div>

        <p className="max-w-3xl mx-auto mt-10 text-center text-xs text-gray-500">
          Each preview is a static mock — no interactions, no data fetching. Shows the visual language only.
        </p>
      </main>
    </>
  )
}

function PreviewFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
        <p className="text-[10px] text-gray-400">mock · static</p>
      </div>
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-gray-300 bg-white">
        {/* Fake phone chrome */}
        <div className="bg-gray-900 text-white text-[10px] font-mono px-4 py-1.5 flex justify-between">
          <span>9:41</span>
          <span>cruzar.app</span>
          <span>100%</span>
        </div>
        {children}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// OPTION 1 — SWISS TRANSIT
// Airport departure board meets European train schedule. Black + white +
// one yellow accent. Inter 900 weight. Tight tracking. Grid precision.
// ═══════════════════════════════════════════════════════════════════════
function SwissTransit() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#ffffff' }} className="text-black">
      {/* Header */}
      <div className="border-b-2 border-black px-5 py-4 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold">Cruzar / Live</p>
          <h1 style={{ letterSpacing: '-0.03em' }} className="text-2xl font-black">BROWNSVILLE</h1>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 bg-black text-white px-2.5 py-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-[9px] uppercase tracking-wider font-bold">En vivo</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Apr 12 · 18:42</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-5 py-6 border-b border-gray-300">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-2">Cruce más rápido</p>
        <p style={{ letterSpacing: '-0.04em', fontFamily: 'Space Grotesk, Inter, sans-serif' }} className="text-5xl font-black leading-none">
          LOS INDIOS
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span style={{ fontFeatureSettings: '"tnum"' }} className="text-8xl font-black tracking-tighter" >15</span>
          <span className="text-2xl font-medium text-gray-500">min</span>
        </div>
        <div className="mt-4 inline-block bg-yellow-300 px-3 py-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-black">Ahorras 75 min vs B&amp;M</p>
        </div>
      </div>

      {/* Port list — monospace numbers, letter marks */}
      <div className="divide-y divide-gray-200">
        {MOCK_PORTS.map(p => (
          <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-black flex items-center justify-center text-[11px] font-black">
                {p.name.split(/\s/)[0].slice(0, 3).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{p.name}</p>
                <p className="text-[10px] uppercase text-gray-500 tracking-wider">{p.lanes} {p.lanes === 1 ? 'carril' : 'carriles'}</p>
              </div>
            </div>
            <div className="text-right">
              <p style={{ fontFeatureSettings: '"tnum"' }} className={`text-3xl font-black tracking-tighter ${p.status === 'fast' ? 'text-black' : 'text-black'}`}>
                {p.wait}
                <span className="text-sm font-medium text-gray-500 ml-1">min</span>
              </p>
              {p.status === 'fast' && (
                <div className="inline-block bg-yellow-300 px-1.5 mt-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider">Recomendado</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-black text-white px-5 py-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold">52 cruces · 4 regiones</p>
        <p className="text-[10px] text-yellow-400 font-bold">Reportar →</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// OPTION 2 — BORDER BRUTALISM
// Customs checkpoint signage. Warning-tape yellow, safety red, asphalt
// black. Archivo Black + Inter. Thick borders. No gradients. No softness.
// ═══════════════════════════════════════════════════════════════════════
function BorderBrutalism() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#FFD300' }} className="text-black">
      {/* Caution stripe header */}
      <div
        className="h-2"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0 10px, #FFD300 10px 20px)' }}
      />

      <div className="px-5 py-4 border-b-[3px] border-black flex items-center justify-between">
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', letterSpacing: '-0.02em' }} className="text-3xl uppercase">
          CRUZAR
        </h1>
        <div className="bg-black text-[#FFD300] px-3 py-1.5 border-2 border-black">
          <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-[10px] uppercase tracking-wider">● EN VIVO</p>
        </div>
      </div>

      {/* Hero slab */}
      <div className="p-5 border-b-[3px] border-black">
        <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-[11px] uppercase tracking-wider bg-black text-[#FFD300] inline-block px-2 py-1">
          EL MÁS RÁPIDO
        </p>
        <p style={{ fontFamily: 'Archivo Black, sans-serif', letterSpacing: '-0.03em' }} className="text-4xl uppercase mt-3 leading-none">
          LOS INDIOS
        </p>
        <div className="mt-4 bg-black text-[#FFD300] p-4 border-[3px] border-black">
          <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-8xl leading-none tracking-tighter">
            15<span className="text-3xl align-top">MIN</span>
          </p>
        </div>

        {/* Loss block */}
        <div className="mt-4 bg-[#D81E05] text-white p-3 border-[3px] border-black">
          <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-xs uppercase">PIERDES</p>
          <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-4xl leading-none">75 MIN</p>
          <p className="text-xs font-bold uppercase mt-0.5">si vas a B&amp;M</p>
        </div>
      </div>

      {/* Port list — hard blocks */}
      <div className="bg-[#FFD300]">
        {MOCK_PORTS.map((p, i) => (
          <div key={p.id} className={`border-b-[3px] border-black px-5 py-4 flex items-center justify-between ${p.status === 'fast' ? 'bg-white' : ''}`}>
            <div>
              <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-base uppercase leading-tight">{p.name}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold mt-0.5">{p.lanes} CARRIL · BROWNSVILLE</p>
            </div>
            <div className={`${p.wait <= 20 ? 'bg-black text-[#FFD300]' : p.wait <= 45 ? 'bg-[#FFD300] border-[3px] border-black' : 'bg-[#D81E05] text-white'} px-4 py-2 border-[3px] border-black`}>
              <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-3xl leading-none">{p.wait}<span className="text-xs">MIN</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-black text-[#FFD300] px-5 py-3 flex items-center justify-between border-t-[3px] border-black">
        <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-[11px] uppercase">REPORTAR AHORA</p>
        <p style={{ fontFamily: 'Archivo Black, sans-serif' }} className="text-[11px] uppercase">→</p>
      </div>

      {/* Caution stripe footer */}
      <div
        className="h-2"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0 10px, #FFD300 10px 20px)' }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// OPTION 3 — TERMINAL LIVE
// Bloomberg meets Mission Control. Deep charcoal, phosphor amber for
// live values, hairline borders, monospace numbers, dense data grid.
// ═══════════════════════════════════════════════════════════════════════
function TerminalLive() {
  const mono = { fontFamily: 'JetBrains Mono, IBM Plex Mono, ui-monospace, monospace' }
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#0A0A0F' }} className="text-gray-300">
      {/* Header bar */}
      <div className="border-b border-gray-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.25em] font-bold text-white">CRUZAR//LIVE</span>
          <span style={mono} className="text-[10px] text-gray-500">v2.4 · BRO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse" />
          <span style={mono} className="text-[10px] text-[#FFB800] font-bold">LIVE · 00:00:12</span>
        </div>
      </div>

      {/* Hero — data-terminal style */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">FASTEST_CROSSING()</p>
          <p style={mono} className="text-[10px] text-gray-500">PID: 535503</p>
        </div>
        <p style={{ ...mono, color: '#FFB800' }} className="text-5xl font-bold tracking-tight leading-none">
          LOS_INDIOS
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span style={{ ...mono, color: '#FFB800' }} className="text-7xl font-bold tracking-tighter leading-none">
            15
          </span>
          <span style={mono} className="text-xl text-gray-500">.00 min</span>
        </div>
        {/* Delta ticker */}
        <div className="mt-3 inline-flex items-center gap-2 bg-[#FFB800]/10 border border-[#FFB800]/30 px-3 py-1.5">
          <span style={mono} className="text-[10px] text-[#FFB800] font-bold">Δ −75</span>
          <span className="text-[10px] text-gray-400">vs slowest queue</span>
        </div>
      </div>

      {/* Data grid */}
      <div>
        <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-500 font-bold">
          <div className="col-span-5">Crossing</div>
          <div className="col-span-3 text-right">Wait</div>
          <div className="col-span-2 text-right">Lanes</div>
          <div className="col-span-2 text-right">Signal</div>
        </div>
        {MOCK_PORTS.map(p => {
          const color = p.wait <= 20 ? '#00FF88' : p.wait <= 45 ? '#FFB800' : '#FF5555'
          return (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-gray-900/60 hover:bg-gray-900/50">
              <div className="col-span-5">
                <p style={mono} className="text-sm text-white font-bold">{p.name.replace(/\s+/g, '_').toUpperCase()}</p>
                <p style={mono} className="text-[9px] text-gray-500 uppercase">{p.id}</p>
              </div>
              <div className="col-span-3 text-right">
                <p style={{ ...mono, color }} className="text-2xl font-bold tabular-nums tracking-tighter leading-none">
                  {String(p.wait).padStart(3, '0')}
                </p>
                <p style={mono} className="text-[9px] text-gray-500 uppercase">minutes</p>
              </div>
              <div className="col-span-2 text-right" style={mono}>
                <p className="text-xs text-gray-400 tabular-nums">{p.lanes}/1</p>
              </div>
              <div className="col-span-2 flex justify-end items-center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer ticker */}
      <div className="border-t border-gray-800 bg-[#05050A] px-5 py-2 flex items-center justify-between">
        <span style={mono} className="text-[10px] text-gray-500">
          FEED: CBP + HERE + COMMUNITY · UPDATED 12s AGO
        </span>
        <span style={mono} className="text-[10px] text-[#FFB800]">SUBMIT REPORT ↵</span>
      </div>
    </div>
  )
}
