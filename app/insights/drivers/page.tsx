import DriversClient from './DriversClient';

export const dynamic = 'force-dynamic';

export default function DriversPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Driver Compliance / Cumplimiento del Operador</h1>
        <p className="mt-1 text-sm text-white/60">
          Run 5 driver-side compliance checks (USMCA Annex 31-A, IMSS, HOS dual-regime, drug testing, Borello drayage classification) before clearance.
        </p>
        <p className="mt-1 text-sm text-white/60">
          Ejecute 5 verificaciones del operador antes del despacho (T-MEC Anexo 31-A, IMSS, HOS doble regimen, prueba antidoping, clasificacion drayage Borello).
        </p>
      </header>
      <DriversClient />
    </main>
  );
}
