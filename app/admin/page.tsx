'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { Copy, Check, ExternalLink } from 'lucide-react'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type RegionKey = 'rgv' | 'brownsville' | 'laredo' | 'eagle_pass' | 'el_paso' | 'san_luis' | 'other'

const REGIONS: { key: RegionKey; label: string; emoji: string }[] = [
  { key: 'rgv',         label: 'RGV / McAllen / Reynosa',         emoji: '🌵' },
  { key: 'brownsville', label: 'Matamoros / Brownsville',          emoji: '🏙️' },
  { key: 'laredo',      label: 'Laredo / Nuevo Laredo',            emoji: '🛣️' },
  { key: 'eagle_pass',  label: 'Eagle Pass / Piedras Negras',      emoji: '🦅' },
  { key: 'el_paso',     label: 'El Paso / Juárez',                 emoji: '⛰️' },
  { key: 'san_luis',    label: 'San Luis RC / Arizona',            emoji: '🌵' },
  { key: 'other',       label: 'Other',                            emoji: '📍' },
]

const FACEBOOK_GROUPS: { name: string; regionKey: RegionKey; url: string; members: string }[] = [
  { name: 'FILAS DE PUENTES ANZALDUAS, HIDALGO, PHARR, DONNA, PROGRESO, INDIOS', regionKey: 'rgv', url: 'https://www.facebook.com/groups/2331786033753528', members: '' },
  { name: 'Fila en Puentes Reynosa Hidalgo, Anzalduas y Pharr',                  regionKey: 'rgv', url: 'https://www.facebook.com/groups/630300451147099', members: '' },
  { name: 'FILAS DE PUENTES REYNOSA HIDALGO, DONNA, PHARR, ANZALDUAS, PROGRESO', regionKey: 'rgv', url: 'https://www.facebook.com/groups/302019986939323', members: '' },
  { name: 'Fila en Puente Reynosa-Hidalgo',                                       regionKey: 'rgv', url: 'https://www.facebook.com/groups/978204527689403', members: '' },
  { name: 'Filas de Progreso, Donna, y Los Indios',                               regionKey: 'rgv', url: 'https://www.facebook.com/groups/302878187276542', members: '' },
  { name: 'FILA PUENTE LOS INDIOS',                                               regionKey: 'brownsville', url: 'https://www.facebook.com/groups/230659829875807', members: '' },
  { name: 'FILA PUENTE LOS INDIOS (2)',                                            regionKey: 'brownsville', url: 'https://www.facebook.com/groups/1731295540981020', members: '' },
  { name: 'Fila de Los Puentes Internacionales',                                  regionKey: 'brownsville', url: 'https://www.facebook.com/groups/796522180440318', members: '' },
  { name: 'Filas de Puentes Matamoros/Brownsville',                               regionKey: 'brownsville', url: 'https://www.facebook.com/groups/416633560460332', members: '' },
  { name: 'Matamoros/Brownsville Bridge Rows.',                                   regionKey: 'brownsville', url: 'https://www.facebook.com/groups/3374381019461919', members: '' },
  { name: 'Filas Puentes Bville/Matamoros — SOLO FILA PUENTES',                  regionKey: 'brownsville', url: 'https://www.facebook.com/groups/2232818820081853', members: '' },
  { name: 'Filas de Puentes Matamoros - Brownsville',                             regionKey: 'brownsville', url: 'https://www.facebook.com/groups/autosenmatamoros', members: '' },
  { name: 'Report on queues at international bridges in Nuevo Laredo',            regionKey: 'laredo', url: 'https://www.facebook.com/groups/276336942705237', members: '' },
  { name: 'Fila puente 2. nuevo laredo tamaulipas NO CENTRI',                     regionKey: 'laredo', url: 'https://www.facebook.com/groups/1752011028879761', members: '' },
  { name: 'Filas de los puentes 1 y 2 (Piedras Negras - Eagle Pass)',             regionKey: 'eagle_pass', url: 'https://www.facebook.com/groups/994149160726349', members: '' },
  { name: 'Puente Internacional Piedras Negras - Eagle Pass',                     regionKey: 'eagle_pass', url: 'https://www.facebook.com/groups/218202582825387', members: '' },
  { name: 'Reporte de Puentes Juarez-El Paso',                                    regionKey: 'el_paso', url: 'https://www.facebook.com/groups/1615115372079924', members: '' },
  { name: 'TU REPORTE PUENTES JUAREZ/EL PASO',                                   regionKey: 'el_paso', url: 'https://www.facebook.com/groups/reportepuentes', members: '' },
  { name: 'JRZ-ELP Bridge Report',                                                regionKey: 'el_paso', url: 'https://www.facebook.com/groups/464122564438748', members: '' },
  { name: 'En Donde Va La Fila? San Luis RC',                                     regionKey: 'san_luis', url: 'https://www.facebook.com/groups/208758912816787', members: '' },
]

interface Advertiser {
  id: string
  business_name: string
  contact_email: string
  contact_phone: string
  website: string
  description: string
  status: string
  created_at: string
}

interface Subscription {
  id: string
  user_id: string
  tier: string
  status: string
  current_period_end: string
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'groups' | 'post' | 'cron' | 'advertisers' | 'subs'>('groups')
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [caption, setCaption] = useState('')
  const [loadingPost, setLoadingPost] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [cronApiKey, setCronApiKey] = useState('')
  const [cronCreateStatus, setCronCreateStatus] = useState<{ created: number; failed: number; firstError?: string | null } | null>(null)
  const [cronCreating, setCronCreating] = useState(false)
  const [postedGroups, setPostedGroups] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('cruzar_posted_groups')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    fetch('/api/admin/advertisers').then(r => r.json()).then(d => setAdvertisers(d.advertisers || []))
    fetch('/api/admin/subscriptions').then(r => r.json()).then(d => setSubs(d.subscriptions || []))
  }, [user])

  function togglePosted(name: string) {
    setPostedGroups(prev => {
      const next = prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
      localStorage.setItem('cruzar_posted_groups', JSON.stringify(next))
      return next
    })
  }

  function resetPosted() {
    setPostedGroups([])
    localStorage.removeItem('cruzar_posted_groups')
  }

  async function generatePost(region = selectedRegion) {
    setLoadingPost(true)
    try {
      const regionParam = region !== 'all' ? `&region=${region}` : ''
      const res = await fetch(`/api/generate-post?secret=${process.env.NEXT_PUBLIC_CRON_SECRET || ''}&email=false${regionParam}`)
      const data = await res.json()
      setCaption(data.caption || '')
    } catch {
      setCaption('Error fetching post. Try again.')
    } finally {
      setLoadingPost(false)
    }
  }

  async function createAllCronJobs() {
    if (!cronApiKey.trim()) return
    setCronCreating(true)
    setCronCreateStatus(null)
    try {
      const res = await fetch('/api/admin/create-cron-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronApiKey: cronApiKey.trim() }),
      })
      const data = await res.json()
      setCronCreateStatus({ created: data.created, failed: data.failed, firstError: data.firstError })
    } catch {
      setCronCreateStatus({ created: 0, failed: 24 })
    } finally {
      setCronCreating(false)
    }
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <div className="pt-6 pb-4">
          <h1 className="text-xl font-bold text-gray-900">🔐 Admin Panel</h1>
          <p className="text-xs text-gray-400">cruzar.app</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(['groups', 'post', 'cron', 'advertisers', 'subs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {t === 'groups' ? `📣 Groups (${FACEBOOK_GROUPS.length})` :
               t === 'post' ? '✍️ Posts' :
               t === 'cron' ? '⏰ Cron Jobs' :
               t === 'advertisers' ? `Ads (${advertisers.length})` :
               `Subs (${subs.length})`}
            </button>
          ))}
        </div>

        {/* Facebook Groups Tracker */}
        {tab === 'groups' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Facebook Groups</p>
                <p className="text-xs text-gray-500">{postedGroups.length}/{FACEBOOK_GROUPS.length} posted today — check off as you go</p>
              </div>
              {postedGroups.length > 0 && (
                <button onClick={resetPosted} className="text-xs text-red-500 hover:text-red-700">Reset all</button>
              )}
            </div>
            {REGIONS.map(region => {
              const groups = FACEBOOK_GROUPS.filter(g => g.regionKey === region.key)
              if (groups.length === 0) return null
              const doneCount = groups.filter(g => postedGroups.includes(g.name)).length
              return (
                <div key={region.key} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {region.emoji} {region.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{doneCount}/{groups.length}</span>
                      <button
                        onClick={() => { setTab('post'); setSelectedRegion(region.key); setCaption('') }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        Generate post <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {groups.map(g => (
                      <div key={g.name} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between gap-3 transition-colors ${postedGroups.includes(g.name) ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => togglePosted(g.name)}
                            className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${postedGroups.includes(g.name) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                          >
                            {postedGroups.includes(g.name) && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${postedGroups.includes(g.name) ? 'text-green-800 line-through' : 'text-gray-900'}`}>{g.name}</p>
                            {g.members && <p className="text-xs text-gray-400">{g.members} members</p>}
                          </div>
                        </div>
                        <a href={g.url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">📅 Best times to post</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-amber-700">
                <span>🌅 5:30am — morning commute</span>
                <span>☀️ 11:30am — midday truckers</span>
                <span>🌆 3:30pm — after work/school</span>
                <span>🌙 7:00pm — evening crossing</span>
              </div>
            </div>
          </div>
        )}

        {/* Post Generator */}
        {tab === 'post' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Generate Live Post</p>
                <p className="text-xs text-gray-500">Pulls live wait times right now and formats a ready-to-paste caption</p>
              </div>
            </div>
            {/* Region selector */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[{ key: 'all', label: '🌎 All Regions' }, ...REGIONS.map(r => ({ key: r.key, label: `${r.emoji} ${r.label}` }))].map(r => (
                <button
                  key={r.key}
                  onClick={() => { setSelectedRegion(r.key); setCaption('') }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selectedRegion === r.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => generatePost(selectedRegion)}
              disabled={loadingPost}
              className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 mb-4"
            >
              {loadingPost ? 'Fetching live data...' : '⚡ Generate Post Now'}
            </button>
            {caption && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Ready to copy</p>
                  <button onClick={copyCaption} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900">
                    {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <pre className="px-4 py-4 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{caption}</pre>
              </div>
            )}
            {/* Cron setup per region */}
            {(() => {
              // Peak times in local time → UTC during daylight saving (summer) and standard (winter)
              const CRON_DATA: Record<string, { tz: string; localTimes: string[]; summerUTC: string[]; winterUTC: string[] }> = {
                all:         { tz: 'CST/CDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['10:30','16:30','20:30','00:00'], winterUTC: ['11:30','17:30','21:30','01:00'] },
                rgv:         { tz: 'CST/CDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['10:30','16:30','20:30','00:00'], winterUTC: ['11:30','17:30','21:30','01:00'] },
                brownsville: { tz: 'CST/CDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['10:30','16:30','20:30','00:00'], winterUTC: ['11:30','17:30','21:30','01:00'] },
                laredo:      { tz: 'CST/CDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['10:30','16:30','20:30','00:00'], winterUTC: ['11:30','17:30','21:30','01:00'] },
                eagle_pass:  { tz: 'CST/CDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['10:30','16:30','20:30','00:00'], winterUTC: ['11:30','17:30','21:30','01:00'] },
                el_paso:     { tz: 'MST/MDT', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['11:30','17:30','21:30','01:00'], winterUTC: ['12:30','18:30','22:30','02:00'] },
                san_luis:    { tz: 'MST (no DST)', localTimes: ['5:30am','11:30am','3:30pm','7:00pm'], summerUTC: ['12:30','18:30','22:30','02:00'], winterUTC: ['12:30','18:30','22:30','02:00'] },
              }
              const data = CRON_DATA[selectedRegion] || CRON_DATA.all
              const regionParam = selectedRegion !== 'all' ? `&region=${selectedRegion}` : ''
              const baseUrl = `https://www.cruzar.app/api/generate-post?secret=YOUR_SECRET${regionParam}`
              return (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">
                    📧 Auto-email cron setup
                    {selectedRegion !== 'all' && <span className="ml-1 font-normal text-blue-600">— {REGIONS.find(r => r.key === selectedRegion)?.label}</span>}
                  </p>
                  <p className="text-xs text-blue-700 mb-2">
                    Add these 4 jobs to cron-job.org · Timezone: <strong>{data.tz}</strong>
                    {selectedRegion === 'el_paso' && <span className="ml-1 text-orange-600">(1 hr behind Texas)</span>}
                  </p>
                  <div className="space-y-1">
                    {data.localTimes.map((local, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 w-16 flex-shrink-0">{local}</span>
                        <code className="flex-1 text-xs bg-blue-100 rounded px-2 py-1 text-blue-900 break-all">
                          {baseUrl} — UTC {data.summerUTC[i]} (summer) / {data.winterUTC[i]} (winter)
                        </code>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-2">⚠️ Cron-job.org runs in UTC — times shift by ±1hr in March & November when clocks change.</p>
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'cron' && (() => {
          const SECRET_PLACEHOLDER = 'YOUR_CRON_SECRET'
          const BASE = 'https://www.cruzar.app/api/generate-post'

          const CRON_REGIONS = [
            {
              key: 'rgv', label: 'RGV / McAllen', emoji: '🌵',
              tz: 'CST/CDT (Central)', note: 'Same times for Brownsville, Laredo, Eagle Pass',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'brownsville', label: 'Matamoros / Brownsville', emoji: '🏙️',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'laredo', label: 'Laredo / Nuevo Laredo', emoji: '🛣️',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'eagle_pass', label: 'Eagle Pass / Piedras Negras', emoji: '🦅',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'el_paso', label: 'El Paso / Juárez', emoji: '⛰️',
              tz: 'MST/MDT (Mountain — 1hr behind TX)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '11:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '17:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '21:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '01:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
            {
              key: 'san_luis', label: 'San Luis RC / Arizona', emoji: '🌵',
              tz: 'MST always — no DST (UTC-7 year-round)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
          ]

          function copyUrl(url: string) {
            navigator.clipboard.writeText(url)
            setCopiedUrl(url)
            setTimeout(() => setCopiedUrl(null), 2000)
          }

          return (
            <div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900">⏰ Cron Job Setup</p>
                <p className="text-xs text-gray-500 mt-0.5">Auto-create all 24 jobs at once, or copy URLs manually below.</p>
              </div>

              {/* Auto-create section */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
                <p className="text-xs font-bold text-green-800 mb-1">⚡ Auto-Create 4 Cron Jobs</p>
                <p className="text-xs text-green-700 mb-3">
                  One job per peak time — each one emails all regions at once. Get your API key from <strong>cron-job.org → API → Create API Key</strong>, paste it below.
                </p>
                <input
                  type="password"
                  placeholder="cron-job.org API key"
                  value={cronApiKey}
                  onChange={e => setCronApiKey(e.target.value)}
                  className="w-full border border-green-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-green-400 mb-3"
                />
                <button
                  onClick={createAllCronJobs}
                  disabled={cronCreating || !cronApiKey.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {cronCreating ? 'Creating jobs...' : '🚀 Create All 4 Cron Jobs'}
                </button>
                {cronCreateStatus && (
                  <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${cronCreateStatus.failed === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {cronCreateStatus.failed === 0
                      ? `✅ All ${cronCreateStatus.created} jobs created successfully!`
                      : <>
                          <p>⚠️ {cronCreateStatus.created} created, {cronCreateStatus.failed} failed</p>
                          {cronCreateStatus.firstError && <p className="mt-1 font-mono font-normal break-all">{cronCreateStatus.firstError}</p>}
                        </>}
                  </div>
                )}
              </div>
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800">⚠️ When clocks change</p>
                <p className="text-xs text-amber-700 mt-0.5">In <strong>March</strong> (spring forward): switch to Summer UTC. In <strong>November</strong> (fall back): switch to Winter UTC. San Luis / Arizona never changes.</p>
              </div>

              <div className="space-y-5">
                {CRON_REGIONS.map(region => (
                  <div key={region.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{region.emoji} {region.label}</p>
                        <p className="text-xs text-gray-500">{region.tz}</p>
                        {region.note && <p className="text-xs text-blue-600 mt-0.5">{region.note}</p>}
                      </div>
                      <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">4 jobs</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {region.jobs.map((job, i) => {
                        const url = `${BASE}?secret=${SECRET_PLACEHOLDER}&region=${region.key}`
                        const isSame = job.utcSummer === job.utcWinter
                        return (
                          <div key={i} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-gray-700">{job.local} — {job.label}</span>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {isSame
                                  ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">UTC {job.utcSummer}</span>
                                  : <>
                                      <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-mono">☀️ {job.utcSummer}</span>
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">❄️ {job.utcWinter}</span>
                                    </>
                                }
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 break-all">{url}</code>
                              <button
                                onClick={() => copyUrl(url)}
                                className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition-colors"
                              >
                                {copiedUrl === url ? <><Check className="w-3 h-3 text-green-500" /> Done</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">📋 How to add each job on cron-job.org</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to cron-job.org → Jobs → Create cronjob</li>
                  <li>Paste the URL (replace YOUR_CRON_SECRET first)</li>
                  <li>Set Method to GET</li>
                  <li>Set Schedule → Custom → enter the UTC time above</li>
                  <li>Set Days → Every day</li>
                  <li>Save → enable the job</li>
                </ol>
              </div>
            </div>
          )
        })()}

        {tab === 'advertisers' && (
          <div className="space-y-3">
            {advertisers.length === 0 && <p className="text-gray-400 text-sm">No applications yet.</p>}
            {advertisers.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{a.business_name}</p>
                    <p className="text-xs text-gray-500">{a.contact_email} · {a.contact_phone}</p>
                    {a.website && <p className="text-xs text-blue-500">{a.website}</p>}
                    {a.description && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    a.status === 'active' ? 'bg-green-100 text-green-700' :
                    a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{a.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'subs' && (
          <div className="space-y-3">
            {subs.length === 0 && <p className="text-gray-400 text-sm">No subscriptions yet.</p>}
            {subs.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.user_id}</p>
                  <p className="text-xs text-gray-500">Tier: {s.tier} · Status: {s.status}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{s.tier}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
