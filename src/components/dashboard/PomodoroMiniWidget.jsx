import React, { useEffect, useState } from 'react'
import { Timer, Play, Pause } from 'lucide-react'
import { CardHeader } from '../ui'
import { toISO } from '../../utils/recurrence'

// Dashboard-widget "Pomodoro": leest de timerstatus die PomodoroTimer bewaart
// (localStorage `pomodoro_v3` / `pomodoro_stats`). Starten/stoppen gebeurt op de
// Pomodoro-pagina zelf; deze widget dupliceert geen timerlogica.

const MODE = {
  work:      { label: 'Focus',       color: 'var(--accent)' },
  break:     { label: 'Pauze',       color: 'var(--c-warning)' },
  longBreak: { label: 'Lange pauze', color: 'var(--cat-persoonlijk)' },
}

function readState() {
  let s = null
  try { s = JSON.parse(localStorage.getItem('pomodoro_v3')) } catch {}
  const mode = s?.mode || 'work'
  const totalMins = mode === 'work' ? (s?.workMins ?? 25) : mode === 'break' ? (s?.breakMins ?? 5) : (s?.longBreakMins ?? 15)
  let remaining = totalMins * 60
  if (s?.running && s.endTime) remaining = Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000))
  else if (s && typeof s.remainingSeconds === 'number') remaining = s.remainingSeconds
  let todayMins = 0
  try { todayMins = (JSON.parse(localStorage.getItem('pomodoro_stats')) || {})[toISO(new Date())] || 0 } catch {}
  return { mode, running: !!s?.running && remaining > 0, remaining, total: totalMins * 60, task: s?.task || '', todayMins }
}

export default function PomodoroMiniWidget({ onOpen }) {
  const [st, setSt] = useState(readState)
  useEffect(() => {
    const iv = setInterval(() => setSt(readState()), 1000)
    return () => clearInterval(iv)
  }, [])

  const m = MODE[st.mode] || MODE.work
  const pct = st.total > 0 ? 1 - st.remaining / st.total : 0
  const R = 40, C = 2 * Math.PI * R
  const mm = String(Math.floor(st.remaining / 60)).padStart(2, '0')
  const ss = String(st.remaining % 60).padStart(2, '0')

  return (
    <div className="card" style={{ padding: 14, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <CardHeader icon={Timer} title="Pomodoro" />
      <button type="button" onClick={onOpen} aria-label={st.running ? `Timer loopt: ${mm}:${ss}. Open Pomodoro` : 'Open Pomodoro om een focussessie te starten'}
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
          <span className="t-kpi" style={{ color: st.running ? m.color : 'var(--c-text)' }}>{mm}:{ss}</span>
          <span className="t-meta" style={{ color: st.running ? m.color : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {st.task || m.label}{st.running ? '' : ' · klaar om te starten'}
          </span>
          <span className="t-meta tnum" style={{ marginTop: 6 }}>Vandaag {st.todayMins} min focus</span>
        </span>
      </button>
    </div>
  )
}
