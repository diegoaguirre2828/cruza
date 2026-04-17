import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cámaras en vivo de los puentes fronterizos · Cruzar',
  description:
    'Mira las filas reales en cada puente US-México. Cámaras en vivo + tiempo de espera en minutos. Laredo, El Paso, San Ysidro, Nogales, Matamoros y más — en una sola página.',
  alternates: {
    canonical: 'https://cruzar.app/camaras',
  },
  openGraph: {
    title: 'Cámaras en vivo · Cruzar',
    description:
      'Mira las filas reales en cada puente US-México, con tiempo de espera actualizado en minutos.',
    url: 'https://cruzar.app/camaras',
    siteName: 'Cruzar',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cámaras en vivo · Cruzar',
    description:
      'Mira las filas reales en cada puente US-México, con tiempo de espera actualizado en minutos.',
  },
}

export default function CamarasLayout({ children }: { children: React.ReactNode }) {
  return children
}
