import React, { useState, useMemo, useEffect } from 'react'
import { taskOnDay, taskLastDate } from '../utils/taskStatus'
import ReactDOM from 'react-dom'
import TasksWidget from '../components/TasksWidget'
import TodayView from '../components/TodayView'
import TaskOverview from '../components/tasks/TaskOverview'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { Plus, CheckCircle2 } from 'lucide-react'
import { isDueToday, isDoneToday, appliesOn, todayISO, toISO } from '../utils/recurrence'
import { FilterTabs, EmptyState as UiEmptyState } from '../components/ui'

const EMPTY_STATE = {
  alles:     { icon: '🎉', title: 'Alles gedaan', sub: 'Geen openstaande taken.' },
  vandaag:   { icon: '✅', title: 'Vrije dag', sub: 'Niets gepland voor vandaag.' },
  morgen:    { icon: '😌', title: 'Morgen vrij', sub: 'Nog niets ingepland voor morgen.' },
  week:      { icon: '📅', title: 'Rustige week', sub: 'Geen taken de komende 7 dagen.' },
  urgent:    { icon: '🟢', title: 'Niets urgent', sub: 'Alles onder controle.' },
  telaat:    { icon: '🎊', title: 'Niets achterstallig', sub: 'Geen verlopen taken.' },
  ongepland: { icon: '📋', title: 'Alles ingepland', sub: 'Elke taak heeft een datum.' },
}

function EmptyState({ filter, onNew }) {
  const s = EMPTY_STATE[filter] || EMPTY_STATE.alles
  return (
    <UiEmptyState icon={CheckCircle2} title={`${s.icon} ${s.title}`} text={s.sub}
      style={{ paddingTop: 48 }}
      action={filter === 'alles' && <button onClick={() => onNew?.()} className="btn-primary"><Plus size={15} aria-hidden="true" /> Taak toevoegen</button>} />
  )
}

// Overzicht (alle taken per dag, vandaag gemarkeerd) eerst; daarna de losse filters
const FILTERS = [
  { id: 'overzicht', label: 'Overzicht' },
  { id: 'vandaag',   label: 'Vandaag'  },
  { id: 'morgen',    label: 'Morgen'   },
  { id: 'week',      label: 'Week'     },
  { id: 'alles',     label: 'Alles'    },
  { id: 'telaat',    label: 'Te laat',  tone: 'danger' },
  { id: 'urgent',    label: 'Urgent',   tone: 'danger' },
  { id: 'ongepland', label: 'Ongepland' },
]

// Lokale datums (toISOString is UTC en gaf tussen 00:00–02:00 de datum van gisteren)
function todayStr() { return todayISO() }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return toISO(d)
}
function weekEndStr() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return toISO(d)
}

const SWIPE_HINT_KEY = 'swipe_hint_seen_v1'

export default function TakenPage({
  tasks, subjects,
  onAdd, onEdit, onDelete, onToggle, onViewDetail, onNew, onMoveToGroup, onReorder, onReorderGroups, groupOrder,
  highlightFilter, onClearHighlight, hideFab,
}) {
  const isDesktop = useIsDesktop()
  const [filter, setFilter] = useState('overzicht')
  const [undoTask, setUndoTask] = useState(null)
  const undoTimerRef = React.useRef(null)
  const [highlightedIds, setHighlightedIds] = useState(new Set())
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  // Éénmalige swipe-hint tonen als er taken zijn
  useEffect(() => {
    if (isDesktop) return
    if (localStorage.getItem(SWIPE_HINT_KEY)) return
    const open = tasks.filter(t => !t.completed)
    if (open.length === 0) return
    const timer = setTimeout(() => {
      setShowSwipeHint(true)
      setTimeout(() => {
        setShowSwipeHint(false)
        localStorage.setItem(SWIPE_HINT_KEY, '1')
      }, 2800)
    }, 600)
    return () => clearTimeout(timer)
  }, [isDesktop, tasks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleWithUndo = (task) => {
    onToggle(task)
    if (!task.completed) {
      clearTimeout(undoTimerRef.current)
      setUndoTask(task)
      undoTimerRef.current = setTimeout(() => setUndoTask(null), 5000)
    } else {
      setUndoTask(null)
    }
  }

  const ts = todayStr()
  const tom = tomorrowStr()
  const wEnd = weekEndStr()

  const groups = useMemo(() => [...new Set(tasks.filter(t => t.group_name).map(t => t.group_name))], [tasks])

  const counts = useMemo(() => {
    // Vandaag = openstaande routines van vandaag + taken van vandaag + te-late taken
    // (die worden meegenomen naar vandaag)
    const openRoutines = tasks.filter(t => t.recurrence && isDueToday(t, ts) && !isDoneToday(t, ts)).length
    const todayOneoff = tasks.filter(t => !t.recurrence && !t.completed && taskOnDay(t, ts)).length
    const overdueOneoff = tasks.filter(t => !t.recurrence && !t.completed && t.date && taskLastDate(t) < ts).length
    const base = {
      // Overzicht: alles wat open staat met een datum (te laat, vandaag en later) + open routines van vandaag
      overzicht: openRoutines + tasks.filter(t => !t.recurrence && !t.completed && t.date).length,
      vandaag:   openRoutines + todayOneoff + overdueOneoff,
      alles:     tasks.filter(t => !t.completed).length,
      morgen:    tasks.filter(t => !t.recurrence && !t.completed && taskOnDay(t, tom)).length
                 + tasks.filter(t => t.recurrence && appliesOn(t, tom)).length,
      week:      tasks.filter(t => !t.completed && t.date && taskLastDate(t) >= ts && t.date <= wEnd).length,
      urgent:    tasks.filter(t => !t.completed && (t.priority ?? 2) === 1).length,
      telaat:    tasks.filter(t => !t.recurrence && !t.completed && t.date && taskLastDate(t) < ts).length,
      ongepland: tasks.filter(t => !t.completed && !t.date).length,
    }
    for (const g of groups) base[`group:${g}`] = tasks.filter(t => !t.completed && t.group_name === g).length
    return base
  }, [tasks, ts, tom, wEnd, groups])

  const filtered = useMemo(() => {
    if (filter.startsWith('group:')) {
      const g = filter.slice(6)
      return tasks.filter(t => t.group_name === g)
    }
    switch (filter) {
      case 'vandaag':   return tasks.filter(t => t.recurrence ? t.date === ts : taskOnDay(t, ts))
      case 'morgen':    return tasks.filter(t => t.recurrence ? t.date === tom : taskOnDay(t, tom))
      case 'week':      return tasks.filter(t => t.date && taskLastDate(t) >= ts && t.date <= wEnd)
      case 'urgent':    return tasks.filter(t => (t.priority ?? 2) === 1)
      case 'telaat':    return tasks.filter(t => !t.recurrence && t.date && taskLastDate(t) < ts)
      case 'ongepland': return tasks.filter(t => !t.date)
      default:          return tasks
    }
  }, [tasks, filter, ts, tom, wEnd])

  useEffect(() => {
    if (!highlightFilter) return
    // Navigeer naar de juiste filter
    const filterMap = { urgent: 'urgent', telaat: 'telaat', open: 'alles', vandaag: 'vandaag' }
    setFilter(filterMap[highlightFilter] ?? 'alles')
    // Bepaal welke taken gehighlight worden
    const matchFn = {
      urgent: t => !t.completed && (t.priority ?? 2) === 1,
      telaat: t => !t.completed && !t.recurrence && t.date && taskLastDate(t) < ts,
      vandaag: t => !t.completed && (t.recurrence ? t.date === ts : taskOnDay(t, ts)),
      open:   t => !t.completed,
    }[highlightFilter]
    if (matchFn) {
      const ids = new Set(tasks.filter(matchFn).map(t => t.id))
      setHighlightedIds(ids)
      const timer = setTimeout(() => { setHighlightedIds(new Set()); onClearHighlight?.() }, 1000)
      return () => clearTimeout(timer)
    }
    onClearHighlight?.()
  }, [highlightFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Kop + filters */}
      <div className={filter === 'overzicht' ? 'taken-head taken-head--wide' : 'taken-head'}>
        {isDesktop && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 className="t-page" style={{ margin: 0 }}>Taken</h1>
            <button className="btn-primary" onClick={() => onNew?.()}><Plus size={15} aria-hidden="true" /> Taak</button>
          </div>
        )}
        <FilterTabs
          label="Filter taken"
          wrap={isDesktop}
          value={filter}
          onChange={v => setFilter(v === filter && v.startsWith('group:') ? 'alles' : v)}
          items={[
            ...FILTERS.map(f => ({ value: f.id, label: f.label, count: counts[f.id] || undefined, tone: counts[f.id] ? f.tone : undefined })),
            ...groups.map(g => ({ value: `group:${g}`, label: g, count: counts[`group:${g}`] || undefined, tone: 'school' })),
          ]}
        />
      </div>

      {/* Task list */}
      <div className="taken-body">
        {filter === 'overzicht' ? (
          <TaskOverview
            tasks={tasks}
            subjects={subjects}
            onToggleRoutine={onToggle}
            onToggleTask={handleToggleWithUndo}
            onOpen={onViewDetail || onEdit}
            onNew={onNew}
          />
        ) : (filter === 'vandaag' || filter === 'morgen') ? (
          <TodayView
            tasks={tasks}
            subjects={subjects}
            dateOffset={filter === 'morgen' ? 1 : 0}
            onToggleRoutine={onToggle}
            onToggleTask={handleToggleWithUndo}
            onOpen={onViewDetail || onEdit}
            onNew={onNew}
          />
        ) : filtered.length === 0 && !filter.startsWith('group:') ? (
          <EmptyState filter={filter} onNew={onNew} />
        ) : (
          <TasksWidget
            tasks={filtered}
            subjects={subjects}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={handleToggleWithUndo}
            onViewDetail={onViewDetail}
            onNew={onNew}
            onMoveToGroup={onMoveToGroup}
            onReorder={onReorder}
            onReorderGroups={onReorderGroups}
            groupOrder={groupOrder}
            seamless={!isDesktop}
            hideHeader
            highlightedIds={highlightedIds}
          />
        )}
      </div>

      {undoTask && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: isDesktop ? 24 : 90, left: isDesktop ? 'calc(104px + 50%)' : '50%', transform: 'translateX(-50%)',
          zIndex: 9998, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--c-surface-solid)', border: '1px solid var(--c-border-strong)',
          borderRadius: 'var(--r-md)', padding: '10px 12px 10px 16px', boxShadow: 'var(--shadow-float)',
          animation: 'sheetUp 0.3s ease', whiteSpace: 'nowrap',
        }} role="status">
          <span style={{ fontSize: 13, color: 'var(--c-text)' }}>✓ Afgerond</span>
          <button
            onClick={() => { onToggle({ ...undoTask, completed: true }); setUndoTask(null); clearTimeout(undoTimerRef.current) }}
            className="btn-ghost" style={{ color: 'var(--accent)' }}
          >
            Ongedaan maken
          </button>
        </div>,
        document.body
      )}

      {/* Nieuwe taak — gecentreerde knop met label onderaan de Taken-tab */}
      {/* Verborgen zolang het Meer-menu open is (anders ligt hij over de sheet heen) */}
      {!isDesktop && !hideFab && ReactDOM.createPortal(
        <button
          onClick={() => onNew?.()}
          style={{
            position: 'fixed',
            bottom: undoTask ? 'calc(150px + env(safe-area-inset-bottom))' : 'calc(84px + env(safe-area-inset-bottom))',
            left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '13px 24px', borderRadius: 26,
            background: 'var(--accent)', color: 'var(--on-accent)',
            border: 'none', cursor: 'pointer', zIndex: 9996,
            fontSize: 15, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 50%, transparent)',
            transition: 'bottom 0.2s ease',
          }}
          aria-label="Nieuwe taak"
        >
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>+</span> Nieuwe taak
        </button>,
        document.body
      )}

      {/* Swipe-hint overlay — éénmalig */}
      {showSwipeHint && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9997, display: 'flex', alignItems: 'center', gap: 16,
          background: 'rgba(20,20,26,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: '10px 18px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'sheetUp 0.3s ease',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 13, color: '#FF6B6B', fontWeight: 600 }}>← verwijder</span>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: '#4ADE80', fontWeight: 600 }}>voltooi →</span>
        </div>,
        document.body
      )}
    </div>
  )
}
