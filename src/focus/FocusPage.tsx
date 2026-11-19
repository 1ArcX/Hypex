import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus, Settings, Timer } from 'lucide-react'
import './focus.css'
import { useFocusStore } from './store/focusStore'
import { usePomodoroEngine } from '../components/pomodoro/usePomodoroEngine'
import { Sheet, useFxTheme, FxLayoutContext, FX_DESKTOP, FX_PANEL } from './components/ui'
import { FilterTabs } from '../recap/components/ui'
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
// Zelfde pill-tabs als Taken/Recap (gedeelde FilterTabs)
const TABS: { value: FocusTab; label: string }[] = [
  { value: 'home', label: 'Overzicht' },
  { value: 'courses', label: 'Vakken' },
  { value: 'calendar', label: 'Kalender' },
  { value: 'insights', label: 'Inzichten' },
]

type SheetState =
  | { kind: 'timer' } | { kind: 'settings' }
  | { kind: 'session'; id: string | null; courseId?: string | null }
  | { kind: 'course'; id: string | null }
  | { kind: 'reminders'; id: string } | { kind: 'grades'; id: string }
  | null

export default function FocusPage({ userId, onModeChange, onFocusModeChange, onPomodoroActive, seedTask, onSeedConsumed }: {
  userId: string
  onHome?: () => void // niet meer nodig: Focus gebruikt nu de gewone Dash-navigatie
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
  // Breedte van het Focus-vlak → telefoonindeling, desktop (kolommen) of desktop + vast timerpaneel
  const rootRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const desktop = width >= FX_DESKTOP
  const panel = width >= FX_PANEL

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
  // "Start focus" vanuit een taak → timer openen (met vast paneel staat de timer al in beeld)
  useEffect(() => { if (seedTask && !panel) setSheet({ kind: 'timer' }) }, [seedTask]) // eslint-disable-line react-hooks/exhaustive-deps
  // Breed genoeg geworden voor het paneel → losse timer dicht
  useEffect(() => { if (panel) setSheet(s => (s?.kind === 'timer' ? null : s)) }, [panel])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [tab, openCourse])
  // Sessie of pauze klaar → timerscherm dicht, zodat de afronding (★, beloning, pauze voorbij) zichtbaar is
  useEffect(() => { if (popup) setSheet(s => (s?.kind === 'timer' ? null : s)) }, [popup])

  const go = (t: FocusTab) => { setOpenCourse(null); setTab(t) }
  const openTimer = () => { if (!panel) setSheet({ kind: 'timer' }) }
  const studyCourse = (id: string) => { engine.setMeta({ courseId: id, topicId: null }); openTimer() }
  const openSession = (id: string) => setSheet({ kind: 'session', id })

  const started = state.timerKind === 'stopwatch' ? state.seconds > 0 || state.running : state.running || state.seconds < state.workMins * 60 && state.mode === 'work'

  const newCourse = () => setSheet({ kind: 'course', id: null })
  const newSession = () => setSheet({ kind: 'session', id: null })

  let view
  if (openCourse) {
    view = <CourseDetail courseId={openCourse} onBack={() => setOpenCourse(null)}
      onEdit={() => setSheet({ kind: 'course', id: openCourse })}
      onReminders={() => setSheet({ kind: 'reminders', id: openCourse })}
      onGrades={() => setSheet({ kind: 'grades', id: openCourse })}
      onStudy={() => studyCourse(openCourse)} onOpenSession={openSession} />
  } else if (tab === 'courses') {
    view = <CoursesView onOpenCourse={setOpenCourse} onNewCourse={newCourse} onShowInsights={() => go('insights')} />
  } else if (tab === 'calendar') {
    view = <CalendarView onOpenSession={openSession} />
  } else if (tab === 'insights') {
    view = <InsightsView />
  } else {
    view = <HomeView userId={userId} onAddSession={newSession} onStartTimer={openTimer} onOpenSession={openSession} />
  }

  return (
    <FxLayoutContext.Provider value={{ desktop, panel }}>
    <div ref={rootRef} className={`fx${desktop ? ' is-desktop' : ''}${panel ? ' has-panel' : ''}`} data-theme={theme}>
      <div className="fx-scroll" ref={scrollRef}>
        {/* Kop zoals Taken/Statistieken: serif-titel, acties rechts, pill-tabs eronder */}
        <header className="fx-head">
          <div className="fx-head-row">
            <h1 className="t-page hide-mobile">Focus</h1>
            <div className="fx-head-actions">
              {!panel && (
                <button type="button" className={`fx-timerbtn${state.running ? ' is-running' : started ? ' is-paused' : ''}`} onClick={() => setSheet({ kind: 'timer' })}
                  aria-label={started ? `Timer ${fmtClock(state.seconds)}, openen` : 'Timer openen'}>
                  <Timer size={15} aria-hidden="true" />
                  {started ? <span className="tnum">{fmtClock(state.seconds)}</span> : 'Timer'}
                </button>
              )}
              <button type="button" className="fx-headicon" onClick={() => setSheet({ kind: 'settings' })} aria-label="Focus-instellingen" title="Instellingen">
                <Settings size={16} />
              </button>
              {tab === 'courses' && !openCourse
                ? <button type="button" className="btn-primary" onClick={newCourse}><Plus size={15} aria-hidden="true" /> Vak</button>
                : <button type="button" className="btn-primary" onClick={newSession}><Plus size={15} aria-hidden="true" /> Sessie</button>}
            </div>
          </div>
          <FilterTabs items={TABS} value={openCourse ? 'courses' : tab} onChange={(v: FocusTab) => go(v)} label="Focus-weergave" />
        </header>
        {needsMigration && loaded && (
          <div className="fx-page" style={{ paddingBottom: 0 }}>
            <p className="fx-banner" style={{ marginBottom: 0 }}>
              <b>Database nog niet bijgewerkt.</b> Voer <code>supabase/migrations/add_focus_app.sql</code> uit in de Supabase SQL Editor om vakken, onderwerpen, toetsdatums en scores op te slaan.
            </p>
          </div>
        )}
        {view}
      </div>

      {panel && <TimerSheet engine={engine} variant="panel" />}

      {sheet?.kind === 'timer' && !panel && <TimerSheet engine={engine} onClose={() => setSheet(null)} />}
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
    </FxLayoutContext.Provider>
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
