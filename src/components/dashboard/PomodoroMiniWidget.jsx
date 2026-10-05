import React from 'react'
import { Timer, Play, Pause } from 'lucide-react'
import { CardHeader } from '../ui'
import { fmtClock, POMO_MODE } from './pomodoroState'
import { usePomodoroState } from './PomodoroBanner'

// Dashboard-widget "Pomodoro": leest de timerstatus die PomodoroTimer bewaart (zie pomodoroState.js).
// Starten gebeurt op de Pomodoro-pagina; loopt de timer, dan toont het dashboard de PomodoroBanner.

export default function PomodoroMiniWidget({ onOpen, st: given }) {
  const own = usePomodoroState()
  const st = given || own
  const m = POMO_MODE[st.mode] || POMO_MODE.work
  const pct = st.total > 0 ? 1 - st.remaining / st.total : 0
  const R = 40, C = 2 * Math.PI * R
  const clock = fmtClock(st.remaining)

  return (
    <div className="card glow-card" style={{ '--glow': m.color, padding: 14, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <CardHeader icon={Timer} title="Pomodoro" />
      <button type="button" onClick={onOpen} aria-label={st.running ? `Timer loopt: ${clock}. Open Pomodoro` : 'Open Pomodoro om een focussessie te starten'}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <span style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true"
            style={{ transform: 'rotate(-90deg)', filter: st.running ? `drop-shadow(0 0 8px color-mix(in srgb, ${m.color} 45%, transparent))` : 'none' }}>
            <circle cx="46" cy="46" r={R} fill="none" stroke="var(--c-surface-3)" strokeWidth="5" />
            <circle cx="46" cy="46" r={R} fill="none" stroke={m.color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - (st.running || pct > 0 ? pct : 0))} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
            {st.running ? <Pause size={24} /> : <Play size={26} style={{ marginLeft: 3 }} />}
          </span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
          <span className="t-kpi" style={{ color: st.running ? m.color : 'var(--c-text)' }}>{clock}</span>
          <span className="t-meta" style={{ color: st.running ? m.color : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {st.task || m.label}{st.running ? '' : ' · klaar om te starten'}
          </span>
          <span className="t-meta tnum" style={{ marginTop: 6 }}>Vandaag {st.todayMins} min focus</span>
        </span>
      </button>
    </div>
  )
}
