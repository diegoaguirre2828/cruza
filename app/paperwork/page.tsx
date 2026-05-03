import PaperworkClient from './PaperworkClient';

export const dynamic = 'force-dynamic';

export default function PaperworkPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Paperwork / Documentos</h1>
        <p className="mt-1 text-sm text-white/60">
          Upload commercial invoice, packing list, BOL, certificate of origin, or Mexican health certificate. Cruzar will classify the document type and extract the structured fields.
        </p>
        <p className="mt-1 text-sm text-white/60">
          Sube factura comercial, lista de empaque, BOL, certificado de origen, o certificado de salud. Cruzar clasificara el documento y extraera los campos.
        </p>
      </header>
      <PaperworkClient />
    </main>
  );
}
