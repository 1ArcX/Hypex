import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Truck, RefreshCw, AlertCircle, ChevronDown, ChevronUp, LogIn, LogOut, Map as MapIcon, Bell, BellOff } from 'lucide-react'
import { supabase } from '../supabaseClient'

const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function sendVrachtPush(userId, title, body, tag = 'vracht') {
  if (!userId) return
  try {
    await fetch('/.netlify/functions/pomodoro-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, tag }),
    })
  } catch (e) { console.error('Vracht push failed:', e) }
}

async function registerVrachtSubscription(userId) {
  if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })
    const { data: existing } = await supabase.from('push_subscriptions').select('id').eq('user_id', userId).maybeSingle()
    if (existing) {
      await supabase.from('push_subscriptions').update({ subscription: sub.toJSON(), vracht_enabled: true }).eq('user_id', userId)
    } else {
      await supabase.from('push_subscriptions').insert({ user_id: userId, subscription: sub.toJSON(), vracht_enabled: true })
    }
  } catch (e) { console.error('Vracht subscribe failed:', e) }
}

async function saveVrachtNotifyStops(userId, stopIds) {
  if (!userId) return
  await supabase.from('push_subscriptions').update({ vracht_notify_stops: stopIds }).eq('user_id', userId)
}

async function saveSimacanState(userId, stopStates) {
  if (!userId) return
  await supabase.from('simacan_state').upsert({ user_id: userId, stop_states: stopStates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

// Jumbo 7044 — Dronten
const STORE_LAT = 52.5222
const STORE_LNG = 5.7178

const API          = '/.netlify/functions/simacan'
const STORAGE_KEY  = 'simacan_tokens'
const KC_BASE      = 'https://sso.simacan.com/auth/realms/jumbo-sc/protocol/openid-connect'
const KC_CLIENT_ID = 'frontend'

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function randomBase64url(len = 32) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
async function sha256Base64url(plain) {
  const data = new TextEncoder().encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
}
async function exchangeCode(code, verifier, redirectUri) {
  const res = await fetch(`${KC_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'authorization_code', client_id:KC_CLIENT_ID, code, code_verifier:verifier, redirect_uri:redirectUri }).toString()
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token ophalen mislukt')
  return data
}

// ─── Polyline decoder (Google encoded polyline format) ────────────────────────
function decodePolyline(encoded) {
  if (!encoded) return []
  const coords = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

// Dark raster style — vermijdt MapLibre 5.x worker-compatibiliteitsproblemen met vector dark styles
const DARK_MAP_STYLE = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 19,
    }
  },
  layers: [{ id: 'carto-dark-tiles', type: 'raster', source: 'carto-dark' }]
}

// ─── Route map component (fullscreen popup, dark style) ───────────────────────
function RouteMap({ routeStops, vehiclePos, onClose, tripLabel }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    let map
    let cancelled = false

    // Dynamisch laden zodat MapLibre niet bij app-start initialiseert
    import('maplibre-gl').then(mod => {
      const mgl = mod.default || mod
      if (cancelled || !containerRef.current) return

      // Laad CSS eenmalig
      if (!document.querySelector('link[data-maplibre]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl@5.20.1/dist/maplibre-gl.css'
        link.setAttribute('data-maplibre', '1')
        document.head.appendChild(link)
      }

      map = new mgl.Map({
        container: containerRef.current,
        style: DARK_MAP_STYLE,
        center: [STORE_LNG, STORE_LAT],
        zoom: 8,
        attributionControl: false,
      })
      map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        const allCoords = []
        for (const s of routeStops) {
          if (s.polyline) allCoords.push(...decodePolyline(s.polyline))
        }

        if (allCoords.length > 0) {
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: allCoords } }
          })
          map.addLayer({
            id: 'route-line-outline',
            type: 'line', source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': 'rgba(255,255,255,0.25)', 'line-width': 9 }
          })
          map.addLayer({
            id: 'route-line',
            type: 'line', source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 1 }
          })

          const bounds = allCoords.reduce(
            (b, c) => b.extend(c),
            new mgl.LngLatBounds(allCoords[0], allCoords[0])
          )
          bounds.extend([STORE_LNG, STORE_LAT])
          if (vehiclePos) bounds.extend([vehiclePos.lng, vehiclePos.lat])
          map.fitBounds(bounds, { padding: 60, maxZoom: 13 })
        } else {
          const pts = [[STORE_LNG, STORE_LAT]]
          if (vehiclePos) pts.push([vehiclePos.lng, vehiclePos.lat])
          routeStops.forEach(s => { if (s.lat != null) pts.push([s.lng, s.lat]) })
          if (pts.length > 1) {
            const bounds = pts.reduce((b, c) => b.extend(c), new mgl.LngLatBounds(pts[0], pts[0]))
            map.fitBounds(bounds, { padding: 80, maxZoom: 13 })
          }
        }

        for (const s of routeStops) {
          if (s.lat == null || s.lng == null) continue
          const el = document.createElement('div')
          el.style.cssText = [
            'width:26px', 'height:26px', 'border-radius:50%',
            'background:#3b82f6', 'border:2px solid white',
            'display:flex', 'align-items:center', 'justify-content:center',
            'color:white', 'font-size:11px', 'font-weight:700',
            'box-shadow:0 2px 8px rgba(0,0,0,0.6)', 'cursor:default'
          ].join(';')
          el.textContent = s.stopNumber != null ? String(s.stopNumber) : ''
          new mgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map)
        }

        if (vehiclePos?.lat != null && vehiclePos?.lng != null) {
          const el = document.createElement('div')
          el.style.cssText = [
            'width:34px', 'height:34px', 'border-radius:50%',
            'background:#f97316', 'border:2px solid white',
            'display:flex', 'align-items:center', 'justify-content:center',
            'box-shadow:0 0 16px rgba(249,115,22,0.8)', 'cursor:default', 'font-size:18px'
          ].join(';')
          el.textContent = '🚛'
          new mgl.Marker({ element: el }).setLngLat([vehiclePos.lng, vehiclePos.lat]).addTo(map)
        }

        const storeEl = document.createElement('div')
        storeEl.style.cssText = [
          'width:16px', 'height:16px', 'border-radius:50%',
          'background:#3b82f6', 'border:3px solid white',
          'box-shadow:0 0 12px rgba(59,130,246,0.8)'
        ].join(';')
        new mgl.Marker({ element: storeEl }).setLngLat([STORE_LNG, STORE_LAT]).addTo(map)
      })
    }).catch(e => console.warn('MapLibre laden mislukt:', e))

    return () => { cancelled = true; if (map) map.remove() }
  }, [routeStops])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: '860px', height: 'min(80vh, 600px)',
        borderRadius: '16px', overflow: 'hidden', position: 'relative',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(10,10,26,0.95), rgba(10,10,26,0))',
        }}>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>
            🚛 {tripLabel || 'Route'}
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500,
          }}>✕ Sluiten</button>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' })
}

function delayBadge(minutes) {
  if (minutes == null) return null
  if (Math.abs(minutes) < 2) return null
  if (minutes > 0) return { text: `+${minutes}m`, color: '#f87171' }
  return { text: `${minutes}m`, color: '#4ade80' }
}

function activityColor(a) {
  if (!a) return 'rgba(255,255,255,0.35)'
  if (a === 'AFGEROND')   return '#4ade80'
  if (a === 'GEANNULEERD') return 'rgba(255,255,255,0.2)'
  if (a === 'GEPLAND')    return 'rgba(255,255,255,0.35)'
  return '#60a5fa'
}
function activityLabel(a) {
  const map = { AFGEROND:'Afgerond', GEPLAND:'Gepland', ONDERWEG:'Onderweg', ACTIEF:'Bezig', GEANNULEERD:'Geannuleerd' }
  return map[a] || a || ''
}

function palletSummary(drops) {
  const counts = {}
  for (const d of drops || []) {
    if (d.cancelled) continue
    for (const lc of d.loadCarriers || []) {
      const t = lc.loadCarrierType || 'OVERIG'
      counts[t] = (counts[t] || 0) + (lc.plannedAmount || 0)
    }
  }
  return counts
}
const PALLET_LABELS = { DIEPVRIES:'❄ Diepvries', AMBIENT:'Ambient', VERS:'Vers', OVERIG:'Overig', KOEL:'Koel' }

// ─── Component ────────────────────────────────────────────────────────────────
export default function VrachttijdenWidget() {
  const [userId, setUserId] = useState(null)
  const userIdRef = useRef(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null)
      userIdRef.current = user?.id || null
    })
  }, [])

  const [tokens,      setTokens]      = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } })
  const [stops,       setStops]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loginLoading,setLoginLoading]= useState(false)
  const [error,       setError]       = useState(null)
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [selectedStop,setSelectedStop]= useState(null)
  const [selectedDate,setSelectedDate]= useState(() => new Date().toISOString().slice(0,10))
  const [routeData,    setRouteData]   = useState({})
  const [showMap,      setShowMap]     = useState({})
  const [notifyStops,  setNotifyStops] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('simacan_notify') || '[]')) } catch { return new Set() } })

  const tokensRef        = useRef(tokens)
  const selectedDateRef  = useRef(selectedDate)
  const notifyStopsRef   = useRef(notifyStops)
  const prevStopStates   = useRef(new Map()) // stopId → { delay, activity, eta }

  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])
  useEffect(() => {
    notifyStopsRef.current = notifyStops
    localStorage.setItem('simacan_notify', JSON.stringify([...notifyStops]))
  }, [notifyStops])

  const accentBg     = p => `color-mix(in srgb, var(--accent) ${p}%, transparent)`
  const accentBorder = p => `1px solid color-mix(in srgb, var(--accent) ${p}%, transparent)`

  const saveTokens = useCallback(t => {
    tokensRef.current = t
    setTokens(t)
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    else   localStorage.removeItem(STORAGE_KEY)
    supabase.auth.updateUser({ data: { simacan_tokens: t || null } }).catch(() => {})
  }, [])

  // ─── Ritten ophalen ───────────────────────────────────────────────────────
  const fetchStops = useCallback(async (t = tokensRef.current, date = selectedDateRef.current) => {
    if (!t?.accessToken) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'locationStops', token:t.accessToken, refreshToken:t.refreshToken, date: new Date(date+'T12:00:00').toISOString() })
      })
      const data = await res.json()
      if (data._newTokens) saveTokens({ accessToken:data._newTokens.accessToken, refreshToken:data._newTokens.refreshToken || t.refreshToken })
      if (!res.ok) {
        if (res.status === 401) { saveTokens(null); setError('Sessie verlopen. Log opnieuw in.'); setLoading(false); return }
        throw new Error(data.error || 'Serverfout')
      }
      const raw = data.locationStops || data.stops || data.result || (Array.isArray(data) ? data : [])
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      setStops(arr)
      setLastUpdate(new Date())

      // ── Notificaties controleren (push) ───────────────────────────────────
      for (const stop of arr) {
        if (!notifyStopsRef.current.has(stop.id)) continue
        const eta    = stop.actualStartTime || stop.eta || stop.plannedStartTime
        const etaFmt = eta ? new Date(eta).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : '?'
        const act    = stop.tripStatus?.activity
        const delay  = stop.delay
        const tripId = stop.trip?.tripId || 'Rit'
        const prev   = prevStopStates.current.get(stop.id)

        if (prev) {
          if (prev.delay != null && delay != null && Math.abs(delay - prev.delay) >= 3) {
            const more = delay > prev.delay
            sendVrachtPush(userIdRef.current, '🚛 Vrachttijden',
              more ? `${tripId} loopt meer uit (+${delay} min) — komt nu om ${etaFmt}`
                   : `${tripId} loopt in (${delay > 0 ? '+' : ''}${delay} min) — komt om ${etaFmt}`,
              `delay-${stop.id}`)
          }
          if (prev.activity !== 'AFGEROND' && act === 'AFGEROND') {
            sendVrachtPush(userIdRef.current, '✅ Vracht aangekomen',
              `${tripId} is aangekomen${stop.actualStartTime ? ' om ' + new Date(stop.actualStartTime).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : ''}`,
              `arrived-${stop.id}`)
          }
        }
        prevStopStates.current.set(stop.id, { delay, activity: act, eta })
      }

      // Sla huidige staat op zodat de achtergrond-cron geen dubbele meldingen stuurt
      const stateSnapshot = {}
      for (const stop of arr) stateSnapshot[stop.id] = { delay: stop.delay, activity: stop.tripStatus?.activity, eta: stop.actualStartTime || stop.eta || stop.plannedStartTime }
      saveSimacanState(userIdRef.current, stateSnapshot)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [saveTokens])

  // ─── Route ophalen voor kaart ─────────────────────────────────────────────
  const fetchRoute = useCallback(async (stop) => {
    const stopId   = stop.id
    const tripUuid = stop.tripStatus?.uuid   // correcte UUID zit in tripStatus.uuid
    const lkp      = stop.tripStatus?.lastKnownPosition
    const vehiclePos = Array.isArray(lkp) && lkp.length >= 2
      ? { lng: lkp[0], lat: lkp[1] }
      : lkp?.latitude != null ? { lat: lkp.latitude, lng: lkp.longitude }
      : lkp?.lat != null ? { lat: lkp.lat, lng: lkp.lng }
      : null

    if (!tripUuid) {
      setRouteData(p => ({ ...p, [stopId]: { stops: [], vehiclePos, error: 'Geen trip-UUID in tripStatus' } }))
      return
    }
    setRouteData(p => ({ ...p, [stopId]: { stops: [], vehiclePos, loading: true } }))
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'tripRoute', token:tokensRef.current.accessToken, refreshToken:tokensRef.current.refreshToken, tripUuid })
      })
      const data = await res.json()
      if (data._newTokens) saveTokens({ accessToken:data._newTokens.accessToken, refreshToken:data._newTokens.refreshToken || tokensRef.current.refreshToken })
      if (!res.ok) throw new Error(data.error || 'Route ophalen mislukt')
      setRouteData(p => ({ ...p, [stopId]: { stops: data.stops || [], vehiclePos, loading: false } }))
    } catch (e) {
      setRouteData(p => ({ ...p, [stopId]: { stops: [], loading: false, error: e.message } }))
    }
  }, [saveTokens])

  const toggleNotify = useCallback(async (stopId) => {
    if (notifyStopsRef.current.has(stopId)) {
      const updated = new Set([...notifyStopsRef.current].filter(id => id !== stopId))
      setNotifyStops(updated)
      saveVrachtNotifyStops(userIdRef.current, [...updated])
    } else {
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return
      }
      await registerVrachtSubscription(userIdRef.current)
      const updated = new Set([...notifyStopsRef.current, stopId])
      setNotifyStops(updated)
      saveVrachtNotifyStops(userIdRef.current, [...updated])
      sendVrachtPush(userIdRef.current, '🔔 Vrachttijden', 'Je krijgt een melding bij vertraging of aankomst.', 'vracht-enabled')
    }
  }, [])

  const toggleMap = useCallback((stop) => {
    const id = stop.id
    setShowMap(p => {
      const next = !p[id]
      if (next && !routeData[id]) fetchRoute(stop)
      return { ...p, [id]: next }
    })
  }, [routeData, fetchRoute])

  // ─── Start ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Mobile redirect flow: check for pending auth code from simacan-callback.html
    const pendingRaw = localStorage.getItem('simacan_pending_code')
    const pendingErr = localStorage.getItem('simacan_pending_error')
    if (pendingErr) {
      localStorage.removeItem('simacan_pending_error')
      setError(pendingErr)
    }
    if (pendingRaw) {
      localStorage.removeItem('simacan_pending_code')
      try {
        const { code } = JSON.parse(pendingRaw)
        const verifier = sessionStorage.getItem('simacan_verifier')
        const redirectUri = `${window.location.origin}/simacan-callback.html`
        if (code && verifier) {
          sessionStorage.removeItem('simacan_verifier')
          exchangeCode(code, verifier, redirectUri).then(td => {
            const t = { accessToken: td.access_token, refreshToken: td.refresh_token }
            saveTokens(t); fetchStops(t)
          }).catch(e => setError(e.message))
          return
        }
      } catch (_) {}
    }

    if (tokens) { fetchStops(tokens); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      const t = user?.user_metadata?.simacan_tokens
      if (t?.accessToken) { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); tokensRef.current = t; setTokens(t); fetchStops(t) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!tokens || selectedDate !== new Date().toISOString().slice(0,10)) return
    const t = setInterval(() => fetchStops(), 60000)
    return () => clearInterval(t)
  }, [!!tokens, selectedDate, fetchStops])

  // ─── Login ────────────────────────────────────────────────────────────────
  const REDIRECT_URI = `${window.location.origin}/simacan-callback.html`

  const handleLogin = useCallback(async () => {
    setLoginLoading(true); setError(null)
    try {
      const verifier = randomBase64url(32); const challenge = await sha256Base64url(verifier); const state = randomBase64url(16)
      const authUrl = `${KC_BASE}/auth?` + new URLSearchParams({ client_id:KC_CLIENT_ID, response_type:'code', scope:'openid offline_access', redirect_uri:REDIRECT_URI, state, code_challenge:challenge, code_challenge_method:'S256' }).toString()
      // Sla verifier op voor redirect flow (mobiel herladen pagina)
      sessionStorage.setItem('simacan_verifier', verifier)
      const popup = window.open(authUrl, 'simacan_login', 'width=520,height=640,left=200,top=100')
      if (!popup) {
        // Mobiel: geen popup → volledige redirect
        window.location.href = authUrl
        return
      }
      await new Promise((resolve, reject) => {
        const handler = async (event) => {
          if (event.origin !== window.location.origin) return
          if (event.data?.type === 'simacan_auth_error') { window.removeEventListener('message', handler); reject(new Error(event.data.description || event.data.error)); return }
          if (event.data?.type !== 'simacan_auth') return
          if (event.data.state !== state) { reject(new Error('State mismatch')); return }
          window.removeEventListener('message', handler)
          sessionStorage.removeItem('simacan_verifier')
          try { const td = await exchangeCode(event.data.code, verifier, REDIRECT_URI); const t = { accessToken:td.access_token, refreshToken:td.refresh_token }; saveTokens(t); fetchStops(t); resolve() }
          catch (e) { reject(e) }
        }
        window.addEventListener('message', handler)
        setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Login timeout')) }, 5*60*1000)
        const chk = setInterval(() => { if (popup.closed) { clearInterval(chk); window.removeEventListener('message', handler); reject(new Error('Login geannuleerd')) } }, 500)
      })
    } catch (e) { setError(e.message) }
    setLoginLoading(false)
  }, [saveTokens, fetchStops])

  // ─── Datum helpers ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0,10)
  const changeDate = (nd) => { setSelectedDate(nd); setStops(null); setSelectedStop(null); setRouteData({}); setShowMap({}); fetchStops(tokensRef.current, nd) }

  // ─── Gesorteerde stops ────────────────────────────────────────────────────
  const sorted = stops ? [...stops]
    .filter(s => !s.cancelled)
    .sort((a,b) => new Date(a.plannedStartTime||0) - new Date(b.plannedStartTime||0))
    : []

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <Truck size={15} style={{ color:'var(--accent)', opacity:0.8 }} />
          <span style={{ color:'white', fontWeight:600, fontSize:'13px' }}>Vrachttijden</span>
          {lastUpdate && selectedDate === today && <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{lastUpdate.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span>}
        </div>
        <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
          {tokens && <button onClick={() => fetchStops()} disabled={loading} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', padding:'3px', borderRadius:'6px' }} onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}><RefreshCw size={13} style={{ animation:loading?'spin 1s linear infinite':'none' }} /></button>}
          {tokens && <button onClick={() => { saveTokens(null); setStops(null); setError(null) }} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'3px 7px', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }} onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.4)'}><LogOut size={11} /> Uitloggen</button>}
        </div>
      </div>

      {/* Datum navigatie */}
      {tokens && (
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
          <button onClick={() => { const d=new Date(selectedDate); d.setDate(d.getDate()-1); changeDate(d.toISOString().slice(0,10)) }}
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'4px 8px', cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:'16px', lineHeight:1 }}>‹</button>
          <input type="date" value={selectedDate} onChange={e => { if (e.target.value) changeDate(e.target.value) }}
            style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'4px 8px', color:'white', fontSize:'12px', textAlign:'center', cursor:'pointer' }} />
          <button onClick={() => { const d=new Date(selectedDate); d.setDate(d.getDate()+1); changeDate(d.toISOString().slice(0,10)) }}
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'4px 8px', cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:'16px', lineHeight:1 }}>›</button>
          {selectedDate !== today && <button onClick={() => changeDate(today)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'4px 7px', cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:'10px', whiteSpace:'nowrap' }}>Vandaag</button>}
        </div>
      )}

      {/* Niet ingelogd */}
      {!tokens && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', padding:'20px 0' }}>
          <Truck size={28} style={{ color:'var(--accent)', opacity:0.5 }} />
          {isLocalhost ? (
            <>
              <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', margin:0, textAlign:'center' }}>Log eenmalig in — daarna werkt het automatisch op alle apparaten.</p>
              <button onClick={handleLogin} disabled={loginLoading}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 20px', borderRadius:'10px', border:accentBorder(40), background:accentBg(12), color:'var(--accent)', cursor:loginLoading?'wait':'pointer', fontSize:'13px', fontWeight:600 }}>
                {loginLoading ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} /> Bezig...</> : <><LogIn size={14} /> Inloggen met Simacan</>}
              </button>
            </>
          ) : (
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', margin:0, textAlign:'center', lineHeight:'1.5' }}>
              Log eenmalig in via <span style={{ color:'var(--accent)', fontFamily:'monospace' }}>localhost:3000</span><br/>
              (run <span style={{ color:'rgba(255,255,255,0.6)', fontFamily:'monospace' }}>npm run dev</span>), daarna werkt het hier vanzelf.
            </p>
          )}
          {error && <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#ff6b6b', fontSize:'11px', textAlign:'center' }}><AlertCircle size={12} style={{ flexShrink:0 }} /> {error}</div>}
        </div>
      )}

      {/* Ingelogd */}
      {tokens && (
        <>
          {loading && !stops && (
            <div style={{ textAlign:'center', padding:'20px', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>
              <RefreshCw size={16} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 6px' }} />Laden...
            </div>
          )}
          {error && !loading && (
            <div style={{ padding:'10px', borderRadius:'10px', background:'rgba(255,80,80,0.06)', border:'1px solid rgba(255,80,80,0.2)', display:'flex', alignItems:'center', gap:'8px' }}>
              <AlertCircle size={13} style={{ color:'#ff6b6b', flexShrink:0 }} /><span style={{ color:'#ff6b6b', fontSize:'11px' }}>{error}</span>
            </div>
          )}

          {stops && (
            <>
              {sorted.length === 0 ? (
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'12px 0' }}>Geen ritten voor {selectedDate === today ? 'vandaag' : selectedDate}</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {sorted.map((stop, i) => {
                    const activity = stop.tripStatus?.activity
                    const color    = activityColor(activity)
                    const isSel    = selectedStop?.id === stop.id
                    const arrival  = stop.actualStartTime || stop.eta || stop.plannedStartTime
                    const badge    = delayBadge(stop.delay)
                    const carrier  = stop.tripStatus?.carrierName?.replace(' B.V.','').replace(' N.V.','') || ''
                    const dc       = stop.tripStatus?.startLocation?.name || ''
                    const pallets  = palletSummary(stop.drops)
                    const palletStr = Object.entries(pallets).map(([t,n]) => `${n}× ${PALLET_LABELS[t]||t}`).join('  ')
                    const rd        = routeData[stop.id]
                    const mapShown  = showMap[stop.id]
                    const notifyOn  = notifyStops.has(stop.id)

                    return (
                      <div key={stop.id || i} onClick={() => { setSelectedStop(isSel ? null : stop) }}
                        style={{ padding:'8px 10px', borderRadius:'10px', cursor:'pointer', transition:'background 0.15s',
                          background: isSel ? accentBg(8) : 'rgba(255,255,255,0.03)',
                          border: isSel ? accentBorder(25) : '1px solid rgba(255,255,255,0.06)' }}>

                        {/* Rij 1: route + tijd + badge */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', minWidth:0 }}>
                            <Truck size={12} style={{ color, flexShrink:0 }} />
                            <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.85)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {stop.trip?.tripId || `Rit ${i+1}`}
                            </span>
                            {stop.tripStatus?.vehicleType && <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', flexShrink:0 }}>{stop.tripStatus.vehicleType}</span>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                            {badge && <span style={{ fontSize:'10px', color:badge.color, fontWeight:600 }}>{badge.text}</span>}
                            <span style={{ fontSize:'13px', color:'var(--accent)', fontWeight:700 }}>{fmt(arrival)}</span>
                            <button
                              onClick={e => { e.stopPropagation(); toggleNotify(stop.id) }}
                              title={notifyOn ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'}
                              style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', display:'flex', color: notifyOn ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}>
                              {notifyOn ? <Bell size={12} /> : <BellOff size={12} />}
                            </button>
                            {isSel ? <ChevronUp size={11} style={{ color:'var(--accent)' }} /> : <ChevronDown size={11} style={{ color:'rgba(255,255,255,0.2)' }} />}
                          </div>
                        </div>

                        {/* Rij 2: vervoerder + status + tijdvenster */}
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', gap:'8px' }}>
                          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {[dc, carrier].filter(Boolean).join(' · ')}
                          </span>
                          <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                            {stop.timeWindowStart && stop.timeWindowEnd && (
                              <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{fmt(stop.timeWindowStart)}–{fmt(stop.timeWindowEnd)}</span>
                            )}
                            <span style={{ fontSize:'10px', color }}>{activityLabel(activity)}</span>
                          </div>
                        </div>

                        {/* Pallets */}
                        {palletStr && <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', marginTop:'2px' }}>{palletStr}</div>}

                        {/* Detail panel */}
                        {isSel && (
                          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                              {[
                                ['Route',      stop.trip?.tripId],
                                ['Van DC',     stop.tripStatus?.startLocation?.name],
                                ['Vervoerder', stop.tripStatus?.carrierName],
                                ['Voertuig',   stop.tripStatus?.vehicleType],
                                ['Gepland',    fmt(stop.plannedStartTime)],
                                ['Tijdvenster',stop.timeWindowStart ? `${fmt(stop.timeWindowStart)} – ${fmt(stop.timeWindowEnd)}` : null],
                                ['ETA',        stop.eta && stop.eta !== stop.plannedStartTime ? fmt(stop.eta) : null],
                                ['Werkelijk',  fmt(stop.actualStartTime)],
                                ['Vertrek',    fmt(stop.actualEndTime || stop.plannedEndTime)],
                                ['Vertraging', stop.delay != null ? (stop.delay === 0 ? 'Op tijd' : stop.delay > 0 ? `+${stop.delay} min` : `${stop.delay} min (vroeg)`) : null],
                                ...Object.entries(pallets).map(([t,n]) => [PALLET_LABELS[t]||t, `${n} pallets`])
                              ].filter(([,v]) => v && v !== '—').map(([label, value]) => (
                                <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
                                  <span style={{ color:'rgba(255,255,255,0.35)' }}>{label}</span>
                                  <span style={{ color:'rgba(255,255,255,0.8)' }}>{value}</span>
                                </div>
                              ))}
                            </div>

                            {/* Kaart knop */}
                            <button
                              onClick={() => toggleMap(stop)}
                              style={{
                                marginTop: '10px', width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                border: mapShown ? accentBorder(40) : '1px solid rgba(255,255,255,0.12)',
                                background: mapShown ? accentBg(12) : 'rgba(255,255,255,0.05)',
                                color: mapShown ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                                transition: 'all 0.15s'
                              }}>
                              {rd?.loading
                                ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }} /> Route laden...</>
                                : <><MapIcon size={12} /> {mapShown ? 'Kaart verbergen' : 'Toon route op kaart'}</>
                              }
                            </button>

                            {/* Route fout */}
                            {rd?.error && (
                              <div style={{ marginTop:'6px', fontSize:'10px', color:'#f87171', display:'flex', alignItems:'center', gap:'4px' }}>
                                <AlertCircle size={10} /> {rd.error}
                              </div>
                            )}

                            {/* Kaart popup wordt buiten dit panel gerenderd (zie onder sorted.map) */}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)', margin:'8px 0 0', textAlign:'right' }}>
                Simacan · {sorted.length} rit{sorted.length!==1?'ten':''}{selectedDate===today?' · ↺ 60s':''}
              </p>
            </>
          )}
        </>
      )}

      {/* Kaart fullscreen popup — buiten de widget card zodat hij over alles heen valt */}
      {(() => {
        const activeMapStop = sorted.find(s => showMap[s.id])
        const rd = activeMapStop ? routeData[activeMapStop.id] : null
        if (!activeMapStop || !rd?.stops || rd.loading) return null
        return (
          <RouteMap
            routeStops={rd.stops}
            vehiclePos={rd.vehiclePos}
            tripLabel={activeMapStop.trip?.tripId || activeMapStop.tripStatus?.tripName}
            onClose={() => setShowMap(p => ({ ...p, [activeMapStop.id]: false }))}
          />
        )
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
