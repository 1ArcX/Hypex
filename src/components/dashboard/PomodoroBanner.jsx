import React, { useEffect, useState } from 'react'
import { Pause, Play, ArrowRight } from 'lucide-react'
import { readPomodoro, pausePomodoro, resumePomodoro, fmtClock, POMO_MODE } from './pomodoroState'

// Brede balk bovenaan elke tab (App.jsx, niet op Focus) zolang er een Pomodoro loopt (of gepauzeerd midden in een sessie):
// grote tijd, modus + taak, voortgang over de volle breedte, sessie-stippen, Pauzeer/Hervat en Open.
export function usePomodoroState() {
  const [st, setSt] = useState(readPomodoro)
  useEffect(() => {
    const update = () => setSt(readPomodoro())
    const iv = setInterval(update, 1000)
    window.addEventListener('pomodoroLocalChange', update)
    window.addEventListener('storage', update)
    return () => { clearInterval(iv); window.removeEventListener('pomodoroLocalChange', update); window.removeEventListener('storage', update) }
  }, [])
  return st
}

export default function PomodoroBanner({ st, onOpen }) {
  const m = POMO_MODE[st.mode] || POMO_MODE.work
  const pct = st.total > 0 ? Math.min(1, 1 - st.remaining / st.total) : 0
  return (
    <section className={`pomo-banner${st.running ? ' is-running' : ''}`} style={{ '--glow': m.color }} aria-label="Pomodoro loopt">
      <div className="pomo-banner__main">
        <span className="pomo-banner__dot" aria-hidden="true" />
        <span className="pomo-banner__time tnum" role="timer" aria-live="off">{fmtClock(st.remaining)}</span>
        <span className="pomo-banner__info">
          <span className="pomo-banner__mode">{m.label}{st.paused ? ' · gepauzeerd' : ''}</span>
          <span className="pomo-banner__task">{st.task || (st.mode === 'work' ? 'Focussessie' : 'Even rust')}</span>
        </span>
        <span className="pomo-banner__dots" aria-label={`Sessie ${Math.min(st.sessionsInCycle + 1, st.sessionsPerLong)} van ${st.sessionsPerLong}`}>
          {Array.from({ length: st.sessionsPerLong }, (_, i) => (
            <span key={i} className={i < st.sessionsInCycle ? 'is-done' : i === st.sessionsInCycle && st.mode === 'work' ? 'is-now' : ''} />
          ))}
        </span>
        <span className="pomo-banner__actions">
          <button type="button" className="pomo-banner__btn" onClick={st.running ? pausePomodoro : resumePomodoro}
            aria-label={st.running ? 'Pauzeer timer' : 'Hervat timer'}>
            {st.running ? <Pause size={16} /> : <Play size={16} />} <span>{st.running ? 'Pauzeer' : 'Hervat'}</span>
          </button>
          <button type="button" className="pomo-banner__btn pomo-banner__btn--ghost" onClick={onOpen} aria-label="Open Focus">
            <span>Open</span> <ArrowRight size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className="pomo-banner__bar" aria-hidden="true"><span style={{ width: `${pct * 100}%` }} /></div>
    </section>
  )
}
