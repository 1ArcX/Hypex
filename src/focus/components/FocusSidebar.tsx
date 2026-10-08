import { BookOpen, CalendarDays, Home, Pause, Play, Settings, Sparkles, Timer, X } from 'lucide-react'
import type { FocusTab } from '../types'
import { useFocusStore } from '../store/focusStore'
import { fmtClock } from '../views/TimerSheet'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABS: { id: FocusTab; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Overzicht', Icon: Home },
  { id: 'courses', label: 'Vakken', Icon: BookOpen },
  { id: 'calendar', label: 'Kalender', Icon: CalendarDays },
  { id: 'insights', label: 'Inzichten', Icon: Sparkles },
]
const MODE_LABEL: Record<string, string> = { work: 'Focus', break: 'Pauze', longBreak: 'Lange pauze' }

/**
 * Desktop: Focus-zijbalk links. Tabs, een timerkaart (als er geen vast timerpaneel is), instellingen
 * en terug naar Dash. Vervangt op desktop de zwevende onderbalk, de rode ✕ en de timerknop.
 */
export function FocusSidebar({ tab, inCourse, onTab, engine, started, showTimerCard, onOpenTimer, onSettings, onHome }: {
  tab: FocusTab
  inCourse: boolean
  onTab: (t: FocusTab) => void
  engine: any
  started: boolean
  showTimerCard: boolean
  onOpenTimer: () => void
  onSettings: () => void
  onHome?: () => void
}) {
  const { state, toggleRunning } = engine
  const courses = useFocusStore(s => s.courses)
  const course = courses.find(c => c.id === state.meta?.courseId)
  const sw = state.timerKind === 'stopwatch'

  return (
    <aside className="fx-side" aria-label="Focus">
      <div className="fx-side__brand"><Timer size={18} /> Focus</div>
      <nav className="fx-side__nav">
        {TABS.map(t => {
          const active = tab === t.id && (!inCourse || t.id === 'courses')
          return (
            <button key={t.id} type="button" className={`fx-side__item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onTab(t.id)}>
              <t.Icon size={18} strokeWidth={active ? 2.4 : 2} /> {t.label}
            </button>
          )
        })}
      </nav>

      {showTimerCard && (
        <div className={`fx-side__timer${state.running ? ' is-running' : ''}`} style={{ '--tc': course?.color || 'var(--fx-orange)' } as React.CSSProperties}>
          <span className="fx-overline">{sw ? 'Stopwatch' : MODE_LABEL[state.mode]}{started && !state.running ? ' · gepauzeerd' : ''}</span>
          <span className="fx-side__time tnum">{fmtClock(state.seconds)}</span>
          <span className="fx-side__course">{course ? course.name : 'Zonder vak'}</span>
          <div className="fx-side__timer-btns">
            <button type="button" className="fx-side__play" onClick={toggleRunning} aria-label={state.running ? 'Pauzeren' : 'Starten'}>
              {state.running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>
            <button type="button" className="fx-side__open" onClick={onOpenTimer}>Open timer</button>
          </div>
        </div>
      )}

      <div className="fx-side__foot">
        <button type="button" className="fx-side__item" onClick={onSettings}><Settings size={18} /> Instellingen</button>
        {onHome && <button type="button" className="fx-side__item is-home" onClick={onHome}><X size={18} strokeWidth={2.6} /> Terug naar Dash</button>}
      </div>
    </aside>
  )
}
