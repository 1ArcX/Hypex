import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { X, Save, Shield, Bell } from 'lucide-react'

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
  const [testStatus, setTestStatus] = useState(null) // null | 'sending' | 'ok' | 'err'

  const sendTestPush = async () => {
    setTestStatus('sending')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setTestStatus('err'); return }
      const res = await fetch('/.netlify/functions/pomodoro-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: 'Test melding', body: 'Push notificaties werken!', tag: 'test' }),
      })
      setTestStatus(res.ok ? 'ok' : 'err')
    } catch {
      setTestStatus('err')
    }
    setTimeout(() => setTestStatus(null), 3000)
  }

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

        {/* ── Push test ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, margin: 0 }}>Push melding testen</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>Stuurt een test-notificatie naar dit account</p>
          </div>
          <button onClick={sendTestPush} disabled={testStatus === 'sending'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: '10px', border: '1px solid',
              cursor: testStatus === 'sending' ? 'default' : 'pointer',
              fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
              background: testStatus === 'ok' ? 'rgba(0,255,136,0.12)' : testStatus === 'err' ? 'rgba(255,80,80,0.12)' : 'rgba(0,255,209,0.1)',
              borderColor: testStatus === 'ok' ? 'rgba(0,255,136,0.4)' : testStatus === 'err' ? 'rgba(255,80,80,0.4)' : 'rgba(0,255,209,0.3)',
              color: testStatus === 'ok' ? '#00ff88' : testStatus === 'err' ? '#ff5050' : '#00FFD1',
            }}>
            <Bell size={12} />
            {testStatus === 'sending' ? 'Versturen...' : testStatus === 'ok' ? 'Verstuurd!' : testStatus === 'err' ? 'Mislukt' : 'Verstuur test'}
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