import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { GraduationCap, BookOpen, Check } from 'lucide-react'

const KLASSEN = ['Havo 3', 'Havo 4', 'Havo 5', 'VWO 4', 'VWO 5', 'VWO 6']

const ALLE_VAKKEN = [
  'Aardrijkskunde', 'Bedrijfseconomie', 'Bewegen, sport en maatschappij (BSM)',
  'Biologie', 'Culturele & kunstzinnige vorming (CKV)', 'Duits', 'Economie',
  'Engels', 'Frans', 'Geschiedenis', 'Kunst Beeldend', 'Levensbeschouwelijke vorming',
  'Lichamelijke oefening', 'Loopbaanoriëntatie/begeleiding (LOB)', 'Maatschappijleer',
  'Natuurkunde', 'Nederlands', 'Profielwerkstuk (PWS)', 'Rekenen 3F',
  'Scheikunde', 'Wiskunde A', 'Wiskunde B'
]

export default function ProfileSetup({ userId, onComplete }) {
  const [klas, setKlas] = useState('')
  const [selectedVakken, setSelectedVakken] = useState([])
  const [naam, setNaam] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleVak = (vak) => {
    setSelectedVakken(prev =>
      prev.includes(vak) ? prev.filter(v => v !== vak) : [...prev, vak]
    )
  }

const handleSave = async () => {
  if (!klas || selectedVakken.length === 0 || !naam.trim()) return
  setSaving(true)

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: naam.trim(),
      klas: klas,
      vakken: selectedVakken,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'id',        // update als id al bestaat
      ignoreDuplicates: false  // altijd overschrijven
    })

  if (error) {
    console.error('Fout:', error)
    alert('Opslaan mislukt: ' + error.message)
    setSaving(false)
    return
  }

  setTimeout(() => {
    setSaving(false)
    onComplete()
  }, 200)
}

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="glass-card p-8" style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', margin: '0 16px' }}>
        <div className="flex items-center gap-3 mb-6">
          <div style={{ background: 'rgba(0,255,209,0.15)', border: '1px solid rgba(0,255,209,0.3)', borderRadius: '12px', padding: '10px' }}>
            <GraduationCap size={20} color="#00FFD1" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Welkom! 👋</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Stel je profiel in om te beginnen</p>
          </div>
        </div>

        {/* Naam */}
        <div className="mb-4">
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Jouw naam *</label>
          <input className="glass-input" placeholder="Bijv. Ahmed" value={naam} onChange={e => setNaam(e.target.value)} />
        </div>

        {/* Klas */}
        <div className="mb-4">
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Klas *</label>
          <select className="glass-input" value={klas} onChange={e => setKlas(e.target.value)} style={{ colorScheme: 'dark' }}>
            <option value="">Selecteer je klas...</option>
            {KLASSEN.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Vakken */}
        <div className="mb-6">
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            <BookOpen size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Selecteer je vakken * ({selectedVakken.length} geselecteerd)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ALLE_VAKKEN.map(vak => {
              const selected = selectedVakken.includes(vak)
              return (
                <button key={vak} onClick={() => toggleVak(vak)} style={{
                  padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                  border: `1px solid ${selected ? 'rgba(0,255,209,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: selected ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.04)',
                  color: selected ? '#00FFD1' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {selected && <Check size={10} />}
                  {vak}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={handleSave} disabled={!klas || selectedVakken.length === 0 || !naam.trim() || saving}
          className="btn-neon w-full" style={{ opacity: (!klas || selectedVakken.length === 0 || !naam.trim()) ? 0.4 : 1 }}>
          {saving ? 'Opslaan...' : 'Dashboard openen →'}
        </button>
      </div>
    </div>
  )
}