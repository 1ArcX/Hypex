import React, { useState, useEffect, useRef } from 'react'
import { Truck, RefreshCw, AlertCircle, Settings, ChevronDown, ChevronUp, MapPin, Copy, ExternalLink } from 'lucide-react'

const API = '/.netlify/functions/simacan'
const STORAGE_KEY = 'simacan_tokens'

// Jumbo 7044 — Ede (NL) als fallback kaartcentrum
const STORE_LAT = 52.0268
const STORE_LNG = 5.6643

function formatTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function timeDiff(isoStr) {
  if (!isoStr) return null
  const diff = Math.round((new Date(isoStr) - Date.now()) / 60000)
  if (diff < -120) return null
  if (diff < 0) return `${Math.abs(diff)}m geleden`
  if (diff === 0) return 'Nu'
  return `over ${diff}m`
}

function statusColor(status) {
  if (!status) return 'rgba(255,255,255,0.4)'
  const s = status.toLowerCase()
  if (s.includes('arrived') || s.includes('delivered') || s.includes('completed')) return '#4ade80'
  if (s.includes('delay') || s.includes('late')) return '#f87171'
  if (s.includes('route') || s.includes('transit') || s.includes('on_time')) return '#60a5fa'
  return 'rgba(255,255,255,0.5)'
}

function statusLabel(status) {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s.includes('arrived') || s.includes('completed')) return 'Aangekomen'
  if (s.includes('delivered')) return 'Geleverd'
  if (s.includes('delay')) return 'Vertraagd'
  if (s.includes('on_time') || s.includes('ontime')) return 'Op tijd'
  if (s.includes('route') || s.includes('transit')) return 'Onderweg'
  if (s.includes('planned')) return 'Gepland'
  return status
}

async function callSimacan(tokens, action, extra = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokens.accessToken, refreshToken: tokens.refreshToken, action, ...extra })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfout')
  return data
}

export default function VrachttijdenWidget() {
  const [tokens, setTokens] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
  })
  const [formToken, setFormToken] = useState('')
  const [formRefresh, setFormRefresh] = useState('')
  const [stops, setStops] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [selectedStop, setSelectedStop] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const tokensRef = useRef(tokens)

  const accentBg  = (pct) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  const accentBorder = (pct) => `1px solid color-mix(in srgb, var(--accent) ${pct}%, transparent)`

  useEffect(() => { if (tokens) fetchStops(tokens) }, [])

  // Auto-refresh elke 60 seconden
  useEffect(() => {
    if (!tokens) return
    const t = setInterval(() => fetchStops(tokensRef.current), 60000)
    return () => clearInterval(t)
  }, [!!tokens])

  // Initialiseer Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([STORE_LAT, STORE_LNG], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
    const storeIcon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:#00FFD1;border-radius:50%;border:2px solid white;box-shadow:0 0 6px #00FFD1"></div>`,
      className: '', iconAnchor: [5, 5]
    })
    L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon }).addTo(map).bindPopup('Jumbo 7044')
    mapInstanceRef.current = map
  }, [])

  // Update truck markers
  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map || !stops) return
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    const bounds = []
    stops.forEach((stop, i) => {
      const lat = stop.vehicle?.latitude ?? stop.vehicle?.lat ?? stop.currentLocation?.lat
      const lng = stop.vehicle?.longitude ?? stop.vehicle?.lng ?? stop.currentLocation?.lng ?? stop.currentLocation?.lon
      if (!lat || !lng) return
      bounds.push([lat, lng])
      const isSelected = selectedStop?.tripUuid === stop.tripUuid
      const color = statusColor(stop.status)
      const icon = L.divIcon({
        html: `<div style="width:${isSelected?16:11}px;height:${isSelected?16:11}px;background:${color};border-radius:3px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 5px ${color};transform:rotate(45deg)"></div>`,
        className: '', iconAnchor: [isSelected?8:5.5, isSelected?8:5.5]
      })
      const plate = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || `Rit ${i + 1}`
      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${plate}</b><br/>${statusLabel(stop.status)}<br/>${formatTime(stop.estimatedArrival || stop.plannedArrival)}`)
      marker.on('click', () => setSelectedStop(stop))
      markersRef.current.push(marker)
    })
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [20, 20] })
    else if (bounds.length === 1) map.setView(bounds[0], 11)
  }, [stops, selectedStop])

  const saveTokens = (t) => {
    tokensRef.current = t
    setTokens(t)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  }

  const fetchStops = async (t) => {
    if (!t?.accessToken) return
    setLoading(true); setError(null)
    try {
      const data = await callSimacan(t, 'locationStops', { date: new Date().toISOString() })
      // Auto-save nieuwe tokens als de functie ze heeft ververst
      if (data._newTokens) saveTokens({ accessToken: data._newTokens.accessToken, refreshToken: data._newTokens.refreshToken || t.refreshToken })
      const raw = data.locationStops || data.stops || data.result || data || []
      setStops(Array.isArray(raw) ? raw : Object.values(raw))
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleSave = () => {
    const t = formToken.trim()
    if (!t) return
    const newTokens = { accessToken: t, refreshToken: formRefresh.trim() || null }
    saveTokens(newTokens)
    setShowSettings(false)
    fetchStops(newTokens)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setTokens(null); tokensRef.current = null
    setStops(null); setError(null); setFormToken(''); setFormRefresh('')
  }

  const sorted = stops ? [...stops].sort((a, b) => {
    const ta = new Date(a.estimatedArrival || a.plannedArrival || 0)
    const tb = new Date(b.estimatedArrival || b.plannedArrival || 0)
    return ta - tb
  }) : []

  const showForm = !tokens || showSettings

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={15} style={{ color: 'var(--accent)', opacity: 0.8 }} />
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Vrachttijden</span>
          {lastUpdate && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
              {lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {tokens && !showSettings && (
            <button onClick={() => fetchStops(tokens)} disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button onClick={() => setShowSettings(s => !s)}
            style={{ background: showSettings ? accentBg(15) : 'rgba(255,255,255,0.05)', border: showSettings ? accentBorder(40) : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px 7px', cursor: 'pointer', color: showSettings ? 'var(--accent)' : 'rgba(255,255,255,0.4)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Settings size={11} /> {tokens ? (showSettings ? 'Sluiten' : 'Token') : 'Token instellen'}
          </button>
        </div>
      </div>

      {/* Token-paste formulier */}
      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: tokens ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>Hoe je token ophalen:</p>
            <ol style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <li>Open de Simacan website in je browser en log in</li>
              <li>Open <b>DevTools</b> (F12) → tabblad <b>Network</b></li>
              <li>Herlaad de pagina, klik een API-verzoek aan</li>
              <li>Kopieer de waarde van <b>Authorization: Bearer ...</b></li>
              <li>Plak hier <em>alleen het token</em> (zonder "Bearer ")</li>
            </ol>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '-2px' }}>Access Token *</label>
            <textarea className="glass-input" rows={3} placeholder="eyJhbGciOiJSUzI1NiIsInR5..."
              value={formToken} onChange={e => setFormToken(e.target.value)}
              style={{ fontSize: '11px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.4 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '-2px' }}>
              Refresh Token <span style={{ opacity: 0.6 }}>(optioneel — voor auto-verlenging)</span>
            </label>
            <textarea className="glass-input" rows={2} placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
              value={formRefresh} onChange={e => setFormRefresh(e.target.value)}
              style={{ fontSize: '11px', resize: 'none', fontFamily: 'monospace', lineHeight: 1.4 }} />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '11px' }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {tokens && (
              <button onClick={logout}
                style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px' }}>
                Verwijderen
              </button>
            )}
            <button onClick={handleSave} disabled={!formToken.trim()}
              style={{ flex: 2, padding: '7px', borderRadius: '8px', border: accentBorder(40), background: accentBg(12), color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: !formToken.trim() ? 0.4 : 1 }}>
              Opslaan & laden
            </button>
          </div>
        </div>
      )}

      {/* Inhoud */}
      {tokens && !showSettings && (
        <>
          {loading && !stops && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 6px' }} />
              Laden...
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <AlertCircle size={13} style={{ color: '#ff6b6b', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ color: '#ff6b6b', fontSize: '11px', margin: '0 0 4px' }}>{error}</p>
                {error.includes('verlopen') && (
                  <button onClick={() => setShowSettings(true)}
                    style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    → Vernieuw token in instellingen
                  </button>
                )}
              </div>
            </div>
          )}

          {stops && (
            <>
              {/* Kaart */}
              <div ref={mapRef}
                style={{ width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' }}
              />

              {/* Ritten lijst */}
              {sorted.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '12px 0' }}>
                  Geen vrachttijden gevonden voor vandaag
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sorted.map((stop, i) => {
                    const plate = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || stop.vehicleId || `Rit ${i + 1}`
                    const planned = stop.plannedArrival || stop.eta
                    const estimated = stop.estimatedArrival || stop.eta
                    const actual = stop.actualArrival
                    const arrival = actual || estimated || planned
                    const diff = timeDiff(estimated || planned)
                    const color = statusColor(stop.status)
                    const isSelected = selectedStop?.tripUuid === stop.tripUuid
                    const hasPos = !!(stop.vehicle?.latitude ?? stop.vehicle?.lat ?? stop.currentLocation?.lat)

                    return (
                      <div key={stop.tripUuid || i}
                        onClick={() => setSelectedStop(isSelected ? null : stop)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                          background: isSelected ? accentBg(8) : 'rgba(255,255,255,0.03)',
                          border: isSelected ? accentBorder(25) : '1px solid rgba(255,255,255,0.06)',
                          transition: 'background 0.15s' }}>
                        <Truck size={13} style={{ color, flexShrink: 0, opacity: 0.9 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {plate}
                              {hasPos && <MapPin size={9} style={{ marginLeft: '4px', opacity: 0.4, verticalAlign: 'middle' }} />}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {diff && <span style={{ fontSize: '10px', color, fontWeight: 500 }}>{diff}</span>}
                              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{formatTime(arrival)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '10px', color }}>{statusLabel(stop.status)}</span>
                            {planned && estimated && planned !== estimated && (
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>gepland {formatTime(planned)}</span>
                            )}
                          </div>
                        </div>
                        {isSelected
                          ? <ChevronUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          : <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Geselecteerde stop details */}
              {selectedStop && (
                <div style={{ marginTop: '8px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    ['Kenteken', selectedStop.vehicle?.licencePlate || selectedStop.vehicle?.licensePlate],
                    ['Gepland',  formatTime(selectedStop.plannedArrival)],
                    ['Verwacht', formatTime(selectedStop.estimatedArrival)],
                    ['Werkelijk',formatTime(selectedStop.actualArrival)],
                    ['Status',   statusLabel(selectedStop.status)],
                    ['Order',    selectedStop.orderNumber],
                  ].filter(([,v]) => v && v !== '—').map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', margin: '8px 0 0', textAlign: 'right' }}>
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
