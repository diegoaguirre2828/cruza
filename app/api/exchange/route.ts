import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN', {
      next: { revalidate: 3600 }, // cache 1 hour
    })
    if (!res.ok) throw new Error('Exchange API error')
    const data = await res.json()
    const rate = data.rates?.MXN ?? null
    return NextResponse.json({ rate, updatedAt: new Date().toISOString() })
  } catch {
    // Fallback rate if API is down
    return NextResponse.json({ rate: null, updatedAt: null })
  }
}
