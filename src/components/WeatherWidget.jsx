import React, { useState, useEffect, useRef } from 'react'
import { Cloud, Sun, CloudRain, Wind, Droplets, MapPin, RefreshCw, Clock, CloudLightning, Snowflake, CloudDrizzle, Bell, BellOff } from 'lucide-react'
import { supabase } from '../supabaseClient'

const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const WMO_CODES = {
  0:  { label: 'Helder',              icon: Sun },
  1:  { label: 'Overwegend helder',   icon: Sun },
  2:  { label: 'Gedeeltelijk bewolkt',icon: Cloud },
  3:  { label: 'Bewolkt',             icon: Cloud },
  45: { label: 'Mist',                icon: Cloud },
  48: { label: 'Rijpmist',            icon: Cloud },
  51: { label: 'Lichte motregen',     icon: CloudDrizzle },
  53: { label: 'Matige motregen',     icon: CloudDrizzle },
  55: { label: 'Zware motregen',      icon: CloudDrizzle },
  61: { label: 'Lichte regen',        icon: CloudRain },
  63: { label: 'Matige regen',        icon: CloudRain },
  65: { label: 'Zware regen',         icon: CloudRain },
  71: { label: 'Lichte sneeuw',       icon: Snowflake },
  73: { label: 'Matige sneeuw',       icon: Snowflake },
  75: { label: 'Zware sneeuw',        icon: Snowflake },
  80: { label: 'Lichte buien',        icon: CloudRain },
  81: { label: 'Matige buien',        icon: CloudRain },
  82: { label: 'Zware buien',         icon: CloudRain },
  95: { label: 'Onweer',              icon: CloudLightning },
  96: { label: 'Onweer met hagel',    icon: CloudLightning },
  99: { label: 'Zwaar onweer',        icon: CloudLightning },
}

const DAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const REFRESH_INTERVAL = 10 * 60 * 1000

// Buienalarm API — heeft Access-Control-Allow-Origin: * dus direct aanroepen kan
// Retourneert JSON: { start (unix s), delta (s), precip: float[] }
async function fetchBuienalarm(lat, lon) {
  const res = await fetch(
    `https://cdn-secure.buienalarm.nl/api/3.4/forecast.php?lat=${lat}&lon=${lon}&region=nl&unit=mm/u`
  )
  const json = await res.json()
  if (!json?.precip?.length) return []
  return json.precip.map((precip, i) => {
    const d = new Date((json.start + i * json.delta) * 1000)
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    return { precip: isNaN(precip) ? 0 : precip, time }
  })
}

// SVG area chart — Buienalarm style
function RainChart({ data }) {
  if (!data?.length) return null
  const W = 260, H = 80, PAD_L = 28, PAD_B = 18, PAD_R = 4, PAD_T = 6
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const max = Math.max(...data.map(d => d.precip), 0.5)

  // Y-axis ticks
  const yTicks = max <= 1 ? [0, 0.5, 1] : max <= 2 ? [0, 1, 2] : [0, 2, Math.ceil(max)]

  const divisor = data.length > 1 ? data.length - 1 : 1
  const xOf = i => PAD_L + (i / divisor) * innerW
  const yOf = v => PAD_T + innerH - (v / yTicks[yTicks.length - 1]) * innerH

  // Build SVG path
  const points = data.map((d, i) => [xOf(i), yOf(d.precip)])
  const lineD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaD = `${lineD} L${points[points.length-1][0].toFixed(1)},${(PAD_T+innerH).toFixed(1)} L${PAD_L},${(PAD_T+innerH).toFixed(1)} Z`

  // Time label indices: every 6 = 30 min
  const labelIdxs = [0, 6, 12, 18, 23]

  return (
    <div style={{ marginTop: 8 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,180,255,0.55)" />
            <stop offset="100%" stopColor="rgba(0,180,255,0.03)" />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {yTicks.map(v => {
          const y = yOf(v)
          return (
            <g key={v}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,3" />
              <text x={PAD_L - 3} y={y + 3} textAnchor="end"
                style={{ fontSize: 7, fill: 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif' }}>
                {v}
              </text>
            </g>
          )
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#rainGrad)" />

        {/* Line */}
        <path d={lineD} fill="none" stroke="rgba(0,200,255,0.85)" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Dots on rainy points */}
        {data.map((d, i) => d.precip > 0.1 && (
          <circle key={i} cx={xOf(i)} cy={yOf(d.precip)} r="2"
            fill="rgba(0,200,255,0.9)" />
        ))}

        {/* X axis baseline */}
        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH}
          stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* X time labels */}
        {labelIdxs.map(i => (
          <text key={i} x={xOf(i)} y={H - 2} textAnchor="middle"
            style={{ fontSize: 7, fill: 'rgba(255,255,255,0.35)', fontFamily: 'sans-serif' }}>
            {data[i]?.time?.slice(0, 5) || ''}
          </text>
        ))}
      </svg>
    </div>
  )
}

// 7-day week row
function WeekRow({ day, isToday }) {
  const Icon = WMO_CODES[day.weathercode]?.icon || Cloud
  const date = new Date(day.date)
  const dayName = isToday ? 'Vandaag' : DAY_NAMES[date.getDay()]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '52px 22px 1fr auto',
      alignItems: 'center',
      gap: 8,
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 11, color: isToday ? 'var(--accent)' : 'rgba(255,255,255,0.55)', fontWeight: isToday ? 600 : 400 }}>
        {dayName}
      </span>
      <Icon size={14} style={{ color: isToday ? 'var(--accent)' : 'rgba(255,255,255,0.5)' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
        {day.precipitation_sum > 0 && (
          <span style={{ fontSize: 9, color: 'rgba(0,200,255,0.7)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Droplets size={9} /> {day.precipitation_sum.toFixed(1)}mm
          </span>
        )}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Wind size={9} /> {Math.round(day.windspeed_10m_max)} km/u
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{Math.round(day.temperature_2m_min)}°</span>
        <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>{Math.round(day.temperature_2m_max)}°</span>
      </div>
    </div>
  )
}

export default function WeatherWidget({ stacked = false, userId, onRequestPwaInstall }) {
  const [weather, setWeather]       = useState(null)
  const [weekly, setWeekly]         = useState(null)
  const [rain, setRain]             = useState(null)
  const [coords, setCoords]         = useState(null)
  const [city, setCity]             = useState('Dronten')
  const [loading, setLoading]       = useState(false)
  const [rainLoading, setRainLoading] = useState(false)
  const [error, setError]           = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [timeSince, setTimeSince]   = useState('')
  const [tab, setTab]               = useState('huidig') // 'huidig' | 'buien' | 'week'
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const timerRef = useRef(null)

  const fetchWeather = async (cityName = city) => {
    setLoading(true); setError('')
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=nl&format=json`
      )
      const geoData = await geoRes.json()
      if (!geoData.results?.length) { setError('Stad niet gevonden'); setLoading(false); return }
      const { latitude, longitude, name } = geoData.results[0]
      setCoords({ lat: latitude, lon: longitude })
      localStorage.setItem('weather_coords', JSON.stringify({ lat: latitude, lon: longitude }))

      // Current + daily in one call
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
        `&timezone=auto`
      )
      const wData = await wRes.json()
      setWeather({ ...wData.current, city: name })

      // Build weekly array
      const days = wData.daily.time.map((date, i) => ({
        date,
        weathercode:        wData.daily.weathercode[i],
        temperature_2m_max: wData.daily.temperature_2m_max[i],
        temperature_2m_min: wData.daily.temperature_2m_min[i],
        precipitation_sum:  wData.daily.precipitation_sum[i] ?? 0,
        windspeed_10m_max:  wData.daily.windspeed_10m_max[i],
      }))
      setWeekly(days)
      setLastUpdated(new Date())
    } catch { setError('Kon weer niet laden') }
    setLoading(false)
  }

  const loadRain = async (overrideCoords) => {
    const c = overrideCoords || coords
    if (!c) return
    setRainLoading(true)
    try {
      const cacheKey = `buienalarm_${c.lat}_${c.lon}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 5 * 60 * 1000) { setRain(data); setRainLoading(false); return }
      }
      const data = await fetchBuienalarm(c.lat, c.lon)
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }))
      setRain(data)
    } catch { setRain([]) }
    setRainLoading(false)
  }

  // Check if notifications already enabled
  useEffect(() => {
    if (!userId || !('Notification' in window)) return
    supabase.from('push_subscriptions').select('id').eq('user_id', userId).eq('rain_enabled', true).maybeSingle()
      .then(({ data }) => { if (data) setNotifEnabled(true) })
  }, [userId])

  const toggleRainNotification = async () => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Je browser ondersteunt geen push notificaties.')
      return
    }

    // If enabling: request permission, subscribe, save
    if (!notifEnabled) {
      // Prompt PWA install if not in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
      if (!isStandalone && onRequestPwaInstall) {
        onRequestPwaInstall()
      }
      setNotifLoading(true)
      try {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { setNotifLoading(false); return }

        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        })

        const { data: existingRow } = await supabase.from('push_subscriptions').select('id').eq('user_id', userId).maybeSingle()
        let error
        if (existingRow) {
          ;({ error } = await supabase.from('push_subscriptions').update({
            subscription: sub.toJSON(),
            lat: coords?.lat ?? 52.5,
            lon: coords?.lon ?? 5.6,
            rain_enabled: true,
            rain_interval_minutes: 60,
          }).eq('user_id', userId))
        } else {
          ;({ error } = await supabase.from('push_subscriptions').insert({
            user_id: userId,
            subscription: sub.toJSON(),
            lat: coords?.lat ?? 52.5,
            lon: coords?.lon ?? 5.6,
            rain_enabled: true,
            rain_interval_minutes: 60,
          }))
        }

        if (error) throw error
        setNotifEnabled(true)

        // Test notificatie
        const reg2 = await navigator.serviceWorker.ready
        reg2.showNotification('Buien notificaties aangezet', {
          body: 'Je ontvangt een melding als het gaat regenen.',
          icon: '/icon-192.png',
          tag: 'rain-enabled',
        })
      } catch (e) {
        console.error('Notificatie inschakelen mislukt:', e)
        alert('Notificaties inschakelen mislukt. Controleer je browserinstellingen.')
      }
      setNotifLoading(false)
    } else {
      // Disable
      setNotifLoading(true)
      await supabase.from('push_subscriptions').update({ rain_enabled: false }).eq('user_id', userId)
      setNotifEnabled(false)
      setNotifLoading(false)
    }
  }

  // Switch to buien tab → fetch rain (stacked is al gedaan bij mount)
  useEffect(() => {
    if ((tab === 'buien' || stacked) && coords && !rain) loadRain()
  }, [tab, coords])

  // Auto-refresh — start buienalarm direct parallel met cached coords
  useEffect(() => {
    const stored = localStorage.getItem('weather_coords')
    if (stored) {
      try {
        const c = JSON.parse(stored)
        setCoords(c)
        if (stacked) loadRain(c)
      } catch {}
    }
    fetchWeather()
    timerRef.current = setInterval(() => fetchWeather(), REFRESH_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [])

  // "X min geleden" ticker
  useEffect(() => {
    const update = () => {
      if (!lastUpdated) return
      const diff = Math.floor((new Date() - lastUpdated) / 1000)
      if (diff < 60) setTimeSince('zojuist')
      else if (diff < 3600) setTimeSince(`${Math.floor(diff / 60)} min geleden`)
      else setTimeSince(`${Math.floor(diff / 3600)} uur geleden`)
    }
    update()
    const iv = setInterval(update, 30000)
    return () => clearInterval(iv)
  }, [lastUpdated])

  const code = weather?.weathercode
  const WeatherIcon = WMO_CODES[code]?.icon || Cloud
  const label = WMO_CODES[code]?.label || 'Onbekend'

  // Rain intensity label
  const rainMax = rain ? Math.max(...rain.map(d => d.precip)) : 0
  const rainLabel =
    !rain ? '' :
    rainMax === 0       ? 'Geen neerslag de komende 2 uur' :
    rainMax < 0.5       ? 'Lichte regen verwacht' :
    rainMax < 2         ? 'Matige regen verwacht' :
                          'Zware regen verwacht'

  const tabStyle = (t) => ({
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: tab === t ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
    color: tab === t ? '#000' : 'rgba(255,255,255,0.5)',
    fontWeight: tab === t ? 600 : 400,
    transition: 'all 0.15s',
  })

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold text-white">Weer</h3>
        </div>
        <button onClick={() => { fetchWeather(); if (tab === 'buien') { setRain(null) } }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* City search */}
      <div className="flex gap-2 mb-3">
        <input type="text" value={city} onChange={e => setCity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchWeather(city)}
          className="glass-input flex-1" style={{ fontSize: '12px', padding: '6px 10px' }}
          placeholder="Stad..." />
        <button onClick={() => { fetchWeather(city); setRain(null) }} className="btn-neon" style={{ padding: '6px 12px', fontSize: '12px' }}>
          Zoek
        </button>
      </div>

      {/* Tabs (hidden in stacked mode) */}
      {!stacked && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          <button style={tabStyle('huidig')} onClick={() => setTab('huidig')}>Huidig</button>
          <button style={tabStyle('buien')}  onClick={() => { setTab('buien'); if (coords && !rain) loadRain() }}>Buienradar</button>
          <button style={tabStyle('week')}   onClick={() => setTab('week')}>Week</button>
        </div>
      )}


      {error && <p className="text-xs" style={{ color: '#ff6b6b' }}>{error}</p>}

      {/* ─── Huidig ─── */}
      {(stacked || tab === 'huidig') && weather && !error && (
        <div style={stacked ? { marginBottom: 20 } : {}}>
          {stacked && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase' }}>Huidig</p>}
          <div className="flex items-center gap-3 mb-2">
            <WeatherIcon size={stacked ? 40 : 32} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: stacked ? 36 : 28, fontWeight: 700, color: 'white' }}>{Math.round(weather.temperature_2m)}°C</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <MapPin size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{weather.city}</span>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Wind size={12} style={{ color: 'rgba(0,255,209,0.6)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{Math.round(weather.windspeed_10m)} km/u</span>
            </div>
            <div className="flex items-center gap-1">
              <Droplets size={12} style={{ color: 'rgba(0,255,209,0.6)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{weather.relativehumidity_2m}%</span>
            </div>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1 mt-2">
              <Clock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                Bijgewerkt {timeSince} · volgende update over {Math.max(0, 10 - Math.floor((new Date() - lastUpdated) / 60000))} min
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divider in stacked */}
      {stacked && weather && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />}

      {/* ─── Buienradar ─── */}
      {(stacked || tab === 'buien') && (
        <div style={stacked ? { marginBottom: 20 } : {}}>
          {stacked && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase' }}>Buienradar</p>}
          {rainLoading && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '12px 0' }}>
              Buienradar laden...
            </p>
          )}
          {!rainLoading && rain?.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <CloudRain size={13} style={{ color: rainMax > 0 ? 'rgba(0,200,255,0.8)' : 'rgba(255,255,255,0.3)' }} />
                <span style={{ fontSize: 11, color: rainMax > 0 ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                  {rainLabel}
                </span>
              </div>
              <RainChart data={rain} />
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
                Bron: Buienalarm · komende 2 uur · per 5 min
              </p>
            </>
          )}
          {/* Vernieuwen + notificatieknop altijd zichtbaar (niet afhankelijk van rain data) */}
          {!rainLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <button onClick={() => { setRain(null); loadRain() }}
                style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                {rain === null && !coords ? 'Zoek eerst een stad' : 'Vernieuwen'}
              </button>
              {userId && 'Notification' in window && (
                <button
                  onClick={toggleRainNotification}
                  disabled={notifLoading}
                  title={notifEnabled ? 'Regenmelding uitschakelen' : 'Melding bij regen'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    border: notifEnabled ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.15)',
                    background: notifEnabled ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
                    color: notifEnabled ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.4)',
                    opacity: notifLoading ? 0.5 : 1,
                  }}
                >
                  {notifEnabled ? <Bell size={10} /> : <BellOff size={10} />}
                  {notifEnabled ? 'Melding aan' : 'Melding uit'}
                </button>
              )}
            </div>
          )}
          {!rainLoading && rain?.length === 0 && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Geen buiendata beschikbaar.</p>
          )}
          {!rainLoading && !rain && !coords && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Zoek eerst een stad.</p>
          )}
        </div>
      )}

      {/* Divider in stacked */}
      {stacked && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />}

      {/* ─── Week ─── */}
      {(stacked || tab === 'week') && (
        <div>
          {stacked && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase' }}>7-daagse prognose</p>}
          {!weekly && !error && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Laden...</p>
          )}
          {weekly && (
            <div>
              {weekly.map((day, i) => (
                <WeekRow key={day.date} day={day} isToday={i === 0} />
              ))}
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
                Bron: Open-Meteo · 7-daagse prognose
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
