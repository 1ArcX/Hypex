import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { BookOpen, ExternalLink, Edit3, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

const ALLE_VAKKEN = [
  'Aardrijkskunde', 'Bedrijfseconomie', 'Bewegen, sport en maatschappij (BSM)',
  'Biologie', 'Culturele & kunstzinnige vorming (CKV)', 'Duits', 'Economie',
  'Engels', 'Frans', 'Geschiedenis', 'Kunst Beeldend', 'Levensbeschouwelijke vorming',
  'Lichamelijke oefening', 'Loopbaanoriëntatie/begeleiding (LOB)', 'Maatschappijleer',
  'Natuurkunde', 'Nederlands', 'Profielwerkstuk (PWS)', 'Rekenen 3F',
  'Scheikunde', 'Wiskunde A', 'Wiskunde B'
]

const KLASSEN = ['Havo 3', 'Havo 4', 'Havo 5', 'VWO 4', 'VWO 5', 'VWO 6']

export default function SubjectsWidget({ userId }) {
  const [profile, setProfile] = useState(null)
  const [subjectLinks, setSubjectLinks] = useState({})
  const [editing, setEditing] = useState(false)
  const [selectedVakken, setSelectedVakken] = useState([])
  const [selectedKlas, setSelectedKlas] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    fetchProfile()
    fetchLinks()
  }, [userId])

const fetchProfile = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    
  if (data) {
    setProfile(data)
    // Zorg dat we een array hebben, ook als het null is in de database
    const userVakken = data.vakken || []
    setSelectedVakken(userVakken)
    setSelectedKlas(data.klas || '')
    console.log("Geladen vakken:", userVakken) // Debugging
  }
};

  const fetchLinks = async () => {
    const { data } = await supabase.from('subject_links').select('*')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.vak_naam] = row.url })
      setSubjectLinks(map)
    }
  }

  const toggleVak = (vak) => {
    setSelectedVakken(prev =>
      prev.includes(vak) ? prev.filter(v => v !== vak) : [...prev, vak]
    )
  }

const handleSave = async () => {
  setSaving(true)

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      vakken: selectedVakken,
      klas: selectedKlas,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Fout:', error)
    alert('Opslaan mislukt: ' + error.message)
    setSaving(false)
    return
  }

  await fetchProfile()
  setSaving(false)
  setEditing(false)
}

  const vakken = profile?.vakken || []
  const klas = profile?.klas || ''

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={14} color="#00FFD1" />
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Mijn Vakken</span>
          {klas && (
            <span style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.25)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', color: '#00FFD1' }}>
              {klas}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setEditing(!editing)}
            style={{ background: editing ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${editing ? 'rgba(0,255,209,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: editing ? '#00FFD1' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            <Edit3 size={11} /> {editing ? 'Annuleer' : 'Bewerk'}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '2px' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Edit mode */}
          {editing ? (
            <div>
              {/* Klas selector */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Klas</label>
                <select className="glass-input" value={selectedKlas} onChange={e => setSelectedKlas(e.target.value)}
                  style={{ fontSize: '12px' }}>
                  <option value="">Selecteer klas...</option>
                  {KLASSEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

            {/* Vakken selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Vakken ({selectedVakken.length} geselecteerd)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                {ALLE_VAKKEN.map(vak => {
                  // Gebruik .includes() om te kijken of het vak in de array zit
                  const isSelected = selectedVakken.includes(vak);
                  
                  return (
                    <button 
                      key={vak} 
                      type="button"
                      onClick={() => toggleVak(vak)}
                      style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        cursor: 'pointer', 
                        border: '1px solid',
                        borderColor: isSelected ? 'rgba(0,255,209,0.6)' : 'rgba(255,255,255,0.1)', 
                        background: isSelected ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.03)', 
                        color: isSelected ? '#00FFD1' : 'rgba(255,255,255,0.5)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        transition: 'all 0.15s' 
                      }}
                    >
                      {isSelected && <Check size={10} />}
                      {vak}
                    </button>
                  )
                })}
              </div>
            </div>

              <button onClick={handleSave} disabled={saving || selectedVakken.length === 0}
                className="btn-neon w-full" style={{ fontSize: '12px', padding: '8px' }}>
                {saving ? 'Opslaan...' : '✓ Opslaan'}
              </button>
            </div>
          ) : (
            /* Weergave mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {vakken.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
                  Geen vakken — klik op Bewerk
                </p>
              ) : (
                vakken.map(vak => {
                  const link = subjectLinks[vak]
                  return (
                    <div key={vak}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.15s' }}
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
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>Geen link</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}