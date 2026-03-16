import React, { useState, useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Truck, RefreshCw, AlertCircle, ChevronDown, ChevronUp, LogIn, LogOut, Map } from 'lucide-react'
import { supabase } from '../supabaseClient'

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

// ─── Route map component ───────────────────────────────────────────────────────
function RouteMap({ routeStops }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [STORE_LNG, STORE_LAT],
      zoom: 8,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      console.log('[RouteMap] routeStops:', routeStops)
      console.log('[RouteMap] voorbeeld stop:', routeStops[0])

      // Collect all polyline coordinates for full route line
      const allCoords = []
      for (const s of routeStops) {
        if (s.polyline) allCoords.push(...decodePolyline(s.polyline))
      }
      console.log('[RouteMap] allCoords length:', allCoords.length)

      if (allCoords.length > 0) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: allCoords } }
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.9, 'line-cap': 'round', 'line-join': 'round' }
        })

        // Fit map to route + store
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
        )
        bounds.extend([STORE_LNG, STORE_LAT])
        map.fitBounds(bounds, { padding: 40, maxZoom: 13 })
      }

      // Numbered stop markers
      for (const s of routeStops) {
        if (s.lat == null || s.lng == null) continue
        const el = document.createElement('div')
        el.style.cssText = [
          'width:26px', 'height:26px', 'border-radius:50%',
          'background:#3b82f6', 'border:2px solid white',
          'display:flex', 'align-items:center', 'justify-content:center',
          'color:white', 'font-size:11px', 'font-weight:700',
          'box-shadow:0 2px 6px rgba(0,0,0,0.45)', 'cursor:default'
        ].join(';')
        el.textContent = s.stopNumber != null ? String(s.stopNumber) : ''
        new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map)
      }

      // Our store — solid blue dot (active stop)
      const storeEl = document.createElement('div')
      storeEl.style.cssText = [
        'width:16px', 'height:16px', 'border-radius:50%',
        'background:#3b82f6', 'border:3px solid white',
        'box-shadow:0 2px 10px rgba(59,130,246,0.7)'
      ].join(';')
      new maplibregl.Marker({ element: storeEl }).setLngLat([STORE_LNG, STORE_LAT]).addTo(map)
    })

    return () => map.remove()
  }, [routeStops])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '260px', borderRadius: '10px', overflow: 'hidden', marginTop: '10px' }} />
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
  const [tokens,      setTokens]      = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } })
  const [stops,       setStops]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loginLoading,setLoginLoading]= useState(false)
  const [error,       setError]       = useState(null)
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [selectedStop,setSelectedStop]= useState(null)
  const [selectedDate,setSelectedDate]= useState(() => new Date().toISOString().slice(0,10))
  const [routeData,   setRouteData]   = useState({})   // { [stopId]: { stops, loading, error } }
  const [showMap,     setShowMap]     = useState({})   // { [stopId]: bool }

  const tokensRef       = useRef(tokens)
  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

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
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [saveTokens])

  // ─── Route ophalen voor kaart ─────────────────────────────────────────────
  const fetchRoute = useCallback(async (stop) => {
    const stopId  = stop.id
    const tripUuid = stop.trip?.uuid || stop.uuid || stop.tripStatus?.tripUuid
      || stop.trip?.id || stop.tripStatus?.id || stop.tripId
    // Altijd loggen zodat we de structuur zien
    console.log('[fetchRoute] stop keys:', Object.keys(stop))
    console.log('[fetchRoute] stop.trip:', JSON.stringify(stop.trip))
    console.log('[fetchRoute] stop.tripStatus keys:', stop.tripStatus ? Object.keys(stop.tripStatus) : null)
    console.log('[fetchRoute] stop.id:', stop.id, '| stop.uuid:', stop.uuid, '| tripUuid gebruikt:', tripUuid)
    if (!tripUuid) {
      setRouteData(p => ({ ...p, [stopId]: { stops: [], error: `Geen UUID gevonden. Keys: ${Object.keys(stop).join(', ')}` } }))
      return
    }
    setRouteData(p => ({ ...p, [stopId]: { stops: [], loading: true } }))
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'tripRoute', token:tokensRef.current.accessToken, refreshToken:tokensRef.current.refreshToken, tripUuid })
      })
      const data = await res.json()
      console.log('[fetchRoute] stops.length:', data.stops?.length, '| rawDebug:', JSON.stringify(data._rawDebug, null, 2))
      if (data._newTokens) saveTokens({ accessToken:data._newTokens.accessToken, refreshToken:data._newTokens.refreshToken || tokensRef.current.refreshToken })
      if (!res.ok) throw new Error(data.error || 'Route ophalen mislukt')
      setRouteData(p => ({ ...p, [stopId]: { stops: data.stops || [], loading: false } }))
    } catch (e) {
      setRouteData(p => ({ ...p, [stopId]: { stops: [], loading: false, error: e.message } }))
    }
  }, [saveTokens])

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
  const isLocalhost = window.location.hostname === 'localhost'
  const REDIRECT_URI = 'http://localhost:3000/simacan-callback.html'

  const handleLogin = useCallback(async () => {
    setLoginLoading(true); setError(null)
    try {
      const verifier = randomBase64url(32); const challenge = await sha256Base64url(verifier); const state = randomBase64url(16)
      const authUrl = `${KC_BASE}/auth?` + new URLSearchParams({ client_id:KC_CLIENT_ID, response_type:'code', scope:'openid offline_access', redirect_uri:REDIRECT_URI, state, code_challenge:challenge, code_challenge_method:'S256' }).toString()
      const popup = window.open(authUrl, 'simacan_login', 'width=520,height=640,left=200,top=100')
      if (!popup) throw new Error('Popup geblokkeerd. Sta popups toe voor deze site.')
      await new Promise((resolve, reject) => {
        const handler = async (event) => {
          if (event.origin !== 'http://localhost:3000' && event.origin !== window.location.origin) return
          if (event.data?.type === 'simacan_auth_error') { window.removeEventListener('message', handler); reject(new Error(event.data.description || event.data.error)); return }
          if (event.data?.type !== 'simacan_auth') return
          if (event.data.state !== state) { reject(new Error('State mismatch')); return }
          window.removeEventListener('message', handler)
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
                    const rd       = routeData[stop.id]
                    const mapShown = showMap[stop.id]

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
                                : <><Map size={12} /> {mapShown ? 'Kaart verbergen' : 'Toon route op kaart'}</>
                              }
                            </button>

                            {/* Route fout */}
                            {rd?.error && (
                              <div style={{ marginTop:'6px', fontSize:'10px', color:'#f87171', display:'flex', alignItems:'center', gap:'4px' }}>
                                <AlertCircle size={10} /> {rd.error}
                              </div>
                            )}

                            {/* Kaart */}
                            {mapShown && rd?.stops && !rd.loading && (
                              <RouteMap routeStops={rd.stops} />
                            )}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
