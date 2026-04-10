import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://cruzar.app'

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/advertise`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
