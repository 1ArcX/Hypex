import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Truck, RefreshCw, AlertCircle, ChevronDown, ChevronUp, LogIn, LogOut, MapPin } from 'lucide-react'
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
  return '#60a5fa' // ONDERWEG, ACTIEF, etc.
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

  const tokensRef       = useRef(tokens)
  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef     = useRef([])
  const routeLayerRef  = useRef(null)
  const [routeCache,   setRouteCache]  = useState({})

  const accentBg     = p => `color-mix(in srgb, var(--accent) ${p}%, transparent)`
  const accentBorder = p => `1px solid color-mix(in srgb, var(--accent) ${p}%, transparent)`

  const saveTokens = useCallback(t => {
    tokensRef.current = t
    setTokens(t)
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    else   localStorage.removeItem(STORAGE_KEY)
    supabase.auth.updateUser({ data: { simacan_tokens: t || null } }).catch(() => {})
  }, [])

  // ─── Ophalen ──────────────────────────────────────────────────────────────
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
      // Auto-test alle APIs op eerste load zodat we de structuur kunnen zien
      if (arr.length > 0) {
        const firstUuid = arr[0]?.tripStatus?.uuid
        fetch(API, { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'testApis', token:t.accessToken, refreshToken:t.refreshToken, tripUuid: firstUuid })
        }).then(r=>r.json()).then(d=>console.log('[Simacan testApis]', JSON.stringify(d, null, 2))).catch(()=>{})
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [saveTokens])

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

  // ─── Login (alleen localhost:3000) ────────────────────────────────────────
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

  // ─── Kaart init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L; if (!L) return
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([STORE_LAT, STORE_LNG], 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
    const storeIco = L.divIcon({ html: `<div style="width:11px;height:11px;background:#00FFD1;border-radius:50%;border:2px solid white;box-shadow:0 0 6px #00FFD1"></div>`, className:'', iconAnchor:[5,5] })
    L.marker([STORE_LAT, STORE_LNG], { icon: storeIco }).addTo(map).bindPopup('Jumbo 7044 – Dronten')
    mapInstanceRef.current = map
  }, [])

  // ─── Route ophalen en op kaart zetten ────────────────────────────────────
  const showRouteOnMap = useCallback((routeData, stop) => {
    const L = window.L; const map = mapInstanceRef.current
    if (!L || !map) return
    // Verwijder oude markers/route
    markersRef.current.forEach(m => map.removeLayer(m)); markersRef.current = []
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null }

    const bounds = [[STORE_LAT, STORE_LNG]]
    const color  = activityColor(stop?.tripStatus?.activity)

    // Route polyline — probeer meerdere veldnamen
    const coords = routeData?.route?.coordinates || routeData?.routeCoordinates || routeData?.path?.coordinates || routeData?.geometry?.coordinates
    if (coords?.length > 1) {
      const latlngs = coords.map(c => Array.isArray(c) ? [c[1], c[0]] : [c.lat ?? c.latitude, c.lon ?? c.lng ?? c.longitude])
      routeLayerRef.current = L.polyline(latlngs, { color, weight: 3, opacity: 0.6 }).addTo(map)
      latlngs.forEach(p => bounds.push(p))
    }

    // Voertuig positie — probeer meerdere veldnamen
    const veh = routeData?.vehiclePosition || routeData?.vehicle || routeData?.currentPosition
    const lat  = veh?.latitude ?? veh?.lat
    const lng  = veh?.longitude ?? veh?.lon ?? veh?.lng
    if (lat && lng) {
      bounds.push([lat, lng])
      const ico = L.divIcon({ html: `<div style="width:14px;height:14px;background:${color};border-radius:3px;border:2px solid white;box-shadow:0 0 5px ${color};transform:rotate(45deg)"></div>`, className:'', iconAnchor:[7,7] })
      const m = L.marker([lat, lng], { icon: ico }).addTo(map)
        .bindPopup(`<b>${stop?.trip?.tripId || 'Rit'}</b><br/>${stop?.tripStatus?.carrierName || ''}`)
      markersRef.current.push(m)
    }

    // Log eerste keer zodat we velden kunnen zien
    if (!routeData._logged) {
      console.log('[Simacan] tripRoute velden:', JSON.stringify(routeData).slice(0, 600))
      routeData._logged = true
    }

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24] })
  }, [])

  const fetchAndShowRoute = useCallback(async (stop) => {
    const uuid = stop?.tripStatus?.uuid
    if (!uuid || !tokensRef.current?.accessToken) return
    if (routeCache[uuid]) { showRouteOnMap(routeCache[uuid], stop); return }
    try {
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'tripRoute', token:tokensRef.current.accessToken, refreshToken:tokensRef.current.refreshToken, tripUuid:uuid })
      })
      const data = await res.json()
      setRouteCache(prev => ({ ...prev, [uuid]: data }))
      showRouteOnMap(data, stop)
    } catch {}
  }, [routeCache, showRouteOnMap])

  // ─── Datum helpers ────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0,10)
  const changeDate = (nd) => { setSelectedDate(nd); setStops(null); setSelectedStop(null); fetchStops(tokensRef.current, nd) }

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
              {/* Kaart */}
              <div ref={mapRef} style={{ width:'100%', height:'180px', borderRadius:'10px', overflow:'hidden', marginBottom:'10px', border:'1px solid rgba(255,255,255,0.08)' }} />

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

                    return (
                      <div key={stop.id || i} onClick={() => { const next = isSel ? null : stop; setSelectedStop(next); if (next) fetchAndShowRoute(next) }}
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
                          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column', gap:'3px' }}>
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
