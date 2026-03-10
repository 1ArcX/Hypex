import React, { useState, useEffect } from 'react'
import { LogIn, BookOpen, Calendar, ClipboardList, RefreshCw, Settings, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'

const API = '/.netlify/functions/magister'
const STORAGE_KEY = 'magister_credentials'

async function callMagister(creds, action, extra = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, action, ...extra })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfout')
  return data
}

function today() { return new Date().toISOString().slice(0, 10) }
function inDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default function MagisterWidget({ userId, onSubjectsSync }) {
  const [creds, setCreds]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
  })
  const [formCreds, setFormCreds] = useState({ school: 'ichthus', username: '', password: '' })
  const [showSettings, setShowSettings]   = useState(!creds)
  const [tab, setTab]           = useState('rooster')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [data, setData]         = useState({ grades: null, schedule: null, homework: null })
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (creds) fetchTab(tab)
  }, [creds])

  const syncVakken = async (credsToUse) => {
    if (!userId) return
    try {
      const vakken = await callMagister(credsToUse, 'vakken')
      if (!vakken?.length) return
      const namen = vakken.map(v => v.naam).filter(Boolean)
      // Sync to subjects table
      const { data: existing } = await supabase.from('subjects').select('name').eq('user_id', userId)
      const existingNames = new Set((existing || []).map(s => s.name))
      const missing = namen.filter(n => !existingNames.has(n))
      if (missing.length > 0) {
        await supabase.from('subjects').insert(missing.map(name => ({ name, user_id: userId })))
      }
      // Sync to profile vakken
      await supabase.from('profiles').update({ vakken: namen }).eq('id', userId)
      onSubjectsSync?.()
    } catch (e) {
      console.warn('Vakken sync mislukt:', e.message)
    }
  }

  const saveCreds = async () => {
    if (!formCreds.school || !formCreds.username || !formCreds.password) return
    setLoading(true); setError(null)
    try {
      await callMagister(formCreds, 'login')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formCreds))
      setCreds(formCreds)
      setShowSettings(false)
      syncVakken(formCreds)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCreds(null)
    setData({ grades: null, schedule: null, homework: null })
    setShowSettings(true)
    setFormCreds({ school: '', username: '', password: '' })
  }

  const fetchTab = async (t) => {
    if (!creds) return
    setLoading(true); setError(null)
    try {
      if (t === 'cijfers' && !data.grades) {
        const grades = await callMagister(creds, 'grades', { top: 15 })
        setData(p => ({ ...p, grades }))
      } else if (t === 'rooster' && !data.schedule) {
        const schedule = await callMagister(creds, 'schedule', { start: today(), end: inDays(7) })
        setData(p => ({ ...p, schedule }))
      } else if (t === 'huiswerk' && !data.homework) {
        const homework = await callMagister(creds, 'homework', { start: today(), end: inDays(14) })
        setData(p => ({ ...p, homework }))
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const switchTab = (t) => { setTab(t); fetchTab(t) }

  const refresh = () => {
    setData({ grades: null, schedule: null, homework: null })
    setTimeout(() => fetchTab(tab), 50)
  }

  const formatDateTime = (str) => {
    if (!str) return ''
    try {
      const d = new Date(str)
      if (isNaN(d)) return str
      return d.toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch { return str }
  }

  const formatTime = (str) => {
    if (!str) return ''
    try {
      const d = new Date(str)
      if (isNaN(d)) return str
      return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    } catch { return str }
  }

  const formatDate = (str) => {
    if (!str) return ''
    try {
      const d = new Date(str)
      if (isNaN(d)) return str
      return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
    } catch { return str }
  }

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎓</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Magister</span>
          {creds && (
            <span style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.25)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: '#00FFD1' }}>
              {creds.school}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {creds && (
            <button onClick={refresh} disabled={loading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#00FFD1'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showSettings ? 'rgba(0,255,209,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '3px 7px', cursor: 'pointer', color: showSettings ? '#00FFD1' : 'rgba(255,255,255,0.4)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Settings size={11} /> {creds ? (showSettings ? 'Sluiten' : 'Instelling') : 'Inloggen'}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {!expanded && null}

      {expanded && (
        <>
          {/* Login/instellingen form */}
          {showSettings && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
                Log in met je Magister-account
              </p>
              <input className="glass-input" placeholder="Leerlingnummer" value={formCreds.username}
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
                <button onClick={saveCreds} disabled={loading || !formCreds.school || !formCreds.username || !formCreds.password}
                  style={{ flex: 2, padding: '7px', borderRadius: '8px', border: '1px solid rgba(0,255,209,0.4)', background: 'rgba(0,255,209,0.12)', color: '#00FFD1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: (!formCreds.school || !formCreds.username || !formCreds.password) ? 0.4 : 1 }}>
                  {loading ? 'Bezig...' : 'Inloggen & opslaan'}
                </button>
              </div>
            </div>
          )}

          {/* Inhoud (alleen als ingelogd) */}
          {creds && !showSettings && (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {[
                  { id: 'rooster', label: 'Rooster', icon: <Calendar size={11} /> },
                  { id: 'cijfers', label: 'Cijfers', icon: <BookOpen size={11} /> },
                  { id: 'huiswerk', label: 'Huiswerk', icon: <ClipboardList size={11} /> },
                ].map(t => (
                  <button key={t.id} onClick={() => switchTab(t.id)}
                    style={{ flex: 1, padding: '5px 4px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', borderColor: tab === t.id ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.08)', background: tab === t.id ? 'rgba(0,255,209,0.12)' : 'transparent', color: tab === t.id ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: '6px' }} />
                  <p style={{ margin: 0 }}>Laden...</p>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '12px', padding: '8px', borderRadius: '8px', background: 'rgba(255,80,80,0.08)' }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              {/* Rooster */}
              {tab === 'rooster' && !loading && data.schedule && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {data.schedule.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>Geen lessen gevonden</p>
                  )}
                  {data.schedule.map((les, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: '10px', background: les.uitgevallen ? 'rgba(255,80,80,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${les.uitgevallen ? 'rgba(255,80,80,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '12px', color: les.uitgevallen ? '#ff6b6b' : 'rgba(255,255,255,0.85)', fontWeight: 500, textDecoration: les.uitgevallen ? 'line-through' : 'none' }}>
                          {les.vak || 'Onbekend vak'}
                        </span>
                        {les.uitgevallen && <span style={{ fontSize: '10px', color: '#ff6b6b', background: 'rgba(255,80,80,0.1)', padding: '1px 5px', borderRadius: '4px' }}>Uitgevallen</span>}
                      </div>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                        {formatTime(les.start)}{les.einde ? ` – ${formatTime(les.einde)}` : ''}{les.lokaal ? ` · ${les.lokaal}` : ''}{les.docent ? ` · ${les.docent}` : ''}
                      </p>
                      {les.start && <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', margin: '1px 0 0' }}>{formatDate(les.start)}</p>}
                      {les.huiswerk && (
                        <p style={{ fontSize: '11px', color: '#FACC15', margin: '4px 0 0', padding: '4px 6px', background: 'rgba(250,204,21,0.06)', borderRadius: '6px' }}>
                          📚 {les.huiswerk}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Cijfers */}
              {tab === 'cijfers' && !loading && data.grades && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {data.grades.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>Geen cijfers gevonden</p>
                  )}
                  {data.grades.map((g, i) => {
                    const cijfer = parseFloat(g.cijfer)
                    const color = isNaN(cijfer) ? '#818CF8' : cijfer >= 5.5 ? '#4ADE80' : '#FF6B6B'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color }}>{g.cijfer ?? '–'}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.vak || 'Onbekend vak'}</p>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                            {g.omschrijving || ''}{g.weging ? ` · weging ${g.weging}` : ''}{g.datum ? ` · ${formatDate(g.datum)}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Huiswerk */}
              {tab === 'huiswerk' && !loading && data.homework && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {data.homework.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>Geen huiswerk gevonden</p>
                  )}
                  {data.homework.map((hw, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: '10px', background: hw.klaar ? 'rgba(74,222,128,0.04)' : 'rgba(250,204,21,0.04)', border: `1px solid ${hw.klaar ? 'rgba(74,222,128,0.2)' : 'rgba(250,204,21,0.15)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{hw.vak || 'Onbekend vak'}</span>
                        {hw.klaar && <span style={{ fontSize: '10px', color: '#4ADE80' }}>✓ Klaar</span>}
                      </div>
                      {hw.omschrijving && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>{hw.omschrijving}</p>}
                      {hw.datum && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: '3px 0 0' }}>{formatDate(hw.datum)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Niet ingelogd */}
          {!creds && !showSettings && (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
              Klik op "Inloggen" om te beginnen
            </p>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
