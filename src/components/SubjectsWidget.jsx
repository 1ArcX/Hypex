import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { matchVak } from '../utils/alleVakken'

const MAGISTER_KEY = 'magister_credentials'

function getCreds() {
  try { return JSON.parse(localStorage.getItem(MAGISTER_KEY)) || null } catch { return null }
}

async function magisterCall(creds, action, extra = {}) {
  const res = await fetch('/.netlify/functions/magister', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...creds, action, ...extra })
  })
  if (!res.ok) throw new Error('Magister fout')
  return res.json()
}

export default function SubjectsWidget({ userId, onSyncComplete }) {
  const [profile, setProfile] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchProfile()
    fetchLinks().then(() => {
      // Auto-sync book links on mount if logged in to Magister
      const creds = getCreds()
      if (creds) syncLinks(creds)
    })
  }, [userId])

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
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

  // Sync lesmateriaal → subject_links (book URLs per vak)
  const syncLinks = async (creds) => {
    try {
      const materials = await magisterCall(creds, 'lesmateriaal')
      if (!materials?.length) return
      for (const mat of materials) {
        if (!mat.url) continue
        const vakNaam = matchVak(mat.vak)
        if (!vakNaam) continue
        const { data: existing } = await supabase.from('subject_links').select('id').eq('vak_naam', vakNaam).maybeSingle()
        if (existing) {
          await supabase.from('subject_links').update({ url: mat.url }).eq('vak_naam', vakNaam)
        } else {
          await supabase.from('subject_links').insert({ vak_naam: vakNaam, url: mat.url })
        }
      }
      await fetchLinks()
    } catch {}
  }

  const syncFromMagister = async () => {
    const creds = getCreds()
    if (!creds) {
      setSyncMsg('Niet ingelogd bij Magister')
      setTimeout(() => setSyncMsg(''), 3000)
      return
    }
    setSyncing(true)
    try {
      // 1. Fetch vakken from Magister
      const vakkenRaw = await magisterCall(creds, 'vakken')
      const namen = (vakkenRaw || [])
        .map(v => matchVak(v.naam) || matchVak(v.afkorting))
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)

      if (namen.length) {
        // Full replace: remove subjects not in new list, add missing ones
        const { data: existing } = await supabase.from('subjects').select('id, name').eq('user_id', userId)
        const existingMap = Object.fromEntries((existing || []).map(s => [s.name, s.id]))
        const toDelete = (existing || []).filter(s => !namen.includes(s.name))
        const toInsert = namen.filter(n => !existingMap[n])
        if (toDelete.length) await supabase.from('subjects').delete().in('id', toDelete.map(s => s.id))
        if (toInsert.length) await supabase.from('subjects').insert(toInsert.map(name => ({ name, user_id: userId })))
        await supabase.from('profiles').update({ vakken: namen }).eq('id', userId)
        await fetchProfile()
        onSyncComplete?.()
      }

      // 2. Sync book links
      await syncLinks(creds)

      setSyncMsg(`${namen.length} vakken gesynchroniseerd ✓`)
      setTimeout(() => setSyncMsg(''), 3000)
    } catch {
      setSyncMsg('Sync mislukt')
      setTimeout(() => setSyncMsg(''), 3000)
    }
    setSyncing(false)
  }

  const vakken = profile?.vakken || []
  const klas = profile?.klas || ''

  return (
    <div className="glass-card p-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Mijn Vakken</span>
          {klas && (
            <span style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.25)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: '#00FFD1' }}>
              {klas}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={syncFromMagister} disabled={syncing} title="Vakken en boeklinks synchroniseren vanuit Magister"
            style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#FACC15', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: syncing ? 0.5 : 1 }}>
            <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> Magister
          </button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ fontSize: '11px', color: syncMsg.includes('✓') ? '#4ADE80' : '#FACC15', marginBottom: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
          {syncMsg}
        </div>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {vakken.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
              Klik op "Magister" om je vakken te laden
            </p>
          ) : vakken.map(vak => {
            const link = subjectLinks[vak]
            return (
              <div key={vak}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{vak}</span>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#00FFD1', textDecoration: 'none', background: 'rgba(0,255,209,0.08)', border: '1px solid rgba(0,255,209,0.2)', borderRadius: '6px', padding: '2px 7px' }}>
                    <ExternalLink size={10} /> Boek
                  </a>
                ) : (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.12)' }}>–</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
