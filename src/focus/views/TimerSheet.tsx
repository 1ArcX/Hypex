import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Pause, Play, RotateCcw, SkipForward, Square, Volume2, VolumeX } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { KINDS, NO_COURSE } from '../lib/meta'
import { Sheet } from '../components/ui'
import type { SessionKind } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Engine = any

const SOUNDS = [
  { id: 'off', label: 'Uit' }, { id: 'focus', label: 'Focus' }, { id: 'brown', label: 'Brown' },
  { id: 'rain', label: 'Regen' }, { id: 'ocean', label: 'Oceaan' },
]
const MODE_LABEL: Record<string, string> = { work: 'Focus', break: 'Pauze', longBreak: 'Lange pauze' }
const PRESETS = [15, 25, 45, 60, 90]

export const fmtClock = (secs: number) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

/** Timerscherm: vak/onderwerp/soort, Stopwatch | Pomodoro, grote tijd, bediening, notities, focusgeluid */
export function TimerSheet({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const { state, toggleRunning, reset, skip, switchMode, stopStopwatch, setTimerKind, setMeta, dispatch, soundType, setSoundType, volume, setVolume } = engine
  const courses = useFocusStore(s => s.courses).filter(c => c.status === 'active')
  const topics = useFocusStore(s => s.topics)
  const meta = state.meta
  const sw = state.timerKind === 'stopwatch'
  const running = state.running
  const started = sw ? state.seconds > 0 || running : state.seconds < (state.mode === 'work' ? state.workMins : state.mode === 'break' ? state.breakMins : state.longBreakMins) * 60
  const courseTopics = topics.filter(t => t.course_id === meta.courseId)
  const [tooShort, setTooShort] = useState(false)

  // Notitie lokaal typen, met vertraging synchroniseren
  const [note, setNote] = useState(meta.note || '')
  const lastSent = useRef(meta.note || '')
  useEffect(() => { if (meta.note !== lastSent.current) { setNote(meta.note || ''); lastSent.current = meta.note || '' } }, [meta.note])
  useEffect(() => {
    if (note === lastSent.current) return
    const t = setTimeout(() => { lastSent.current = note; setMeta({ note }) }, 700)
    return () => clearTimeout(t)
  }, [note, setMeta])

  const totalSecs = sw ? 0 : (state.mode === 'work' ? state.workMins : state.mode === 'break' ? state.breakMins : state.longBreakMins) * 60
  const pct = sw ? (state.seconds % 3600) / 3600 : totalSecs ? 1 - state.seconds / totalSecs : 0
  const R = 128, C = 2 * Math.PI * R
  const activeCourse = courses.find(c => c.id === meta.courseId)
  const color = activeCourse?.color || 'var(--fx-orange)'

  const stop = () => {
    if (note !== lastSent.current) { lastSent.current = note; setMeta({ note }) }
    const res = stopStopwatch()
    if (!res.saved) setTooShort(true)
    else onClose()
  }

  return (
    <Sheet onClose={onClose} full label="Timer">
      <div className="fx-timer" style={{ '--tc': color } as React.CSSProperties}>
        <div className="fx-sheet-head">
          <button type="button" className="fx-iconbtn is-solo" onClick={onClose} aria-label="Sluiten"><ChevronDown size={24} /></button>
          <h3>{running ? 'Aan het studeren' : started ? 'Gepauzeerd' : 'Nieuwe sessie'}</h3>
          <div style={{ width: 40 }} />
        </div>

        <div className="fx-seg" style={{ maxWidth: 320, margin: '4px auto 18px' }} role="tablist" aria-label="Timersoort">
          {(['stopwatch', 'pomodoro'] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={state.timerKind === k} className={state.timerKind === k ? 'is-active' : ''}
              disabled={running || (started && state.timerKind !== k)} onClick={() => setTimerKind(k)}>
              {k === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'}
            </button>
          ))}
        </div>

        {/* Vak, onderwerp, soort */}
        <div className="fx-field"><span>Vak</span>
          <div className="fx-chip-row">
            <button type="button" className={`fx-chip${!meta.courseId ? ' is-active' : ''}`} onClick={() => setMeta({ courseId: null, topicId: null })}>{NO_COURSE.name}</button>
            {courses.map(c => (
              <button key={c.id} type="button" className={`fx-chip${meta.courseId === c.id ? ' is-tint' : ''}`}
                style={meta.courseId === c.id ? { background: c.color } : undefined}
                onClick={() => setMeta({ courseId: c.id, topicId: null })}>
                <i style={{ width: 10, height: 10, borderRadius: '50%', background: meta.courseId === c.id ? '#fff' : c.color, display: 'inline-block' }} />
                {c.code || c.name}
              </button>
            ))}
          </div>
        </div>
        {courseTopics.length > 0 && (
          <div className="fx-field"><span>Onderwerp</span>
            <div className="fx-chip-row">
              {courseTopics.map(t => (
                <button key={t.id} type="button" className={`fx-chip${meta.topicId === t.id ? ' is-active' : ''}`} onClick={() => setMeta({ topicId: meta.topicId === t.id ? null : t.id })}>{t.name}</button>
              ))}
            </div>
          </div>
        )}
        <div className="fx-field"><span>Soort</span>
          <div className="fx-chip-row">
            {KINDS.map(k => {
              const on = meta.kind === k.id
              return (
                <button key={k.id} type="button" className={`fx-chip${on ? ' is-tint' : ''}`} style={on ? { background: k.color } : { color: k.color }}
                  onClick={() => setMeta({ kind: on ? null : k.id as SessionKind })}>
                  <k.Icon size={16} /> <span style={{ color: on ? '#fff' : 'var(--fx-text)' }}>{k.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tijd */}
        {!sw && (
          <div className="fx-seg" style={{ maxWidth: 360, margin: '8px auto 0' }} role="tablist" aria-label="Fase">
            {(['work', 'break', 'longBreak'] as const).map(m => (
              <button key={m} type="button" role="tab" aria-selected={state.mode === m} className={state.mode === m ? 'is-active' : ''} onClick={() => switchMode(m)}>{MODE_LABEL[m]}</button>
            ))}
          </div>
        )}
        <div className="fx-timer-ring">
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle cx="150" cy="150" r={R} fill="none" stroke="var(--fx-line)" strokeWidth="10" />
            <circle cx="150" cy="150" r={R} fill="none" stroke="var(--tc)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 150 150)" style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
          </svg>
          <div className="fx-timer-inner">
            <span className="fx-overline">{sw ? 'Stopwatch' : MODE_LABEL[state.mode]}</span>
            <span className="fx-timer-time tnum" role="timer" aria-live="off">{fmtClock(state.seconds)}</span>
            <span className="fx-muted" style={{ fontSize: 15 }}>{activeCourse ? activeCourse.name : 'Zonder vak'}</span>
          </div>
        </div>
        {!sw && !running && !started && state.mode === 'work' && (
          <div className="fx-chips" style={{ justifyContent: 'center', marginTop: -6 }}>
            {PRESETS.map(n => (
              <button key={n} type="button" className={`fx-chip${state.workMins === n ? ' is-active' : ''}`} onClick={() => dispatch({ type: 'SET_WORK_MINS', v: n })}>{n}m</button>
            ))}
          </div>
        )}

        <div className="fx-timer-controls">
          <button type="button" className="fx-round" onClick={() => { if (!started || window.confirm(sw ? 'Deze sessie weggooien?' : 'Timer terugzetten?')) reset() }} aria-label={sw ? 'Weggooien' : 'Terugzetten'} title={sw ? 'Weggooien' : 'Terugzetten'}>
            <RotateCcw size={22} />
          </button>
          <button type="button" className="fx-play" onClick={() => { setTooShort(false); toggleRunning() }} aria-label={running ? 'Pauzeren' : 'Starten'}>
            {running ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" style={{ marginLeft: 4 }} />}
          </button>
          {sw ? (
            <button type="button" className="fx-round is-stop" onClick={stop} disabled={!started} aria-label="Stoppen en opslaan" title="Stoppen en opslaan">
              <Square size={20} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="fx-round" onClick={skip} aria-label="Overslaan" title="Overslaan"><SkipForward size={22} /></button>
          )}
        </div>
        {tooShort && <p className="fx-muted" style={{ textAlign: 'center', fontSize: 14, margin: '-6px 0 10px' }}>Korter dan 1 minuut, dus niet opgeslagen.</p>}

        <div className="fx-field"><span>Notities</span>
          <textarea className="fx-textarea" placeholder="Wat heb je gedaan? Wat moet je nog onthouden?" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="fx-field"><span>Focusgeluid</span>
          <div className="fx-chips">
            {SOUNDS.map(s => (
              <button key={s.id} type="button" className={`fx-chip${soundType === s.id ? ' is-active' : ''}`} onClick={() => setSoundType(s.id)}>{s.label}</button>
            ))}
          </div>
          {soundType !== 'off' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <VolumeX size={18} className="fx-muted" />
              <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(+e.target.value)} style={{ flex: 1, accentColor: 'var(--fx-orange)' }} aria-label="Volume" />
              <Volume2 size={18} className="fx-muted" />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
