import React, { useState } from 'react'
import { X, Palette, RotateCcw, LogOut, Bell, BellOff } from 'lucide-react'
import { pushSupported, requestAndSubscribe } from '../utils/push'

const PRESETS = [
  { name: 'Neon Cyan', accent: '#00FFD1', bg1: '#0a0a1a', bg2: '#0d1117' },
  { name: 'Purple Dream', accent: '#A78BFA', bg1: '#0d0a1a', bg2: '#110d1f' },
  { name: 'Sunset', accent: '#FF8C42', bg1: '#1a0d0a', bg2: '#1f1108' },
  { name: 'Rose', accent: '#F472B6', bg1: '#1a0a12', bg2: '#1f0d17' },
  { name: 'Emerald', accent: '#34D399', bg1: '#0a1a12', bg2: '#0d1f17' },
  { name: 'Sky Blue', accent: '#60A5FA', bg1: '#0a0f1a', bg2: '#0d1420' },
]

const SOMTODAY_EMAIL = 'jbrugman.prive@gmail.com'

export default function ThemeSettings({ onClose, theme, setTheme, onLogout, userEmail, userId }) {
  const [customAccent, setCustomAccent] = useState(theme.accent)
  const [notifState, setNotifState] = useState(() => {
    if (!pushSupported()) return 'unsupported'
    return Notification.permission // 'default' | 'granted' | 'denied'
  })
  const [somtodayColor, setSomtodayColorState] = useState(() => {
    try { return localStorage.getItem('somtoday_lesson_color') || '#FACC15' } catch { return '#FACC15' }
  })

  const applySomtodayColor = (color) => {
    setSomtodayColorState(color)
    try { localStorage.setItem('somtoday_lesson_color', color) } catch {}
  }

  const applyPreset = (preset) => {
    setTheme({ ...theme, ...preset })
    setCustomAccent(preset.accent)
    document.documentElement.style.setProperty('--accent', preset.accent)
    document.documentElement.style.setProperty('--bg1', preset.bg1)
    document.documentElement.style.setProperty('--bg2', preset.bg2)
  }

  const applyCustomAccent = (color) => {
    setCustomAccent(color)
    setTheme({ ...theme, accent: color })
    document.documentElement.style.setProperty('--accent', color)
  }

  const resetTheme = () => {
    const def = PRESETS[0]
    applyPreset(def)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="glass-card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Palette size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold text-white">Instellingen</h2>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Kleur presets */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Accentkleur</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(preset => (
              <button key={preset.name} onClick={() => applyPreset(preset)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
                style={{
                  background: theme.accent === preset.accent ? `${preset.accent}20` : 'rgba(255,255,255,0.04)',
                  border: theme.accent === preset.accent ? `1px solid ${preset.accent}60` : '1px solid rgba(255,255,255,0.08)',
                  color: theme.accent === preset.accent ? preset.accent : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer'
                }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.accent, flexShrink: 0 }} />
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom kleur picker */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Eigen kleur</p>
          <div className="flex items-center gap-3">
            <input type="color" value={customAccent} onChange={e => applyCustomAccent(e.target.value)}
              style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'none' }} />
            <span className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{customAccent}</span>
          </div>
        </div>

        {/* SOMtoday leskleur — alleen voor het SOMtoday-account */}
        {userEmail === SOMTODAY_EMAIL && (
          <div className="mb-5">
            <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>SOMtoday leskleur</p>
            <div className="flex items-center gap-3">
              <input type="color" value={somtodayColor} onChange={e => applySomtodayColor(e.target.value)}
                style={{ width: '40px', height: '40px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'none' }} />
              <span className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{somtodayColor}</span>
              <button onClick={() => applySomtodayColor('#FACC15')}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                reset
              </button>
            </div>
          </div>
        )}

        {/* Meldingen */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Meldingen</p>
          {notifState === 'unsupported' && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}>
              Niet ondersteund op dit apparaat / browser.
            </div>
          )}
          {notifState === 'denied' && (
            <div style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', lineHeight: 1.5 }}>
              Geblokkeerd — ga naar je telefoon-instellingen → browser → Hypex om meldingen toe te staan.
            </div>
          )}
          {(notifState === 'default' || notifState === 'loading') && (
            <button
              disabled={notifState === 'loading'}
              onClick={async () => {
                setNotifState('loading')
                const result = await requestAndSubscribe(userId)
                setNotifState(result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default')
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', borderRadius: 12, background: 'rgba(0,255,209,0.08)', border: '1px solid rgba(0,255,209,0.25)', color: 'var(--accent)', cursor: notifState === 'loading' ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <Bell size={14} /> {notifState === 'loading' ? 'Even wachten...' : 'Meldingen aanzetten'}
            </button>
          )}
          {notifState === 'granted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.2)', fontSize: 13, color: '#1DB954' }}>
              <Bell size={14} /> Meldingen staan aan
            </div>
          )}
        </div>

        <button onClick={resetTheme}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', marginBottom: 8 }}>
          <RotateCcw size={13} /> Standaard herstellen
        </button>

        {onLogout && (
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.7)'}>
            <LogOut size={13} /> Uitloggen
          </button>
        )}
      </div>
    </div>
  )
}