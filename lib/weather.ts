// Weather join — called at /api/reports POST time to snapshot the
// weather conditions at the bridge into the crossing_reports row.
// Free OpenWeatherMap tier: 60 calls/min, 1M/month. At current volume
// we're nowhere near those limits.
//
// Env var required: OPENWEATHER_API_KEY
// Add via Vercel Environment Variables dashboard.

export interface WeatherSnapshot {
  temp_c: number
  feels_like_c: number
  humidity: number
  wind_kph: number
  precipitation_mm: number
  condition: string
  description: string
  fetched_at: string
}

export async function fetchWeatherSnapshot(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()

    // OpenWeatherMap response shape — extract the fields we care
    // about into a stable schema so downstream queries don't depend
    // on OWM's JSON changing.
    const main = data?.main || {}
    const wind = data?.wind || {}
    const weather = data?.weather?.[0] || {}
    const rain = data?.rain?.['1h'] ?? data?.rain?.['3h'] ?? 0
    const snow = data?.snow?.['1h'] ?? data?.snow?.['3h'] ?? 0

    return {
      temp_c: Math.round((main.temp ?? 0) * 10) / 10,
      feels_like_c: Math.round((main.feels_like ?? 0) * 10) / 10,
      humidity: Math.round(main.humidity ?? 0),
      wind_kph: Math.round(((wind.speed ?? 0) * 3.6) * 10) / 10,
      precipitation_mm: Math.round((rain + snow) * 10) / 10,
      condition: String(weather.main || 'unknown').toLowerCase(),
      description: String(weather.description || '').slice(0, 120),
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
