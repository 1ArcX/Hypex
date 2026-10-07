import { useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarDays, Home, Sparkles, Timer, X } from 'lucide-react'
import './focus.css'
import { useFocusStore } from './store/focusStore'
import { usePomodoroEngine } from '../components/pomodoro/usePomodoroEngine'
import { Sheet, useFxTheme } from './components/ui'
import { HomeView } from './views/HomeView'
import { CoursesView } from './views/CoursesView'
import { CourseDetail } from './views/CourseDetail'
import { CalendarView } from './views/CalendarView'
import { InsightsView } from './views/InsightsView'
import { TimerSheet, fmtClock } from './views/TimerSheet'
import { SessionDone } from './sheets/SessionDone'
import { SessionEditor } from './sheets/SessionEditor'
import { CourseEditor } from './sheets/CourseEditor'
import { RemindersSheet } from './sheets/RemindersSheet'
import { GradeCalculator } from './sheets/GradeCalculator'
import { FocusSettings } from './sheets/FocusSettings'
import type { FocusTab } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABS: { id: FocusTab; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'courses', label: 'Vakken', Icon: BookOpen },
  { id: 'calendar', label: 'Kalender', Icon: CalendarDays },
  { id: 'insights', label: 'Inzichten', Icon: Sparkles },
]

type SheetState =
  | { kind: 'timer' } | { kind: 'settings' }
  | { kind: 'session'; id: string | null; courseId?: string | null }
  | { kind: 'course'; id: string | null }
  | { kind: 'reminders'; id: string } | { kind: 'grades'; id: string }
  | null

export default function FocusPage({ userId, onModeChange, onFocusModeChange, onPomodoroActive, seedTask, onSeedConsumed, onHome }: {
  userId: string
  onHome?: () => void
  onModeChange?: (isBreak: boolean) => void
  onFocusModeChange?: (on: boolean) => void
  onPomodoroActive?: (on: boolean) => void
  seedTask?: { id: string; title: string } | null
  onSeedConsumed?: () => void
}) {
  const theme = useFxTheme()
  const load = useFocusStore(s => s.load)
  const loaded = useFocusStore(s => s.loaded)
  const needsMigration = useFocusStore(s => s.needsMigration)
  const tab = useFocusStore(s => s.tab)
  const setTab = useFocusStore(s => s.setTab)
  const [openCourse, setOpenCourse] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const engine: any = usePomodoroEngine({ userId, onModeChange, onFocusModeChange, onPomodoroActive, noFocusOverlay: true, seedTask, onSeedConsumed } as any)
  const { state, popup } = engine

  useEffect(() => { if (userId) load(userId) }, [userId, load])
  // Terug naar de app → verversen (ander apparaat kan sessies hebben toegevoegd)
  useEffect(() => {
    let last = Date.now()
    const on = () => { if (document.visibilityState === 'visible' && Date.now() - last > 30000) { last = Date.now(); load(userId, true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [userId, load])
  // "Start focus" vanuit een taak → timer openen
  useEffect(() => { if (seedTask) setSheet({ kind: 'timer' }) }, [seedTask])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [tab, openCourse])
  // Sessie of pauze klaar → timerscherm dicht, zodat de afronding (★, beloning, pauze voorbij) zichtbaar is
  useEffect(() => { if (popup) setSheet(s => (s?.kind === 'timer' ? null : s)) }, [popup])

  const go = (t: FocusTab) => { setOpenCourse(null); setTab(t) }
  const studyCourse = (id: string) => { engine.setMeta({ courseId: id, topicId: null }); setSheet({ kind: 'timer' }) }
  const openSession = (id: string) => setSheet({ kind: 'session', id })

  const started = state.timerKind === 'stopwatch' ? state.seconds > 0 || state.running : state.running || state.seconds < state.workMins * 60 && state.mode === 'work'

  let view
  if (openCourse) {
    view = <CourseDetail courseId={openCourse} onBack={() => setOpenCourse(null)}
      onEdit={() => setSheet({ kind: 'course', id: openCourse })}
      onReminders={() => setSheet({ kind: 'reminders', id: openCourse })}
      onGrades={() => setSheet({ kind: 'grades', id: openCourse })}
      onStudy={() => studyCourse(openCourse)} onOpenSession={openSession} />
  } else if (tab === 'courses') {
    view = <CoursesView onOpenCourse={setOpenCourse} onNewCourse={() => setSheet({ kind: 'course', id: null })}
      onAddSession={() => setSheet({ kind: 'session', id: null })} onShowInsights={() => go('insights')} />
  } else if (tab === 'calendar') {
    view = <CalendarView onOpenSession={openSession} />
  } else if (tab === 'insights') {
    view = <InsightsView />
  } else {
    view = <HomeView userId={userId} onSettings={() => setSheet({ kind: 'settings' })} onAddSession={() => setSheet({ kind: 'session', id: null })}
      onNewCourse={() => setSheet({ kind: 'course', id: null })} onOpenSession={openSession} />
  }

  return (
    <div className="fx" data-theme={theme}>
      <div className="fx-scroll" ref={scrollRef}>
        {needsMigration && loaded && (
          <div className="fx-page" style={{ paddingBottom: 0 }}>
            <p className="fx-banner" style={{ marginBottom: 0 }}>
              <b>Database nog niet bijgewerkt.</b> Voer <code>supabase/migrations/add_focus_app.sql</code> uit in de Supabase SQL Editor om vakken, onderwerpen, toetsdatums en scores op te slaan.
            </p>
          </div>
        )}
        {view}
      </div>

      <div className="fx-tabbar-wrap">
        <nav className="fx-tabbar" aria-label="Focus">
          {TABS.map(t => {
            const active = tab === t.id && (!openCourse || t.id === 'courses')
            return (
              <button key={t.id} type="button" className={`fx-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(t.id)}>
                <t.Icon fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 1.6 : 2} />
                {t.label}
              </button>
            )
          })}
        </nav>
        {onHome && (
          <button type="button" className="fx-home" onClick={onHome} aria-label="Terug naar Home" title="Terug naar Home">
            <X strokeWidth={2.6} />
          </button>
        )}
        <button type="button" className={`fx-fab${state.running ? ' is-running' : started ? ' is-paused' : ''}`} onClick={() => setSheet({ kind: 'timer' })}
          aria-label={started ? `Timer ${fmtClock(state.seconds)}, openen` : 'Timer starten'}>
          <Timer strokeWidth={2.4} />
          {started && <span className="tnum">{fmtClock(state.seconds)}</span>}
        </button>
      </div>

      {sheet?.kind === 'timer' && <TimerSheet engine={engine} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'settings' && <FocusSettings engine={engine} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'session' && <SessionEditor sessionId={sheet.id} presetCourseId={sheet.courseId || openCourse} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'course' && <CourseEditor courseId={sheet.id} onClose={() => setSheet(null)} onCreated={id => { setTab('courses'); setOpenCourse(id) }} />}
      {sheet?.kind === 'reminders' && <RemindersSheet courseId={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'grades' && <GradeCalculator courseId={sheet.id} onClose={() => setSheet(null)} />}

      {popup && (popup.reward
        ? <SessionDone key={popup.reward?.after?.todayMins + String(popup.stopwatch)} popup={popup}
            onStartNext={() => { engine.startAfterPopup() }} onClose={() => engine.skipPopup()} />
        : <BreakDone popup={popup as any} onStart={engine.startAfterPopup} onSkip={engine.skipPopup} />)}
    </div>
  )
}

/** Einde van een pauze: simpele vraag of je weer gaat focussen */
function BreakDone({ popup, onStart, onSkip }: { popup: { nextMode: string }; onStart: () => void; onSkip: () => void }) {
  return (
    <Sheet onClose={onSkip} label="Pauze voorbij">
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 6px' }}>Pauze voorbij</h3>
        <p className="fx-muted" style={{ margin: '0 0 20px' }}>Klaar voor de volgende focussessie?</p>
        <button type="button" className="fx-btn is-primary is-block" onClick={onStart}>{popup.nextMode === 'work' ? 'Start focus' : 'Start'}</button>
        <button type="button" className="fx-btn is-block" style={{ marginTop: 8, background: 'none' }} onClick={onSkip}>Later</button>
      </div>
    </Sheet>
  )
}
