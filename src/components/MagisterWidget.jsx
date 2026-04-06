import React, { useState, useEffect } from 'react'
import { BookOpen, ClipboardList, RefreshCw, Settings, ChevronDown, ChevronUp, AlertCircle, FileText, ExternalLink, BookMarked } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { matchVak } from '../utils/alleVakken'
import { callMagister, clearStoredTokens } from '../utils/magisterApi'
import { callSomtoday, somtodayKey } from '../utils/somtodayApi'

const storageKey = (userId) => `magister_credentials_${userId}`

function inDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function Skeleton({ rows = 4, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12, padding: compact ? '10px 16px' : '12px 16px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!compact && <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.06)', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 11, borderRadius: 4, background: 'rgba(255,255,255,0.07)', width: `${65 + (i % 3) * 12}%`, animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: 9, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: `${40 + (i % 2) * 15}%`, animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

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

function extractEan(url) {
  if (!url) return null
  const m1 = url.match(/\/Ean\/(\d+)/i)
  if (m1) return m1[1]
  const m2 = url.match(/targetEAN=(\d+)/i)
  if (m2) return m2[1]
  return null
}

async function openBook(url, creds) {
  const ean = extractEan(url)
  if (!ean) { window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer'); return }
  const win = window.open('', '_blank')
  const fallback = `https://apps.noordhoff.nl/se/deeplink?targetEAN=${ean}`
  try {
    if (!creds) throw new Error('no creds')
    const { url: ssoUrl } = await callMagister(creds, 'open_book', { ean })
    win.location.href = ssoUrl || fallback
  } catch {
    win.location.href = fallback
  }
}

const SOMTODAY_EMAIL = 'jbrugman.prive@gmail.com'

export default function MagisterWidget({ userId, userEmail, onSubjectsSync, tabless = false, gridLayout = false, seamless = false }) {
  const somtodayEnabled = userEmail === SOMTODAY_EMAIL
  const [creds, setCreds] = useState(() => {
    if (!userId) return null
    try { return JSON.parse(localStorage.getItem(storageKey(userId))) || null } catch { return null }
  })
  const [somtodayCreds, setSomtodayCreds] = useState(() => {
    if (!userId) return null
    try { return JSON.parse(localStorage.getItem(somtodayKey(userId))) || null } catch { return null }
  })
  const [formCreds, setFormCreds] = useState({ school: 'ichthus', username: '', password: '' })
  const [showSettings, setShowSettings] = useState(() => {
    if (!userId) return true
    try {
      return !JSON.parse(localStorage.getItem(storageKey(userId))) && !JSON.parse(localStorage.getItem(somtodayKey(userId)))
    } catch { return true }
  })
  // SOMtoday login state
  const [stProvider, setStProvider] = useState('magister')  // 'magister' | 'somtoday'
  const [stLoading, setStLoading] = useState(false)
  const [stError, setStError] = useState(null)
  const [stTokenPaste, setStTokenPaste] = useState('')
  const [tab, setTab] = useState('vakken')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ grades: null, homework: null, assignments: null, studiewijzer: null })
  const [expanded, setExpanded] = useState(true)
  const [profile, setProfile] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [swDetail, setSwDetail] = useState(null)        // { sw, topics, loading, error }
  const [bronLoading, setBronLoading] = useState({})
  const [expandedTopics, setExpandedTopics] = useState({})

  // Auto-connect SOMtoday via env var refresh token (no user action needed)
  useEffect(() => {
    if (!somtodayEnabled || somtodayCreds) return
    callSomtoday('autologin', {}).then(async tokenData => {
      const me = await callSomtoday('me', { accessToken: tokenData.access_token, somtodayApiUrl: tokenData.somtoday_api_url })
      const stored = {
        somtodayApiUrl: tokenData.somtoday_api_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
        studentId: me.id,
        displayName: me.roepnaam || me.achternaam || 'Leerling',
      }
      localStorage.setItem(somtodayKey(userId), JSON.stringify(stored))
      setSomtodayCreds(stored)
      window.dispatchEvent(new Event('somtodayLogin'))
    }).catch(() => {}) // silent — wizard is fallback
  }, [somtodayEnabled, userId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const result = await callMagister(c, 'fetchAll', { hwStart: inDays(0), hwEnd: inDays(30) })
      setData({ grades: result.grades, homework: result.homework, assignments: result.assignments, studiewijzer: result.studiewijzer })
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
      const rows = materials
        .filter(mat => mat.url)
        .map(mat => ({ vak_naam: matchVak(mat.vak), url: toBookUrl(mat.url) }))
        .filter(row => row.vak_naam)
      if (!rows.length) return
      await supabase.from('subject_links').upsert(rows, { onConflict: 'vak_naam' })
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
    if (creds?.username) clearStoredTokens(creds.username)
    localStorage.removeItem(storageKey(userId))
    setCreds(null)
    setData({ grades: null, homework: null, assignments: null, studiewijzer: null })
    if (!somtodayCreds) setShowSettings(true)
    setFormCreds({ school: '', username: '', password: '' })
  }

  const connectFromPaste = async () => {
    setStLoading(true); setStError(null)
    try {
      let parsed
      try { parsed = JSON.parse(stTokenPaste.trim()) } catch { throw new Error('Ongeldig JSON — kopieer het resultaat opnieuw') }

      // Find access_token: either direct field or inside an oidc.user:* key
      let accessToken, refreshToken, expiresAt, somtodayApiUrl
      const oidcKey = Object.keys(parsed).find(k => k.startsWith('oidc.user:'))
      if (oidcKey) {
        const oidc = typeof parsed[oidcKey] === 'string' ? JSON.parse(parsed[oidcKey]) : parsed[oidcKey]
        accessToken = oidc.access_token
        refreshToken = oidc.refresh_token
        expiresAt = oidc.expires_at
        somtodayApiUrl = oidc.profile?.somtodayApiUrl || oidc.profile?.som_url || null
      } else {
        accessToken = parsed.access_token
        refreshToken = parsed.refresh_token
        expiresAt = parsed.expires_at
        somtodayApiUrl = parsed.somtoday_api_url || null
      }
      if (!accessToken) throw new Error('Geen access_token gevonden — probeer het commando opnieuw')

      const apiUrl = somtodayApiUrl || 'https://production.somtoday.nl'
      const me = await callSomtoday('me', { accessToken, somtodayApiUrl: apiUrl })
      const stored = {
        somtodayApiUrl: apiUrl,
        accessToken,
        refreshToken,
        expiresAt: expiresAt || Math.floor(Date.now() / 1000) + 3600,
        studentId: me.id,
        displayName: me.roepnaam || me.achternaam || 'Leerling',
      }
      localStorage.setItem(somtodayKey(userId), JSON.stringify(stored))
      setSomtodayCreds(stored)
      setStTokenPaste('')
      setShowSettings(false)
      window.dispatchEvent(new Event('somtodayLogin'))
      // Seed Supabase so auto-login works for all future visitors/devices
      callSomtoday('savetoken', { refreshToken, accessToken, expiresAt: stored.expiresAt, apiUrl }).catch(() => {})
    } catch (e) {
      setStError(e.message)
    }
    setStLoading(false)
  }

  const logoutSomtoday = () => {
    localStorage.removeItem(somtodayKey(userId))
    setSomtodayCreds(null)
    if (!creds) setShowSettings(true)
  }

  const refresh = () => {
    setData({ grades: null, homework: null, assignments: null, studiewijzer: null })
    fetchAllData(creds)
  }

  const openBron = async (bron) => {
    console.log('[openBron]', bron)
    if (!bron.href && bron.url) { window.open(bron.url, '_blank'); return }
    if (!bron.href) { console.warn('[openBron] geen href of url'); return }

    // Open venster SYNCHROON binnen de user gesture (Safari-fix)
    // Zonder dit blokkeert Safari window.open na de async fetch
    const newWin = window.open('', '_blank')

    setBronLoading(prev => ({ ...prev, [bron.id]: true }))
    try {
      const result = await callMagister(creds, 'bron_download', { href: bron.href })
      console.log('[bron] debug:', result._debug)
      console.log('[bron] contentType:', result.contentType, 'base64 start:', result.base64?.slice(0, 20))
      const byteChars = atob(result.base64)
      const byteArray = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i)
      // Bepaal content type vanuit bestandsnaam als generiek
      const extMatch = bron.naam.match(/\.([a-zA-Z0-9]+)(?:\s|$|\))/); const ext = extMatch ? extMatch[1].toLowerCase() : bron.naam.split('.').pop().toLowerCase()
      const mimeMap = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
      const contentType = (result.contentType && result.contentType !== 'application/octet-stream') ? result.contentType : (mimeMap[ext] || 'application/octet-stream')
      const blob = new Blob([byteArray], { type: contentType })
      const url = URL.createObjectURL(blob)
      if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
        // Navigeer het al-geopende venster → werkt op Safari
        if (newWin) newWin.location.href = url
        else window.open(url, '_blank')           // fallback (niet-Safari)
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else {
        // Download: sluit het lege venster, gebruik anchor-trick
        if (newWin) newWin.close()
        const a = document.createElement('a')
        a.href = url; a.download = bron.naam
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
    } catch (e) {
      if (newWin) newWin.close()         // Ruim venster op bij fout
      console.error('Download mislukt:', e)
    }
    setBronLoading(prev => ({ ...prev, [bron.id]: false }))
  }

  const openStudiewijzer = async (sw) => {
    setSwDetail({ sw, topics: [], loading: true, error: null })
    try {
      const result = await callMagister(creds, 'studiewijzer_detail', { id: sw.id })
      console.log('[Studiewijzer] detail status:', result._debug?.detailStatus)
      console.log('[Studiewijzer] detail raw:', result._debug?.detailText)
      console.log('[Studiewijzer] topics status:', result._debug?.topicsStatus)
      console.log('[Studiewijzer] topics raw:', result._debug?.topicsText)
      setExpandedTopics({})
      const topics = result.topics || []
      topics.forEach(t => { if (t._rawBronnen?.length) console.log('[rawBron]', t.naam, JSON.stringify(t._rawBronnen[0])) })
      setSwDetail({ sw, topics, loading: false, error: null })
    } catch (e) {
      setSwDetail({ sw, topics: [], loading: false, error: e.message })
    }
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

  const noCard = tabless || seamless
  const widgetStyle = noCard ? {} : {
    borderLeft: '3px solid rgba(129,140,248,0.45)',
    background: 'linear-gradient(135deg, rgba(129,140,248,0.05) 0%, transparent 60%)',
  }

  return (
    <div className={noCard ? '' : 'glass-card p-4'} style={{ ...(gridLayout ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}), ...widgetStyle }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={12} style={{ color: '#818CF8' }} />
          </div>
          <span style={{ fontSize: 10, color: '#818CF8', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>School</span>
          {creds && (
            <span style={{ background: accentBg(10), border: accentBorder(25), borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: 'var(--accent)' }}>
              Magister
            </span>
          )}
          {somtodayCreds && (
            <span style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: '#FBBF24' }}>
              SOMtoday
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
            <Settings size={11} /> {(creds || somtodayCreds) ? (showSettings ? 'Sluiten' : 'Instelling') : 'Inloggen'}
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
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Provider selector — SOMtoday only for specific account */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
                {(somtodayEnabled ? ['magister', 'somtoday'] : ['magister']).map(p => (
                  <button key={p} onClick={() => setStProvider(p)}
                    style={{ flex: 1, padding: '5px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: stProvider === p ? 700 : 400,
                      background: stProvider === p ? (p === 'somtoday' ? 'rgba(251,191,36,0.15)' : accentBg(15)) : 'transparent',
                      color: stProvider === p ? (p === 'somtoday' ? '#FBBF24' : 'var(--accent)') : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.12s',
                    }}>
                    {p === 'magister' ? 'Magister' : 'SOMtoday'}
                  </button>
                ))}
              </div>

              {/* Magister form */}
              {stProvider === 'magister' && (<>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>
                  Log in met je Magister-account. Vakken en lesmateriaal worden automatisch gesynchroniseerd.
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
                      Ontkoppelen
                    </button>
                  )}
                  <button onClick={saveCreds} disabled={loading || !formCreds.username || !formCreds.password}
                    style={{ flex: 2, padding: '7px', borderRadius: '8px', border: accentBorder(40), background: accentBg(12), color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: (!formCreds.username || !formCreds.password) ? 0.4 : 1 }}>
                    {loading ? 'Bezig...' : creds ? 'Opnieuw inloggen' : 'Inloggen & opslaan'}
                  </button>
                </div>
              </>)}

              {/* SOMtoday form — token wizard */}
              {stProvider === 'somtoday' && (<>
                {somtodayCreds ? (
                  <>
                    <p style={{ margin: 0, fontSize: 11, color: '#4ADE80' }}>✓ Gekoppeld als {somtodayCreds.displayName}</p>
                    <button onClick={logoutSomtoday}
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px' }}>
                      Ontkoppelen
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      Eenmalige koppeling via je browser. Volg de 3 stappen:
                    </p>
                    {/* Step 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>① Open leerling.somtoday.nl en log in</span>
                      <a href="https://leerling.somtoday.nl" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.08)', color: '#FBBF24', textDecoration: 'none', fontSize: 12, fontWeight: 600, width: 'fit-content' }}>
                        <ExternalLink size={12} /> leerling.somtoday.nl
                      </a>
                    </div>
                    {/* Step 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>② Open de console (F12 → Console) en plak dit commando:</span>
                      <div style={{ position: 'relative' }}>
                        <code style={{ display: 'block', padding: '7px 32px 7px 8px', borderRadius: 7, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: '#A5F3FC', wordBreak: 'break-all', lineHeight: 1.4 }}>
                          {`copy(JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>/oidc|token|somtoday/i.test(k)))))`}
                        </code>
                        <button onClick={() => {
                          navigator.clipboard.writeText(`copy(JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>/oidc|token|somtoday/i.test(k)))))`)
                        }} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, padding: '2px 6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
                          Kopieer
                        </button>
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Druk Enter — het commando kopieert het resultaat automatisch.</span>
                    </div>
                    {/* Step 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>③ Plak het resultaat hier:</span>
                      <textarea
                        value={stTokenPaste}
                        onChange={e => setStTokenPaste(e.target.value)}
                        placeholder='{"oidc.user:...": "..."}'
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'monospace', resize: 'vertical', outline: 'none' }}
                      />
                    </div>
                    {stError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff6b6b', fontSize: 11 }}>
                        <AlertCircle size={12} /> {stError}
                      </div>
                    )}
                    <button onClick={connectFromPaste} disabled={stLoading || !stTokenPaste.trim()}
                      style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)', color: '#FBBF24', cursor: stTokenPaste.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: stTokenPaste.trim() ? 1 : 0.4 }}>
                      {stLoading ? 'Verbinden...' : 'Verbinden'}
                    </button>
                  </>
                )}
              </>)}
            </div>
          )}

          {!showSettings && (
            <>
              {/* SOMtoday status banner (when connected) */}
              {somtodayCreds && (
                <div style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#FBBF24' }}>📅 SOMtoday rooster geladen — zichtbaar in Agenda</span>
                </div>
              )}

              {/* Tabs (alleen op mobiel, niet in tabless/grid mode) */}
              {!tabless && (
                <div className="magister-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '10px', overflowX: 'auto', paddingBottom: 2 }}>
                  {[
                    { id: 'vakken', label: 'Vakken', icon: <BookMarked size={11} /> },
                    ...(creds ? [
                      { id: 'cijfers', label: 'Cijfers', icon: <BookOpen size={11} /> },
                      { id: 'voorspeller', label: 'Voorspeller', icon: <span style={{ fontSize: 11 }}>🎯</span> },
                      { id: 'studiewijzer', label: 'Studiewijzer', icon: <BookOpen size={11} /> },
                      { id: 'huiswerk', label: 'Huiswerk', icon: <ClipboardList size={11} /> },
                      { id: 'opdrachten', label: 'Opdrachten', icon: <FileText size={11} /> },
                    ] : [])
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      style={{ flexShrink: 0, minWidth: 'fit-content', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap', borderColor: tab === t.id ? accentBg(50) : 'rgba(255,255,255,0.08)', background: tab === t.id ? accentBg(12) : 'transparent', color: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)', position: 'relative' }}>
                      {t.icon} {t.label}
                      {t.badge && <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#FACC15' }} />}
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
                              <button key={vak} onClick={() => openBook(link, creds)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, background: accentBg(8), border: accentBorder(20), color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                                {vak} <ExternalLink size={10} />
                              </button>
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

                {/* Error */}
                {error && !loading && (tab !== 'vakken' || tabless) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b6b', fontSize: '12px', padding: '8px', borderRadius: '8px', background: 'rgba(255,80,80,0.08)', ...(gridLayout ? { gridColumn: '1/-1' } : {}) }}>
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                {/* Cijfers skeleton */}
                {(tabless || tab === 'cijfers') && loading && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><span style={{ fontSize:16 }}>📊</span><span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Laatste cijfers</span></div>}
                    <div className={tabless ? 'card' : ''}><Skeleton rows={4} /></div>
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
                          <div key={i} className="stagger-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < data.grades.length - 1 ? '1px solid var(--border)' : 'none', animationDelay: `${i * 35}ms` }}>
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

                {/* Cijfer-voorspeller */}
                {tab === 'voorspeller' && !loading && (
                  <GradePredictor grades={data.grades} />
                )}
                {tab === 'voorspeller' && loading && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}

                {/* Huiswerk skeleton */}
                {(tabless || tab === 'huiswerk') && loading && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><span style={{ fontSize:16 }}>📋</span><span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Huiswerk</span></div>}
                    <div className={tabless ? 'card' : ''}><Skeleton rows={5} compact /></div>
                  </div>
                )}

                {/* Huiswerk / Studiewijzer */}
                {(tabless || tab === 'huiswerk') && !loading && data.homework && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Huiswerk</span>
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding: 0, ...(gridLayout ? { flex: 1, overflowY: 'auto' } : {}) } : { display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {data.homework.length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '20px 0', margin: 0 }}>Geen huiswerk gevonden</p>
                      )}
                      {data.homework.map((hw, i) => (
                        <div key={i} className="stagger-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: i < data.homework.length - 1 ? '1px solid var(--border)' : 'none', animationDelay: `${i * 35}ms` }}>
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

                {/* Studiewijzer skeleton */}
                {(tabless || tab === 'studiewijzer') && loading && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><span style={{ fontSize:16 }}>📖</span><span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Studiewijzer</span></div>}
                    <div className={tabless ? 'card' : ''}><Skeleton rows={4} compact /></div>
                  </div>
                )}

                {/* Studiewijzer */}
                {(tabless || tab === 'studiewijzer') && !loading && data.studiewijzer && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexShrink:0 }}>
                        <span style={{ fontSize:16 }}>📖</span>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Studiewijzer</span>
                      </div>
                    )}
                    <div className={tabless ? 'card' : ''} style={tabless ? { padding:0, ...(gridLayout ? { flex:1, overflowY:'auto' } : {}) } : { display:'flex', flexDirection:'column', gap:4 }}>

                      {/* Detail view */}
                      {swDetail && (
                        <div style={{ display:'flex', flexDirection:'column' }}>
                          <button onClick={() => setSwDetail(null)} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'var(--text-1)', fontSize:12, fontWeight:600, margin:'10px 16px 8px', textAlign:'left' }}>
                            <ChevronDown size={13} style={{ transform:'rotate(90deg)' }} /> {swDetail.sw.naam}
                          </button>
                          {swDetail.loading && (
                            <div style={{ textAlign:'center', padding:'16px', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>
                              <RefreshCw size={14} style={{ animation:'spin 1s linear infinite', display:'block', margin:'0 auto 4px' }} /> Laden...
                            </div>
                          )}
                          {swDetail.error && (
                            <div style={{ display:'flex', alignItems:'center', gap:6, color:'#ff6b6b', fontSize:'11px', padding:'8px 16px' }}>
                              <AlertCircle size={12} /> {swDetail.error}
                            </div>
                          )}
                          {!swDetail.loading && swDetail.topics.length === 0 && !swDetail.error && (
                            <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'12px', textAlign:'center', padding:'20px 0', margin:0 }}>
                              Geen onderdelen gevonden (check console voor API-structuur)
                            </p>
                          )}
                          {swDetail.topics.map((topic, i) => {
                            const open = !!expandedTopics[topic.id]
                            return (
                            <div key={i} style={{ borderBottom: i < swDetail.topics.length-1 ? '1px solid var(--border)' : 'none' }}>
                              {/* Map header — klikbaar */}
                              <button onClick={() => setExpandedTopics(prev => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                                style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <span style={{ fontSize:14 }}>📁</span>
                                <span style={{ flex:1, fontWeight:600, fontSize:12, color:'var(--text-1)' }}>{topic.naam}</span>
                                {topic.bijlagen.length > 0 && (
                                  <span style={{ fontSize:10, color:'var(--text-3)' }}>{topic.bijlagen.length}</span>
                                )}
                                <ChevronDown size={13} style={{ color:'var(--text-3)', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.15s' }} />
                              </button>
                              {/* Inhoud — alleen als open */}
                              {open && (
                                <div style={{ padding:'0 16px 10px 38px', display:'flex', flexDirection:'column', gap:4 }}>
                                  {topic.inhoud && (
                                    <p style={{ fontSize:11, color:'var(--text-3)', margin:'0 0 4px' }}>{stripHtml(topic.inhoud)}</p>
                                  )}
                                  {topic.bijlagen.length === 0 && (
                                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>Geen bestanden</span>
                                  )}
                                  {topic.bijlagen.map((b, j) => (
                                    (b.href || b.url)
                                      ? <button key={j} onClick={() => openBron(b)} disabled={bronLoading[b.id]} style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:11, color:'var(--accent)', display:'flex', alignItems:'center', gap:4, textAlign:'left', opacity: bronLoading[b.id] ? 0.5 : 1 }}>
                                          {bronLoading[b.id] ? <RefreshCw size={10} style={{ animation:'spin 1s linear infinite' }} /> : <ExternalLink size={10} />} {b.naam}
                                        </button>
                                      : <span key={j} style={{ fontSize:11, color:'var(--text-3)' }}>{b.naam}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )})}
                        </div>
                      )}

                      {/* Lijst view */}
                      {!swDetail && (
                        <>
                          {data.studiewijzer.length === 0 && (
                            <p style={{ color:'rgba(255,255,255,0.25)', fontSize:'12px', textAlign:'center', padding:'20px 0', margin:0 }}>Geen studiewijzer gevonden</p>
                          )}
                          {data.studiewijzer.map((sw, i) => (
                            <div key={i} className="stagger-item" onClick={() => openStudiewijzer(sw)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: i < data.studiewijzer.length-1 ? '1px solid var(--border)' : 'none', cursor:'pointer', animationDelay: `${i * 35}ms` }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: sw.vak ? 3 : 0 }}>
                                  {sw.vak && (
                                    <span style={{ fontSize:11, color:'var(--accent)', background:accentBg(8), border:accentBorder(20), borderRadius:20, padding:'1px 7px', flexShrink:0 }}>{sw.vak}</span>
                                  )}
                                </div>
                                <p style={{ fontSize:12, color:'var(--text-1)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sw.naam || '?'}</p>
                                {sw.omschrijving && (
                                  <p style={{ fontSize:11, color:'var(--text-3)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                                    {stripHtml(sw.omschrijving)}
                                  </p>
                                )}
                              </div>
                              <ChevronDown size={14} style={{ transform:'rotate(-90deg)', color:'var(--text-3)', flexShrink:0, marginTop:2 }} />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Opdrachten skeleton */}
                {(tabless || tab === 'opdrachten') && loading && (
                  <div style={tabless ? secWrap : {}}>
                    {tabless && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><span style={{ fontSize:16 }}>📝</span><span style={{ fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Opdrachten</span></div>}
                    <div className={tabless ? 'card' : ''}><Skeleton rows={5} compact /></div>
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
                          <div key={i} className="stagger-item" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '0 12px', alignItems: 'center', padding: '10px 16px', borderBottom: i < data.assignments.length - 1 ? '1px solid var(--border)' : 'none', animationDelay: `${i * 35}ms` }}>
                            <span style={{ fontSize: 11, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vak || '–'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.naam || 'Onbekend'}</span>
                            <span style={{ fontSize: 11, color: overdue ? '#FF6B6B' : 'var(--text-3)' }}>{a.deadline ? formatDate(a.deadline) : '–'}</span>
                            <span style={{ fontSize: 10, color: statusColor, background: statusColor + '18', border: `1px solid ${statusColor}44`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                              {statusLabel}
                            </span>
                          </div>
                        ) : (
                          <div key={i} className="stagger-item" style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${overdue ? 'rgba(255,80,80,0.2)' : 'rgba(255,255,255,0.06)'}`, animationDelay: `${i * 35}ms` }}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
