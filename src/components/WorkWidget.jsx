import React, { useState, useEffect } from 'react'
import { Briefcase, ChevronLeft, ChevronRight, RefreshCw, ExternalLink, AlertCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react'

const API = '/.netlify/functions/pmt'
const STORAGE_KEY = 'pmt_credentials'
const BASE_URL = 'https://jumbo7044.personeelstool.nl'

function currentISOWeek() {
  const d = new Date()
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
}

function isoWeeksInYear(year) {
  const dec28 = new Date(year, 11, 28)
  const jan4 = new Date(year, 0, 4)
  return Math.ceil(((dec28 - jan4) / 86400000 + jan4.getDay() + 1) / 7)
}

async function callPmt(creds, action, extra = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, action, ...extra })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfout')
  return data
}

const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function formatShiftDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

export default function WorkWidget() {
  const [creds, setCreds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
  })
  const [formCreds, setFormCreds] = useState({ username: '', password: '' })
  const [shifts, setShifts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [apiUnknown, setApiUnknown] = useState(false)
  const [week, setWeek] = useState(currentISOWeek)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showSettings, setShowSettings] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayShifts, setDayShifts] = useState(null)
  const [dayLoading, setDayLoading] = useState(false)

  useEffect(() => {
    if (creds) fetchSchedule(creds, week, year)
  }, [])

  const fetchSchedule = async (c, w, y) => {
    if (!c) return
    setLoading(true); setError(null); setApiUnknown(false)
    try {
      const data = await callPmt(c, 'schedule', { week: w, year: y })
      setShifts(data.shifts || [])
      if (data.error === 'api_unknown') setApiUnknown(true)
    } catch (e) {
      if (e.message === 'api_unknown') setApiUnknown(true)
      else setError(e.message)
    }
    setLoading(false)
  }

  const navigateWeek = (delta) => {
    let newWeek = week + delta
    let newYear = year
    const weeksInYear = isoWeeksInYear(year)
    if (newWeek < 1) { newYear--; newWeek = isoWeeksInYear(newYear) }
    else if (newWeek > weeksInYear) { newYear++; newWeek = 1 }
    setWeek(newWeek); setYear(newYear)
    if (creds) fetchSchedule(creds, newWeek, newYear)
  }

  const saveCreds = async () => {
    if (!formCreds.username || !formCreds.password) return
    setLoading(true); setError(null)
    try {
      const data = await callPmt(formCreds, 'schedule', { week, year })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formCreds))
      setCreds(formCreds)
      setShifts(data.shifts || [])
      setShowSettings(false)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const fetchDayPlanning = async (date) => {
    if (selectedDay === date) { setSelectedDay(null); return }
    setSelectedDay(date); setDayShifts(null); setDayLoading(true)
    try {
      const data = await callPmt(creds, 'day_planning', { date })
      setDayShifts(data.dayShifts || [])
    } catch (e) {
      setDayShifts([])
    }
    setDayLoading(false)
  }

  function toPmtDayUrl(dateStr) {
    if (!dateStr) return BASE_URL
    const d = new Date(dateStr)
    return `${BASE_URL}/planning/department-schedule/${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCreds(null); setShifts(null); setError(null); setApiUnknown(false)
    setFormCreds({ username: '', password: '' })
  }

  const accentBg = (pct) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  const accentBorder = (pct) => `1px solid color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  const pmtUrl = `${BASE_URL}/my-overview/my-schedule/${week}-${year}`
  const showForm = !creds || showSettings

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💼</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Jumbo Rooster</span>
          {creds && (
            <span style={{ background: accentBg(10), border: accentBorder(25), borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: 'var(--accent)' }}>
              PMT
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {creds && !showSettings && (
            <button onClick={() => fetchSchedule(creds, week, year)} disabled={loading}
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
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Login / settings form */}
          {showForm && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: creds ? '12px' : 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
                Log in met je PMT-account om je Jumbo werkrooster te bekijken.
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

          {/* Schedule view */}
          {creds && !showSettings && (
            <>
              {/* Week navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <button onClick={() => navigateWeek(-1)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', lineHeight: 0 }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  Week {week} / {year}
                </span>
                <button onClick={() => navigateWeek(1)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', lineHeight: 0 }}>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 6px' }} />
                  Laden...
                </div>
              )}

              {/* API unknown fallback */}
              {!loading && apiUnknown && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
                    Rooster kon niet automatisch geladen worden.
                  </p>
                  <a href={pmtUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', background: accentBg(10), border: accentBorder(25), borderRadius: '8px', padding: '6px 12px' }}>
                    <ExternalLink size={12} /> Open in PMT
                  </a>
                </div>
              )}

              {/* Error */}
              {!loading && error && !apiUnknown && (
                <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '12px', marginBottom: '8px' }}>
                    <AlertCircle size={13} /> {error}
                  </div>
                  <a href={pmtUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Open in PMT
                  </a>
                </div>
              )}

              {/* Shifts */}
              {!loading && !error && shifts !== null && !apiUnknown && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {shifts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                      Vrije week 🎉
                    </div>
                  ) : (
                    shifts.map((shift, i) => (
                      <div key={i}
                        onClick={() => fetchDayPlanning(shift.date)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: selectedDay === shift.date ? accentBg(12) : accentBg(5), border: selectedDay === shift.date ? accentBorder(35) : accentBorder(15), cursor: 'pointer', transition: 'background 0.15s' }}>
                        <Briefcase size={13} style={{ color: 'var(--accent)', opacity: 0.7, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                              {formatShiftDate(shift.date)}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                              {shift.start} – {shift.end}
                            </span>
                          </div>
                          {shift.label && (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {shift.label}
                            </p>
                          )}
                        </div>
                        {selectedDay === shift.date
                          ? <ChevronUp size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        }
                      </div>
                    ))
                  )}

                  {/* Day planning panel */}
                  {selectedDay && (
                    <div style={{ borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                          Wie werkt er op {formatShiftDate(selectedDay)}?
                        </span>
                        <button onClick={() => setSelectedDay(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '0', lineHeight: 0 }}>
                          <ChevronUp size={12} />
                        </button>
                      </div>

                      {dayLoading && (
                        <div style={{ textAlign: 'center', padding: '8px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                          <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                        </div>
                      )}

                      {!dayLoading && dayShifts && (
                        <>
                          {dayShifts.length === 0 ? (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0, textAlign: 'center' }}>Geen shifts gevonden</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {dayShifts.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '7px', background: s.isOwn ? accentBg(12) : 'rgba(255,255,255,0.03)', border: s.isOwn ? accentBorder(30) : '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: '11px', color: s.isOwn ? 'var(--accent)' : 'rgba(255,255,255,0.7)', fontWeight: s.isOwn ? 600 : 400, flexShrink: 0 }}>
                                    {s.start} – {s.end}
                                  </span>
                                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flex: 1 }}>
                                    afd. {s.department_id}
                                  </span>
                                  {s.isOwn && <span style={{ fontSize: '10px', color: 'var(--accent)', flexShrink: 0 }}>(jouw shift)</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ marginTop: '8px', textAlign: 'center' }}>
                            <a href={toPmtDayUrl(selectedDay)} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                              <ExternalLink size={10} /> Open dag planning in PMT
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '4px' }}>
                    <a href={pmtUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
                      <ExternalLink size={10} /> Open PMT
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
