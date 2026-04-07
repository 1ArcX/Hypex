import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { X, Shield, Bell, Briefcase } from 'lucide-react'

export default function AdminPanel({ onClose, profiles = [], onProfilesChange }) {
  const [testStatus, setTestStatus] = useState(null) // null | 'sending' | 'ok' | 'err'
  const [toggling, setToggling] = useState(null) // userId being toggled

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

  const toggleWerkTab = async (profile) => {
    setToggling(profile.id)
    await supabase.from('profiles').update({ werk_tab: !profile.werk_tab }).eq('id', profile.id)
    await onProfilesChange?.()
    setToggling(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-card p-6" style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', margin: '0 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(255,180,0,0.15)', border: '1px solid rgba(255,180,0,0.4)', borderRadius: 10, padding: 8 }}>
              <Shield size={18} color="#FFB400" />
            </div>
            <div>
              <h2 style={{ color: 'white', fontWeight: 700, margin: 0 }}>Admin Paneel</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Gebruikersbeheer</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Push test */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, margin: 0 }}>Push melding testen</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '2px 0 0' }}>Stuurt een test naar dit account</p>
          </div>
          <button onClick={sendTestPush} disabled={testStatus === 'sending'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
              border: '1px solid', cursor: testStatus === 'sending' ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              background: testStatus === 'ok' ? 'rgba(0,255,136,0.12)' : testStatus === 'err' ? 'rgba(255,80,80,0.12)' : 'rgba(0,255,209,0.1)',
              borderColor: testStatus === 'ok' ? 'rgba(0,255,136,0.4)' : testStatus === 'err' ? 'rgba(255,80,80,0.4)' : 'rgba(0,255,209,0.3)',
              color: testStatus === 'ok' ? '#00ff88' : testStatus === 'err' ? '#ff5050' : '#00FFD1',
            }}>
            <Bell size={12} />
            {testStatus === 'sending' ? 'Versturen...' : testStatus === 'ok' ? 'Verstuurd!' : testStatus === 'err' ? 'Mislukt' : 'Verstuur test'}
          </button>
        </div>

        {/* Users */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 }}>
          Gebruikers ({profiles.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Geen gebruikers gevonden</p>
          )}
          {profiles.map(profile => {
            const isToggling = toggling === profile.id
            const werkAan = !!profile.werk_tab
            return (
              <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.full_name || 'Naamloos'}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.email || 'Geen e-mail'}
                  </p>
                </div>
                {/* Werk tab toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Briefcase size={11} style={{ color: werkAan ? '#FF8C42' : 'rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: 10, color: werkAan ? '#FF8C42' : 'rgba(255,255,255,0.25)', fontWeight: 600 }}>Werk</span>
                  </div>
                  <button
                    onClick={() => toggleWerkTab(profile)}
                    disabled={isToggling}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: isToggling ? 'default' : 'pointer',
                      background: werkAan ? '#FF8C42' : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3, left: werkAan ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s',
                      opacity: isToggling ? 0.5 : 1,
                    }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
