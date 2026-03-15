import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Truck, RefreshCw, AlertCircle, MapPin, ChevronDown, ChevronUp, LogIn, LogOut, Settings } from 'lucide-react'

const API            = '/.netlify/functions/simacan'
const STORAGE_KEY    = 'simacan_tokens'
const KC_BASE        = 'https://sso.simacan.com/auth/realms/jumbo-sc/protocol/openid-connect'
const KC_CLIENT_ID   = 'frontend'

// Jumbo 7044 — Ede als fallback kaartcentrum
const STORE_LAT = 52.0268
const STORE_LNG = 5.6643

// ─── PKCE helpers ────────────────────────────────────────────────────────────
function randomBase64url(len = 32) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function sha256Base64url(plain) {
  const data = new TextEncoder().encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function exchangeCode(code, verifier, redirectUri) {
  const res = await fetch(`${KC_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     KC_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri:  redirectUri
    }).toString()
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token ophalen mislukt')
  return data
}

async function refreshTokens(refreshToken) {
  const res = await fetch(`${KC_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     KC_CLIENT_ID,
      refresh_token: refreshToken
    }).toString()
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Token vernieuwen mislukt')
  return data
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? '—' : d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function timeDiff(iso) {
  if (!iso) return null
  const m = Math.round((new Date(iso) - Date.now()) / 60000)
  if (m < -120) return null
  if (m < 0)   return `${Math.abs(m)}m geleden`
  if (m === 0) return 'Nu'
  return `over ${m}m`
}

function statusColor(s) {
  if (!s) return 'rgba(255,255,255,0.4)'
  const l = s.toLowerCase()
  if (l.includes('arrived') || l.includes('delivered') || l.includes('completed')) return '#4ade80'
  if (l.includes('delay')   || l.includes('late'))                                 return '#f87171'
  if (l.includes('route')   || l.includes('transit')   || l.includes('on_time'))   return '#60a5fa'
  return 'rgba(255,255,255,0.5)'
}

function statusLabel(s) {
  if (!s) return ''
  const l = s.toLowerCase()
  if (l.includes('arrived') || l.includes('completed')) return 'Aangekomen'
  if (l.includes('delivered'))  return 'Geleverd'
  if (l.includes('delay'))      return 'Vertraagd'
  if (l.includes('on_time'))    return 'Op tijd'
  if (l.includes('route') || l.includes('transit')) return 'Onderweg'
  if (l.includes('planned'))    return 'Gepland'
  return s
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VrachttijdenWidget() {
  const [tokens, setTokens] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })
  const [stops,       setStops]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loginLoading,setLoginLoading]= useState(false)
  const [error,       setError]       = useState(null)
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [selectedStop,setSelectedStop]= useState(null)

  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef     = useRef([])
  const tokensRef      = useRef(tokens)

  const accentBg     = p => `color-mix(in srgb, var(--accent) ${p}%, transparent)`
  const accentBorder = p => `1px solid color-mix(in srgb, var(--accent) ${p}%, transparent)`

  const saveTokens = useCallback(t => {
    tokensRef.current = t
    setTokens(t)
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    else   localStorage.removeItem(STORAGE_KEY)
  }, [])

  // ─── Ophalen vrachttijden ─────────────────────────────────────────────────
  const fetchStops = useCallback(async (t = tokensRef.current) => {
    if (!t?.accessToken) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'locationStops', token: t.accessToken, refreshToken: t.refreshToken, date: new Date().toISOString() })
      })
      const data = await res.json()

      // Automatisch nieuwe tokens opslaan als functie ze heeft ververst
      if (data._newTokens) {
        saveTokens({ accessToken: data._newTokens.accessToken, refreshToken: data._newTokens.refreshToken || t.refreshToken })
      }

      if (!res.ok) {
        // Token verlopen en geen refresh beschikbaar → opnieuw inloggen
        if (res.status === 401) { saveTokens(null); setError('Sessie verlopen. Log opnieuw in.'); setLoading(false); return }
        throw new Error(data.error || 'Serverfout')
      }

      const raw = data.locationStops || data.stops || data.result || data || []
      setStops(Array.isArray(raw) ? raw : Object.values(raw))
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [saveTokens])

  // ─── Afhandeling redirect-flow (mobiel) ──────────────────────────────────
  useEffect(() => {
    const pending = localStorage.getItem('simacan_pending_code')
    const pendingErr = localStorage.getItem('simacan_pending_error')
    if (pendingErr) {
      localStorage.removeItem('simacan_pending_error')
      setError(pendingErr)
      setLoginLoading(false)
      return
    }
    if (!pending) {
      if (tokens) fetchStops(tokens)
      return
    }
    localStorage.removeItem('simacan_pending_code')
    const { code, state } = JSON.parse(pending)
    const verifier = localStorage.getItem('simacan_pkce_verifier')
    const savedState = localStorage.getItem('simacan_pkce_state')
    localStorage.removeItem('simacan_pkce_verifier')
    localStorage.removeItem('simacan_pkce_state')
    if (!verifier || state !== savedState) { setError('Login mislukt (state mismatch)'); return }
    setLoginLoading(true)
    const redirectUri = `${window.location.origin}/simacan-callback.html`
    exchangeCode(code, verifier, redirectUri)
      .then(tokenData => {
        const t = { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token }
        saveTokens(t)
        fetchStops(t)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoginLoading(false))
  }, [])

  useEffect(() => {
    if (!tokens) return
    const t = setInterval(() => fetchStops(), 60000)
    return () => clearInterval(t)
  }, [!!tokens, fetchStops])

  // ─── PKCE OAuth login (popup op desktop, redirect op mobiel) ────────────
  const handleLogin = useCallback(async () => {
    setLoginLoading(true); setError(null)
    try {
      const verifier   = randomBase64url(32)
      const challenge  = await sha256Base64url(verifier)
      const state      = randomBase64url(16)
      const redirectUri = `${window.location.origin}/simacan-callback.html`
      const isMobile   = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

      const authUrl = `${KC_BASE}/auth?` + new URLSearchParams({
        client_id:             KC_CLIENT_ID,
        response_type:         'code',
        scope:                 'openid offline_access',
        redirect_uri:          redirectUri,
        state,
        code_challenge:        challenge,
        code_challenge_method: 'S256'
      }).toString()

      // Probeer popup; als geblokkeerd of mobiel → gebruik redirect
      const popup = !isMobile && window.open(authUrl, 'simacan_login', 'width=520,height=640,left=200,top=100')

      if (!popup) {
        // Redirect flow: sla verifier + state op, stuur door naar Keycloak
        localStorage.setItem('simacan_pkce_verifier', verifier)
        localStorage.setItem('simacan_pkce_state', state)
        window.location.href = authUrl
        return // pagina wordt omgeleid, component unmount
      }

      // Popup flow: wacht op postMessage van callback pagina
      await new Promise((resolve, reject) => {
        const handler = async (event) => {
          if (event.origin !== window.location.origin) return
          if (event.data?.type === 'simacan_auth_error') {
            window.removeEventListener('message', handler)
            reject(new Error(event.data.description || event.data.error))
            return
          }
          if (event.data?.type !== 'simacan_auth') return
          if (event.data.state !== state) { reject(new Error('State mismatch')); return }
          window.removeEventListener('message', handler)
          try {
            const tokenData = await exchangeCode(event.data.code, verifier, redirectUri)
            saveTokens({ accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token })
            fetchStops({ accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token })
            resolve()
          } catch (e) { reject(e) }
        }
        window.addEventListener('message', handler)
        setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Login timeout')) }, 5 * 60 * 1000)
        const checkClosed = setInterval(() => {
          if (popup.closed) { clearInterval(checkClosed); window.removeEventListener('message', handler); reject(new Error('Login geannuleerd')) }
        }, 500)
      })
    } catch (e) {
      setError(e.message)
    }
    setLoginLoading(false)
  }, [saveTokens, fetchStops])

  // ─── Kaart ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L; if (!L) return
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([STORE_LAT, STORE_LNG], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
    const storeIco = L.divIcon({ html: `<div style="width:10px;height:10px;background:#00FFD1;border-radius:50%;border:2px solid white;box-shadow:0 0 6px #00FFD1"></div>`, className: '', iconAnchor: [5,5] })
    L.marker([STORE_LAT, STORE_LNG], { icon: storeIco }).addTo(map).bindPopup('Jumbo 7044')
    mapInstanceRef.current = map
  }, [])

  useEffect(() => {
    const L = window.L; const map = mapInstanceRef.current
    if (!L || !map || !stops) return
    markersRef.current.forEach(m => map.removeLayer(m)); markersRef.current = []
    const bounds = []
    stops.forEach((stop, i) => {
      const lat = stop.vehicle?.latitude ?? stop.vehicle?.lat ?? stop.currentLocation?.lat
      const lng = stop.vehicle?.longitude ?? stop.vehicle?.lng ?? stop.currentLocation?.lng ?? stop.currentLocation?.lon
      if (!lat || !lng) return
      bounds.push([lat, lng])
      const sel = selectedStop?.tripUuid === stop.tripUuid
      const col = statusColor(stop.status)
      const ico = L.divIcon({ html: `<div style="width:${sel?16:11}px;height:${sel?16:11}px;background:${col};border-radius:3px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 5px ${col};transform:rotate(45deg)"></div>`, className: '', iconAnchor: [sel?8:5.5,sel?8:5.5] })
      const plate = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || `Rit ${i+1}`
      const m = L.marker([lat, lng], { icon: ico }).addTo(map)
        .bindPopup(`<b>${plate}</b><br/>${statusLabel(stop.status)}<br/>${formatTime(stop.estimatedArrival || stop.plannedArrival)}`)
      m.on('click', () => setSelectedStop(stop))
      markersRef.current.push(m)
    })
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [20,20] })
    else if (bounds.length === 1) map.setView(bounds[0], 11)
  }, [stops, selectedStop])

  // ─── Render ───────────────────────────────────────────────────────────────
  const sorted = stops ? [...stops].sort((a,b) => new Date(a.estimatedArrival||a.plannedArrival||0) - new Date(b.estimatedArrival||b.plannedArrival||0)) : []

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <Truck size={15} style={{ color:'var(--accent)', opacity:0.8 }} />
          <span style={{ color:'white', fontWeight:600, fontSize:'13px' }}>Vrachttijden</span>
          {lastUpdate && <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>{lastUpdate.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span>}
        </div>
        <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
          {tokens && (
            <button onClick={() => fetchStops()} disabled={loading}
              style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', padding:'3px', borderRadius:'6px' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          {tokens && (
            <button onClick={() => { saveTokens(null); setStops(null); setError(null) }}
              style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'3px 7px', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:'11px', display:'flex', alignItems:'center', gap:'4px' }}
              onMouseEnter={e=>e.currentTarget.style.color='#f87171'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.4)'}>
              <LogOut size={11} /> Uitloggen
            </button>
          )}
        </div>
      </div>

      {/* Niet ingelogd */}
      {!tokens && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', padding:'20px 0' }}>
          <Truck size={28} style={{ color:'var(--accent)', opacity:0.5 }} />
          <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', margin:0, textAlign:'center' }}>
            Log in met je Simacan-account om vrachttijden en de live kaart te zien.
          </p>
          <button onClick={handleLogin} disabled={loginLoading}
            style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 20px', borderRadius:'10px', border: accentBorder(40), background: accentBg(12), color:'var(--accent)', cursor: loginLoading ? 'wait' : 'pointer', fontSize:'13px', fontWeight:600 }}>
            {loginLoading
              ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} /> Bezig...</>
              : <><LogIn size={14} /> Inloggen met Simacan</>}
          </button>
          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#ff6b6b', fontSize:'11px', textAlign:'center' }}>
              <AlertCircle size={12} style={{ flexShrink:0 }} /> {error}
            </div>
          )}
        </div>
      )}

      {/* Ingelogd */}
      {tokens && (
        <>
          {loading && !stops && (
            <div style={{ textAlign:'center', padding:'20px', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>
              <RefreshCw size={16} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 6px' }} />
              Laden...
            </div>
          )}

          {error && !loading && (
            <div style={{ padding:'10px', borderRadius:'10px', background:'rgba(255,80,80,0.06)', border:'1px solid rgba(255,80,80,0.2)', display:'flex', alignItems:'center', gap:'8px' }}>
              <AlertCircle size={13} style={{ color:'#ff6b6b', flexShrink:0 }} />
              <span style={{ color:'#ff6b6b', fontSize:'11px' }}>{error}</span>
            </div>
          )}

          {stops && (
            <>
              {/* Kaart */}
              <div ref={mapRef} style={{ width:'100%', height:'185px', borderRadius:'10px', overflow:'hidden', marginBottom:'10px', border:'1px solid rgba(255,255,255,0.08)' }} />

              {sorted.length === 0 ? (
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', textAlign:'center', padding:'12px 0' }}>
                  Geen vrachttijden voor vandaag
                </p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                  {sorted.map((stop, i) => {
                    const plate    = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || stop.vehicleId || `Rit ${i+1}`
                    const arrival  = stop.actualArrival || stop.estimatedArrival || stop.plannedArrival
                    const diff     = timeDiff(stop.estimatedArrival || stop.plannedArrival)
                    const color    = statusColor(stop.status)
                    const isSel    = selectedStop?.tripUuid === stop.tripUuid
                    const hasPos   = !!(stop.vehicle?.latitude ?? stop.vehicle?.lat ?? stop.currentLocation?.lat)

                    return (
                      <div key={stop.tripUuid || i}
                        onClick={() => setSelectedStop(isSel ? null : stop)}
                        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'10px', cursor:'pointer', transition:'background 0.15s',
                          background: isSel ? accentBg(8) : 'rgba(255,255,255,0.03)',
                          border: isSel ? accentBorder(25) : '1px solid rgba(255,255,255,0.06)' }}>
                        <Truck size={13} style={{ color, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                            <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.85)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {plate}
                              {hasPos && <MapPin size={9} style={{ marginLeft:'4px', opacity:0.4, verticalAlign:'middle' }} />}
                            </span>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                              {diff && <span style={{ fontSize:'10px', color, fontWeight:500 }}>{diff}</span>}
                              <span style={{ fontSize:'12px', color:'var(--accent)', fontWeight:600 }}>{formatTime(arrival)}</span>
                            </div>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'2px' }}>
                            <span style={{ fontSize:'10px', color }}>{statusLabel(stop.status)}</span>
                            {stop.plannedArrival && stop.estimatedArrival && stop.plannedArrival !== stop.estimatedArrival && (
                              <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>gepland {formatTime(stop.plannedArrival)}</span>
                            )}
                          </div>
                        </div>
                        {isSel ? <ChevronUp size={11} style={{ color:'var(--accent)', flexShrink:0 }} /> : <ChevronDown size={11} style={{ color:'rgba(255,255,255,0.2)', flexShrink:0 }} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedStop && (
                <div style={{ marginTop:'8px', padding:'10px', borderRadius:'10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', fontSize:'11px', display:'flex', flexDirection:'column', gap:'4px' }}>
                  {[
                    ['Kenteken', selectedStop.vehicle?.licencePlate || selectedStop.vehicle?.licensePlate],
                    ['Gepland',  formatTime(selectedStop.plannedArrival)],
                    ['Verwacht', formatTime(selectedStop.estimatedArrival)],
                    ['Werkelijk',formatTime(selectedStop.actualArrival)],
                    ['Status',   statusLabel(selectedStop.status)],
                    ['Order',    selectedStop.orderNumber],
                  ].filter(([,v]) => v && v !== '—').map(([label, value]) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'rgba(255,255,255,0.4)' }}>{label}</span>
                      <span style={{ color:'rgba(255,255,255,0.85)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)', margin:'8px 0 0', textAlign:'right' }}>
                Simacan · {sorted.length} rit{sorted.length !== 1 ? 'ten' : ''} · ↺ 60s
              </p>
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
