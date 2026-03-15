import React, { useState, useEffect, useRef } from 'react'
import { Truck, RefreshCw, AlertCircle, Settings, ChevronDown, ChevronUp, MapPin, Clock } from 'lucide-react'

const API = '/.netlify/functions/simacan'
const STORAGE_KEY = 'simacan_credentials'

// Jumbo 7044 locatie (centrum Nederland als fallback)
const STORE_LAT = 52.2297
const STORE_LNG = 5.3959

function formatTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return '—'
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function timeDiff(isoStr) {
  if (!isoStr) return null
  const diff = Math.round((new Date(isoStr) - Date.now()) / 60000)
  if (diff < -60) return null
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

async function callSimacan(creds, action, extra = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, action, ...extra })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfout')
  return data
}

export default function VrachttijdenWidget() {
  const [creds, setCreds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
  })
  const [formCreds, setFormCreds] = useState({ username: '', password: '' })
  const [stops, setStops] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [selectedStop, setSelectedStop] = useState(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const refreshTimer = useRef(null)

  const accentBg = (pct) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  const accentBorder = (pct) => `1px solid color-mix(in srgb, var(--accent) ${pct}%, transparent)`

  useEffect(() => {
    if (creds) fetchStops(creds)
  }, [])

  // Auto-refresh elke 60 seconden
  useEffect(() => {
    if (!creds) return
    refreshTimer.current = setInterval(() => fetchStops(creds), 60000)
    return () => clearInterval(refreshTimer.current)
  }, [creds])

  // Initialiseer Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([STORE_LAT, STORE_LNG], 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)

    // Winkel marker
    const storeIcon = L.divIcon({
      html: `<div style="width:12px;height:12px;background:var(--accent,#00FFD1);border-radius:50%;border:2px solid white;box-shadow:0 0 8px var(--accent,#00FFD1)"></div>`,
      className: '', iconAnchor: [6, 6]
    })
    L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon }).addTo(map).bindPopup('Jumbo 7044')

    mapInstanceRef.current = map
  }, [mapRef.current])

  // Update truck markers op de map
  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map || !stops) return

    // Verwijder oude markers
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    stops.forEach((stop, i) => {
      const lat = stop.vehicle?.latitude || stop.vehicle?.lat || stop.currentLocation?.lat
      const lng = stop.vehicle?.longitude || stop.vehicle?.lng || stop.currentLocation?.lng || stop.currentLocation?.lon
      if (!lat || !lng) return

      const isSelected = selectedStop?.tripUuid === stop.tripUuid
      const color = statusColor(stop.status)
      const truckIcon = L.divIcon({
        html: `<div style="width:${isSelected ? 16 : 12}px;height:${isSelected ? 16 : 12}px;background:${color};border-radius:3px;border:2px solid white;box-shadow:0 0 6px ${color};transform:rotate(45deg)"></div>`,
        className: '', iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6]
      })
      const plate = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || `Vrachtwagen ${i + 1}`
      const arrival = formatTime(stop.estimatedArrival || stop.plannedArrival)
      const marker = L.marker([lat, lng], { icon: truckIcon })
        .addTo(map)
        .bindPopup(`<b>${plate}</b><br/>${statusLabel(stop.status)}<br/>Aankomst: ${arrival}`)
      marker.on('click', () => setSelectedStop(stop))
      markersRef.current.push(marker)
    })
  }, [stops, selectedStop])

  const fetchStops = async (c) => {
    if (!c) return
    setLoading(true); setError(null)
    try {
      const data = await callSimacan(c, 'locationStops', { date: new Date().toISOString() })
      // Normaliseer response — API kan verschillende structuren hebben
      const raw = data.locationStops || data.stops || data.result || data || []
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      setStops(arr)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const saveCreds = async () => {
    if (!formCreds.username || !formCreds.password) return
    setLoading(true); setError(null)
    try {
      await callSimacan(formCreds, 'login')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formCreds))
      setCreds(formCreds)
      setShowSettings(false)
      fetchStops(formCreds)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCreds(null); setStops(null); setError(null); setFormCreds({ username: '', password: '' })
  }

  // Groepeer stops: aankomend / actief / gepland / klaar
  const sorted = stops ? [...stops].sort((a, b) => {
    const ta = new Date(a.estimatedArrival || a.plannedArrival || 0)
    const tb = new Date(b.estimatedArrival || b.plannedArrival || 0)
    return ta - tb
  }) : []

  const showForm = !creds || showSettings

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
          {creds && !showSettings && (
            <button onClick={() => fetchStops(creds)} disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? accentBg(15) : 'rgba(255,255,255,0.05)', border: showSettings ? accentBorder(40) : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px 7px', cursor: 'pointer', color: showSettings ? 'var(--accent)' : 'rgba(255,255,255,0.4)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Settings size={11} /> {creds ? (showSettings ? 'Sluiten' : 'Instelling') : 'Inloggen'}
          </button>
        </div>
      </div>

      {/* Login form */}
      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: creds ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
            Log in met je Simacan-account om vrachttijden te bekijken.
          </p>
          <input className="glass-input" placeholder="Gebruikersnaam" value={formCreds.username}
            onChange={e => setFormCreds(p => ({ ...p, username: e.target.value }))}
            autoComplete="off" style={{ fontSize: '12px' }} />
          <input className="glass-input" type="password" placeholder="Wachtwoord" value={formCreds.password}
            onChange={e => setFormCreds(p => ({ ...p, password: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && saveCreds()}
            autoComplete="new-password" style={{ fontSize: '12px' }} />
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '11px' }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            {creds && (
              <button onClick={logout}
                style={{ flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px' }}>
                Uitloggen
              </button>
            )}
            <button onClick={saveCreds} disabled={loading || !formCreds.username || !formCreds.password}
              style={{ flex: 2, padding: '7px', borderRadius: '8px', border: accentBorder(40), background: accentBg(12), color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: (!formCreds.username || !formCreds.password) ? 0.4 : 1 }}>
              {loading ? 'Bezig...' : 'Inloggen & opslaan'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {creds && !showSettings && (
        <>
          {loading && !stops && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 6px' }} />
              Laden...
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)', display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '11px' }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {stops && (
            <>
              {/* Kaart */}
              <div
                ref={mapRef}
                style={{ width: '100%', height: '200px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)' }}
              />

              {/* Stops lijst */}
              {sorted.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '12px 0' }}>
                  Geen vrachttijden gevonden voor vandaag
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sorted.map((stop, i) => {
                    const plate = stop.vehicle?.licencePlate || stop.vehicle?.licensePlate || `Vrachtwagen ${i + 1}`
                    const planned = stop.plannedArrival || stop.eta
                    const estimated = stop.estimatedArrival || stop.eta
                    const actual = stop.actualArrival
                    const arrival = actual || estimated || planned
                    const diff = timeDiff(estimated || planned)
                    const color = statusColor(stop.status)
                    const isSelected = selectedStop?.tripUuid === stop.tripUuid
                    const hasPos = !!(stop.vehicle?.latitude || stop.vehicle?.lat || stop.currentLocation?.lat)

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
                              {hasPos && <MapPin size={9} style={{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'middle' }} />}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {diff && <span style={{ fontSize: '10px', color, fontWeight: 500 }}>{diff}</span>}
                              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{formatTime(arrival)}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span style={{ fontSize: '10px', color }}>
                              {statusLabel(stop.status)}
                            </span>
                            {planned && estimated && planned !== estimated && (
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                                gepland {formatTime(planned)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected ? <ChevronUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Geselecteerde stop details */}
              {selectedStop && (
                <div style={{ marginTop: '8px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedStop.orderNumber && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Order: <span style={{ color: 'rgba(255,255,255,0.8)' }}>{selectedStop.orderNumber}</span></div>}
                  {selectedStop.tripUuid && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Trip: <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>{selectedStop.tripUuid.slice(0, 20)}…</span></div>}
                  {selectedStop.plannedArrival && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Gepland: <span style={{ color: 'rgba(255,255,255,0.8)' }}>{formatTime(selectedStop.plannedArrival)}</span></div>}
                  {selectedStop.estimatedArrival && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Verwacht: <span style={{ color: 'var(--accent)' }}>{formatTime(selectedStop.estimatedArrival)}</span></div>}
                  {selectedStop.actualArrival && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Werkelijk: <span style={{ color: '#4ade80' }}>{formatTime(selectedStop.actualArrival)}</span></div>}
                </div>
              )}

              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', margin: '8px 0 0', textAlign: 'right' }}>
                Simacan · {sorted.length} rit{sorted.length !== 1 ? 'ten' : ''} · auto-refresh 60s
              </p>
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
