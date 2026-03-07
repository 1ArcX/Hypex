import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { X, Save, Shield, ExternalLink } from 'lucide-react'

const ALLE_VAKKEN = [
  'Aardrijkskunde', 'Bedrijfseconomie', 'Bewegen, sport en maatschappij (BSM)',
  'Biologie', 'Culturele & kunstzinnige vorming (CKV)', 'Duits', 'Economie',
  'Engels', 'Frans', 'Geschiedenis', 'Kunst Beeldend', 'Levensbeschouwelijke vorming',
  'Lichamelijke oefening', 'Loopbaanoriëntatie/begeleiding (LOB)', 'Maatschappijleer',
  'Natuurkunde', 'Nederlands', 'Profielwerkstuk (PWS)', 'Rekenen 3F',
  'Scheikunde', 'Wiskunde A', 'Wiskunde B'
]

export default function AdminPanel({ onClose }) {
  const [links, setLinks] = useState({})
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    supabase.from('subject_links').select('*').then(({ data }) => {
      if (data) {
        const map = {}
        data.forEach(row => { map[row.vak_naam] = row.url || '' })
        setLinks(map)
      }
    })
  }, [])

  const handleSave = async (vak) => {
    setSaving(vak)
    await supabase.from('subject_links').upsert({ vak_naam: vak, url: links[vak] || '', updated_at: new Date().toISOString() }, { onConflict: 'vak_naam' })
    setSaving(null)
    setSaved(vak)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-card p-6" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', margin: '0 16px' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div style={{ background: 'rgba(255,180,0,0.15)', border: '1px solid rgba(255,180,0,0.4)', borderRadius: '10px', padding: '8px' }}>
              <Shield size={18} color="#FFB400" />
            </div>
            <div>
              <h2 className="text-white font-bold">Admin Paneel</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Beheer online boek links per vak</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {ALLE_VAKKEN.map(vak => (
            <div key={vak} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>{vak}</p>
              <div className="flex gap-2">
                <input
                  className="glass-input"
                  placeholder="https://..."
                  value={links[vak] || ''}
                  onChange={e => setLinks(prev => ({ ...prev, [vak]: e.target.value }))}
                  style={{ fontSize: '12px' }}
                />
                <button onClick={() => handleSave(vak)} className="btn-neon"
                  style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '8px 14px', background: saved === vak ? 'rgba(0,255,100,0.15)' : undefined, borderColor: saved === vak ? 'rgba(0,255,100,0.4)' : undefined, color: saved === vak ? '#00ff88' : undefined }}>
                  {saving === vak ? '...' : saved === vak ? '✓ Opgeslagen' : <><Save size={12} /> Opslaan</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}