import React, { useState, useEffect } from 'react'
import { BookOpen, ClipboardList, RefreshCw, Settings, ChevronDown, ChevronUp, AlertCircle, FileText, ExternalLink, BookMarked } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { matchVak } from '../utils/alleVakken'

const API = '/.netlify/functions/magister'
const storageKey = (userId) => `magister_credentials_${userId}`

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

function inDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ').trim()
}

function toBookUrl(url) {
  if (!url) return null
  const m = url.match(/\/Ean\/(\d+)/i)
  return m ? `https://apps.noordhoff.nl/se/deeplink?targetEAN=${m[1]}` : url
}

export default function MagisterWidget({ userId, onSubjectsSync, tabless = false, gridLayout = false }) {
  const [creds, setCreds] = useState(() => {
    if (!userId) return null
    try { return JSON.parse(localStorage.getItem(storageKey(userId))) || null } catch { return null }
  })
  const [formCreds, setFormCreds] = useState({ school: 'ichthus', username: '', password: '' })
  const [showSettings, setShowSettings] = useState(!creds)
  const [tab, setTab] = useState('vakken')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ grades: null, homework: null, assignments: null })
  const [expanded, setExpanded] = useState(true)
  const [profile, setProfile] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Fetch all Magister data at once on mount (no lazy loading per tab)
  useEffect(() => {
    if (creds) fetchAllData(creds)
  }, [creds])

  useEffect(() => {
    if (!userId) return
    fetchProfile()
    fetchLinks()
    if (creds && !sessionStorage.getItem('magister_synced')) {
      sessionStorage.setItem('magister_synced', '1')
      syncVakken(creds).then(() => syncLesmateriaal(creds))
    }
  }, [userId])

  const fetchProfile = async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('vakken, klas').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const fetchLinks = async () => {
    const { data } = await supabase.from('subject_links').select('*')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.vak_naam] = row.url })
      setSubjectLinks(map)
    }
  }

  const fetchAllData = async (c) => {
    if (!c) return
    setLoading(true); setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [grades, homework, assignments] = await Promise.all([
        callMagister(c, 'grades', { top: 30 }),
        callMagister(c, 'homework', { start: inDays(-7), end: inDays(30) }),
        callMagister(c, 'opdrachten', { count: 50 })
      ])
      setData({ grades, homework, assignments })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const syncVakken = async (credsToUse) => {
    if (!userId) return
    try {
      const vakken = await callMagister(credsToUse, 'vakken')
      if (!vakken?.length) return
      const namen = vakken
        .map(v => matchVak(v.naam) || matchVak(v.afkorting))
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
      if (!namen.length) return
      const { data: existing } = await supabase.from('subjects').select('id, name').eq('user_id', userId)
      const existingMap = Object.fromEntries((existing || []).map(s => [s.name, s.id]))
      const toDelete = (existing || []).filter(s => !namen.includes(s.name))
      const toInsert = namen.filter(n => !existingMap[n])
      if (toDelete.length) await supabase.from('subjects').delete().in('id', toDelete.map(s => s.id))
      if (toInsert.length) await supabase.from('subjects').insert(toInsert.map(name => ({ name, user_id: userId })))
      await supabase.from('profiles').update({ vakken: namen }).eq('id', userId)
      await fetchProfile()
      onSubjectsSync?.()
    } catch (e) {
      console.warn('Vakken sync mislukt:', e.message)
    }
  }

  const syncLesmateriaal = async (credsToUse) => {
    try {
      const materials = await callMagister(credsToUse, 'lesmateriaal')
      if (!materials?.length) return
      for (const mat of materials) {
        if (!mat.url) continue
        const vakNaam = matchVak(mat.vak)
        if (!vakNaam) continue
        const bookUrl = toBookUrl(mat.url)
        const { data: existing } = await supabase.from('subject_links').select('id').eq('vak_naam', vakNaam).maybeSingle()
        if (existing) {
          await supabase.from('subject_links').update({ url: bookUrl }).eq('vak_naam', vakNaam)
        } else {
          await supabase.from('subject_links').insert({ vak_naam: vakNaam, url: bookUrl })
        }
      }
      await fetchLinks()
    } catch (e) {
      console.warn('Lesmateriaal sync mislukt:', e.message)
    }
  }

  const syncAll = async () => {
    if (!creds) {
      setSyncMsg('Niet ingelogd bij Magister')
      setTimeout(() => setSyncMsg(''), 3000)
      return
    }
    setSyncing(true)
    try {
      await syncVakken(creds)
      await syncLesmateriaal(creds)
      setSyncMsg('Gesynchroniseerd ✓')
      setTimeout(() => setSyncMsg(''), 3000)
    } catch {
      setSyncMsg('Sync mislukt')
      setTimeout(() => setSyncMsg(''), 3000)
    }
    setSyncing(false)
  }

  const saveCreds = async () => {
    if (!formCreds.school || !formCreds.username || !formCreds.password) return
    setLoading(true); setError(null)
    try {
      await callMagister(formCreds, 'login')
      localStorage.setItem(storageKey(userId), JSON.stringify(formCreds))
      setCreds(formCreds)
      setShowSettings(false)
      window.dispatchEvent(new Event('magisterLogin'))
      // Direct ophalen zonder op useEffect te wachten
      fetchAllData(formCreds)
      fetchProfile()
      fetchLinks()
      syncVakken(formCreds).then(() => syncLesmateriaal(formCreds))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem(storageKey(userId))
    setCreds(null)
    setData({ grades: null, homework: null, assignments: null })
    setShowSettings(true)
    setFormCreds({ school: '', username: '', password: '' })
  }

  const refresh = () => {
    setData({ grades: null, homework: null, assignments: null })
    fetchAllData(creds)
  }

  const formatDate = (str) => {
    if (!str) return ''
    try {
      const d = new Date(str)
      if (isNaN(d)) return str
      return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
    } catch { return str }
  }

  const isOverdue = (deadline) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  const vakken = profile?.vakken || []
  const klas = profile?.klas || ''

  // Accent-aware inline style helpers
  const accentBg = (pct) => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  const accentBorder = (pct) => `1px solid color-mix(in srgb, var(--accent) ${pct}%, transparent)`

  const secWrap = gridLayout
    ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { marginBottom: 16 }

  return (
    <div className={tabless ? '' : 'glass-card p-4'} style={gridLayout ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎓</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Magister</span>
          {creds && (
            <span style={{ background: accentBg(10), border: accentBorder(25), borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: 'var(--accent)' }}>
              {creds.school}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {creds && (
            <button onClick={refresh} disabled={loading}
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
          {/* Login/instellingen form */}
          {showSettings && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
                Log in met je Magister-account. Vakken en digitaal lesmateriaal worden automatisch gesynchroniseerd.
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
                <button onClick={saveCreds} disabled={loading || !formCreds.username || !formCreds.password}
                  style={{ flex: 2, padding: '7px', borderRadius: '8px', border: accentBorder(40), background: accentBg(12), color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: (!formCreds.username || !formCreds.password) ? 0.4 : 1 }}>
                  {loading ? 'Bezig...' : 'Inloggen & opslaan'}
                </button>
              </div>
            </div>
          )}

          {!showSettings && (
            <>
              {/* Tabs (alleen op mobiel, niet in tabless/grid mode) */}
              {!tabless && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                  {[
                    { id: 'vakken', label: 'Vakken', icon: <BookMarked size={11} /> },
                    ...(creds ? [
                      { id: 'cijfers', label: 'Cijfers', icon: <BookOpen size={11} /> },
                      { id: 'huiswerk', label: 'Huiswerk', icon: <ClipboardList size={11} /> },
                      { id: 'opdrachten', label: 'Opdrachten', icon: <FileText size={11} /> },
                    ] : [])
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      style={{ flex: 1, padding: '5px 4px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', borderColor: tab === t.id ? accentBg(50) : 'rgba(255,255,255,0.08)', background: tab === t.id ? accentBg(12) : 'transparent', color: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Grid wrapper op desktop, gewone kolom op mobiel */}
              <div style={gridLayout
                ? { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, overflow: 'hidden' }
                : {}
              }>

                {/* Vakken */}
                {(tabless || tab === 'vakken') && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📚</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Vakken</span>
                          {klas && <span style={{ background: accentBg(10), border: accentBorder(25), borderRadius: 20, padding: '1px 8px', fontSize: 10, color: 'var(--accent)' }}>{klas}</span>}
                        </div>
                        {creds && (
                          <button onClick={syncAll} disabled={syncing}
                            style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', color: '#FACC15', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, opacity: syncing ? 0.5 : 1 }}>
                            <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
                          </button>
                        )}
                      </div>
                    )}
                    {!tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {klas && <span style={{ background: accentBg(10), border: accentBorder(25), borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: 'var(--accent)' }}>{klas}</span>}
                        </div>
                        {creds && (
                          <button onClick={syncAll} disabled={syncing}
                            style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: '8px', padding: '3px 8px', cursor: 'pointer', color: '#FACC15', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: syncing ? 0.5 : 1 }}>
                            <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
                          </button>
                        )}
                      </div>
                    )}
                    {syncMsg && (
                      <div style={{ fontSize: '11px', color: syncMsg.includes('✓') ? '#4ADE80' : '#FACC15', marginBottom: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', flexShrink: 0 }}>
                        {syncMsg}
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding: '14px 16px', ...(gridLayout ? { flex: 1, overflowY: 'auto' } : {}) } : {}}>
                      {vakken.length === 0 ? (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                          {creds ? 'Klik op "Sync" om vakken te laden' : 'Log in bij Magister om vakken te laden'}
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {vakken.map(vak => {
                            const link = subjectLinks[vak]
                            return link ? (
                              <a key={vak} href={link} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, background: accentBg(8), border: accentBorder(20), color: 'var(--accent)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                                {vak} <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span key={vak} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-2)', fontSize: 12 }}>
                                {vak}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading */}
                {loading && (tab !== 'vakken' || tabless) && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px', ...(gridLayout ? { gridColumn: '1/-1' } : {}) }}>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 6px' }} />
                    Laden...
                  </div>
                )}

                {/* Error */}
                {error && !loading && (tab !== 'vakken' || tabless) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '12px', padding: '8px', borderRadius: '8px', background: 'rgba(255,80,80,0.08)', ...(gridLayout ? { gridColumn: '1/-1' } : {}) }}>
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                {/* Cijfers */}
                {(tabless || tab === 'cijfers') && !loading && data.grades && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📊</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Laatste cijfers</span>
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding: '0', ...(gridLayout ? { flex: 1, overflowY: 'auto' } : {}) } : { display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {data.grades.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>Geen cijfers gevonden</p>
                      )}
                      {data.grades.map((g, i) => {
                        const cijfer = parseFloat(g.cijfer)
                        const color = isNaN(cijfer) ? '#818CF8' : cijfer >= 5.5 ? '#4ADE80' : '#FF6B6B'
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < data.grades.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color }}>{g.cijfer ?? '–'}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.vak || 'Onbekend vak'}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                                {[g.omschrijving, g.weging ? `weging ${g.weging}` : null, g.datum ? formatDate(g.datum) : null].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Huiswerk / Studiewijzer */}
                {(tabless || tab === 'huiswerk') && !loading && data.homework && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Studiewijzer</span>
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding: 0, ...(gridLayout ? { flex: 1, overflowY: 'auto' } : {}) } : { display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {data.homework.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>Geen huiswerk gevonden</p>
                      )}
                      {data.homework.map((hw, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: i < data.homework.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hw.omschrijving ? 3 : 0 }}>
                              <span style={{ fontSize: 11, color: 'var(--accent)', background: accentBg(8), border: accentBorder(20), borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>{hw.vak || '?'}</span>
                              {hw.klaar && <span style={{ fontSize: 10, color: '#4ADE80' }}>✓ Klaar</span>}
                            </div>
                            {hw.omschrijving && (
                              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {stripHtml(hw.omschrijving)}
                              </p>
                            )}
                          </div>
                          {hw.datum && (
                            <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }}>{formatDate(hw.datum)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opdrachten */}
                {(tabless || tab === 'opdrachten') && !loading && data.assignments && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📝</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Opdrachten</span>
                        {data.assignments.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{data.assignments.length}</span>
                        )}
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding: 0, ...(gridLayout ? { flex: 1, overflowY: 'auto' } : {}) } : { display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {data.assignments.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>Geen opdrachten gevonden</p>
                      )}
                      {tabless && data.assignments.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '0 12px', padding: '6px 16px', borderBottom: '1px solid var(--border)' }}>
                          {['Vak', 'Opdracht', 'Inleveren', 'Status'].map(h => (
                            <span key={h} style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</span>
                          ))}
                        </div>
                      )}
                      {data.assignments.map((a, i) => {
                        const overdue = !a.afgesloten && !a.ingeleverdOp && isOverdue(a.deadline)
                        const statusColor = a.afgesloten ? '#555' : a.ingeleverdOp ? 'var(--accent)' : overdue ? '#FF6B6B' : a.magInleveren ? '#FACC15' : 'rgba(255,255,255,0.3)'
                        const statusLabel = a.afgesloten ? 'Afgesloten' : a.opnieuwInleveren ? 'Opnieuw' : a.ingeleverdOp ? 'Ingeleverd' : overdue ? 'Te laat' : a.magInleveren ? 'Openstaand' : '–'
                        return tabless ? (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '0 12px', alignItems: 'center', padding: '10px 16px', borderBottom: i < data.assignments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ fontSize: 11, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vak || '–'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.naam || 'Onbekend'}</span>
                            <span style={{ fontSize: 11, color: overdue ? '#FF6B6B' : 'var(--text-3)' }}>{a.deadline ? formatDate(a.deadline) : '–'}</span>
                            <span style={{ fontSize: 10, color: statusColor, background: statusColor + '18', border: `1px solid ${statusColor}44`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                              {statusLabel}
                            </span>
                          </div>
                        ) : (
                          <div key={i} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${overdue ? 'rgba(255,80,80,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.naam || 'Onbekend'}</p>
                                {a.vak && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{a.vak}</p>}
                              </div>
                              <span style={{ fontSize: 10, color: statusColor, background: statusColor + '18', border: `1px solid ${statusColor}44`, borderRadius: 6, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                {statusLabel}
                              </span>
                            </div>
                            {a.deadline && <p style={{ fontSize: 10, color: overdue ? '#FF6B6B' : 'rgba(255,255,255,0.25)', margin: '4px 0 0' }}>Inleveren: {formatDate(a.deadline)}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!creds && tab !== 'vakken' && (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
                    Klik op "Inloggen" om te beginnen
                  </p>
                )}

              </div>{/* einde grid/kolom wrapper */}
            </>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
