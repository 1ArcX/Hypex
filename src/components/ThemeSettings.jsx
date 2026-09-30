import React, { useState } from 'react'
import { X, Palette, RotateCcw, LogOut, Bell, BellOff, Home, Calendar, CheckSquare, Play, CalendarPlus, Download } from 'lucide-react'
import { IconButton, ProgressBar, Pill, FilterTabs } from './ui'
import { useNavLayout } from '../hooks/useNavLayout'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { pushSupported, requestAndSubscribe } from '../utils/push'
import CalendarConnections from './CalendarConnections'

// Download van de Windows-app (desktop/); niet tonen binnen de app zelf.
const DESKTOP_DOWNLOAD = '/downloads/Hypex-Setup.exe'
const IS_WINDOWS_BROWSER = typeof window !== 'undefined' && !window.__HYPEX_DESKTOP__ && /Windows NT/.test(navigator.userAgent)

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
  const [showCalendarConnections, setShowCalendarConnections] = useState(false)
  const [navLayout, setNavLayout] = useNavLayout()
  const isDesktop = useIsDesktop()

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

  const label = { fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', margin: '0 0 8px' }

  return (
    <div className="modal-overlay" style={{ zIndex: 100, padding: 16 }}>
      <div className="card modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title"
        style={{ width: '100%', maxWidth: 460, padding: 22, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={17} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <h2 id="settings-title" className="t-section" style={{ margin: 0, fontSize: 16 }}>Instellingen</h2>
          </div>
          <IconButton icon={X} label="Sluiten" onClick={onClose} />
        </div>

        {/* Kleur presets */}
        <div style={{ marginBottom: 18 }}>
          <p style={label}>Accentkleur</p>
          <div role="radiogroup" aria-label="Accentkleur" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {PRESETS.map(preset => {
              const active = theme.accent?.toLowerCase() === preset.accent.toLowerCase()
              return (
                <button key={preset.name} onClick={() => applyPreset(preset)} role="radio" aria-checked={active}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--r-sm)',
                    fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', minWidth: 0,
                    background: active ? `color-mix(in srgb, ${preset.accent} 14%, transparent)` : 'var(--c-surface-2)',
                    border: `1px solid ${active ? `color-mix(in srgb, ${preset.accent} 50%, transparent)` : 'var(--c-border)'}`,
                    color: active ? preset.accent : 'var(--c-text-2)',
                    boxShadow: active ? `0 0 12px color-mix(in srgb, ${preset.accent} 25%, transparent)` : 'none',
                  }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: preset.accent, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom kleur picker */}
        <div style={{ marginBottom: 18 }}>
          <p style={label}>Eigen kleur</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="color" value={customAccent} onChange={e => applyCustomAccent(e.target.value)} aria-label="Eigen accentkleur kiezen"
              style={{ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
            <span className="tnum" style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', color: 'var(--c-text-2)' }}>{customAccent.toUpperCase()}</span>
          </div>
        </div>

        {/* Live preview — alles hieronder gebruikt var(--accent), dus verandert direct mee */}
        <div style={{ marginBottom: 18 }}>
          <p style={label}>Live preview</p>
          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 10, padding: 10, borderRadius: 'var(--r-md)', background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div className="hx-nav-item is-active" style={{ height: 28, fontSize: 11, padding: '0 8px', gap: 6 }}><Home size={12} /> Dashboard</div>
              <div className="hx-nav-item" style={{ height: 28, fontSize: 11, padding: '0 8px', gap: 6 }}><Calendar size={12} /> Agenda</div>
              <div className="hx-nav-item" style={{ height: 28, fontSize: 11, padding: '0 8px', gap: 6 }}><CheckSquare size={12} /> Taken</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div className="card card-tone" style={{ '--tone': 'var(--accent)', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'none' }}>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="tnum" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>2/3</span>
                  <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Voltooid</span>
                </span>
                <Pill tone="accent">Actief</Pill>
              </div>
              <ProgressBar value={66} tone="accent" height={5} />
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="btn-primary" style={{ padding: '5px 10px', fontSize: 11 }}><Play size={11} /> Start focus</span>
                <span className="btn-neon" style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>Secundair</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 4px', borderRadius: 'var(--r-sm)', background: 'var(--c-surface-2)' }}>
                {[['Home', Home, false], ['Agenda', Calendar, true], ['Taken', CheckSquare, false]].map(([t, I, on]) => (
                  <span key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 9, color: on ? 'var(--accent)' : 'var(--c-text-3)', fontWeight: on ? 700 : 500 }}>
                    <I size={13} />{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Navigatie (desktop, per apparaat) */}
        {isDesktop && (
          <div style={{ marginBottom: 18 }}>
            <p style={label}>Navigatie <span style={{ fontWeight: 500, color: 'var(--c-text-3)' }}>· dit apparaat</span></p>
            <FilterTabs variant="segmented" label="Positie navigatie" value={navLayout.position}
              onChange={v => setNavLayout({ position: v })}
              items={[{ value: 'left', label: 'Links (verticaal)' }, { value: 'top', label: 'Boven (horizontaal)' }]} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 13, color: 'var(--c-text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={navLayout.autoHide} onChange={e => setNavLayout({ autoHide: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              Automatisch verbergen
            </label>
            {navLayout.autoHide && <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 4, lineHeight: 1.5 }}>
              Beweeg je muis naar de {navLayout.position === 'top' ? 'bovenrand' : 'linkerrand'} om de navigatie te tonen.
            </div>}
          </div>
        )}

        {/* SOMtoday leskleur — alleen voor het SOMtoday-account */}
        {userEmail === SOMTODAY_EMAIL && (
          <div style={{ marginBottom: 18 }}>
            <p style={label}>SOMtoday leskleur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={somtodayColor} onChange={e => applySomtodayColor(e.target.value)} aria-label="SOMtoday leskleur"
                style={{ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
              <span style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', color: 'var(--c-text-2)' }}>{somtodayColor}</span>
              <button onClick={() => applySomtodayColor('#FACC15')} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                reset
              </button>
            </div>
          </div>
        )}

        {/* Meldingen */}
        <div style={{ marginBottom: 18 }}>
          <p style={label}>Meldingen</p>
          {notifState === 'unsupported' && (
            <div style={{ fontSize: 12, color: 'var(--c-text-3)', padding: '8px 0' }}>
              Niet ondersteund op dit apparaat / browser.
            </div>
          )}
          {notifState === 'denied' && (
            <div style={{ fontSize: 12, color: 'var(--c-danger)', lineHeight: 1.5 }}>
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
              className="btn-neon" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: notifState === 'loading' ? 'default' : 'pointer' }}
            >
              <Bell size={14} aria-hidden="true" /> {notifState === 'loading' ? 'Even wachten...' : 'Meldingen aanzetten'}
            </button>
          )}
          {notifState === 'granted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 'var(--r-md)', background: 'color-mix(in srgb, var(--c-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--c-success) 25%, transparent)', fontSize: 13, color: 'var(--c-success)' }}>
              <Bell size={14} aria-hidden="true" /> Meldingen staan aan
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <p style={label}>Externe agenda's</p>
          <button onClick={() => setShowCalendarConnections(true)} className="btn-ghost" style={{ width: '100%', padding: '9px 12px' }}>
            <CalendarPlus size={14} aria-hidden="true" /> Google Agenda of MijnX koppelen
          </button>
        </div>

        {IS_WINDOWS_BROWSER && (
          <div style={{ marginBottom: 18 }}>
            <p style={label}>Desktop-app</p>
            <a href={DESKTOP_DOWNLOAD} download className="btn-ghost" style={{ width: '100%', padding: '9px 12px', textDecoration: 'none' }}>
              <Download size={14} aria-hidden="true" /> Download Hypex voor Windows
            </a>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 6, lineHeight: 1.5 }}>
              Eigen venster, werkt zichzelf bij. Zie je "Windows heeft uw pc beschermd"? Kies Meer info → Toch uitvoeren.
            </div>
          </div>
        )}

        <button onClick={resetTheme} className="btn-ghost" style={{ width: '100%', padding: '9px 12px', marginBottom: 8, color: 'var(--c-text-2)' }}>
          <RotateCcw size={13} aria-hidden="true" /> Standaard herstellen
        </button>

        {onLogout && (
          <button onClick={onLogout} className="btn-ghost hx-logout" style={{ width: '100%', padding: '9px 12px', color: 'var(--c-danger)', borderColor: 'color-mix(in srgb, var(--c-danger) 25%, transparent)', background: 'color-mix(in srgb, var(--c-danger) 6%, transparent)' }}>
            <LogOut size={13} aria-hidden="true" /> Uitloggen
          </button>
        )}
      </div>
      {showCalendarConnections && <CalendarConnections onClose={() => setShowCalendarConnections(false)} />}
    </div>
  )
}
