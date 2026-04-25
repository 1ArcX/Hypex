import React, { useState, useMemo, useEffect } from 'react'
import ReactDOM from 'react-dom'
import TasksWidget from '../components/TasksWidget'
import { useIsDesktop } from '../hooks/useIsDesktop'

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10, textAlign: 'center' }}>
      <span style={{ fontSize: 40 }}>{s.icon}</span>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{s.title}</p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{s.sub}</p>
      {filter === 'alles' && (
        <button onClick={() => onNew?.()} style={{ marginTop: 8, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--accent)', borderRadius: 10, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + Taak toevoegen
        </button>
      )}
    </div>
  )
}

const FILTERS = [
  { id: 'alles',     label: 'Alles'    },
  { id: 'vandaag',   label: 'Vandaag'  },
  { id: 'morgen',    label: 'Morgen'   },
  { id: 'week',      label: 'Week'     },
  { id: 'urgent',    label: 'Urgent'   },
  { id: 'telaat',    label: 'Te laat'  },
  { id: 'ongepland', label: 'Ongepland' },
]

function todayStr() { return new Date().toISOString().slice(0, 10) }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
function weekEndStr() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

const SWIPE_HINT_KEY = 'swipe_hint_seen_v1'

export default function TakenPage({
  tasks, subjects,
  onAdd, onEdit, onDelete, onToggle, onViewDetail, onNew, onMoveToGroup, onReorder, onReorderGroups, groupOrder,
  highlightFilter, onClearHighlight,
}) {
  const isDesktop = useIsDesktop()
  const [filter, setFilter] = useState('alles')
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
    const base = {
      alles:     tasks.filter(t => !t.completed).length,
      vandaag:   tasks.filter(t => !t.completed && t.date === ts).length,
      morgen:    tasks.filter(t => !t.completed && t.date === tom).length,
      week:      tasks.filter(t => !t.completed && t.date && t.date >= ts && t.date <= wEnd).length,
      urgent:    tasks.filter(t => !t.completed && (t.priority ?? 2) === 1).length,
      telaat:    tasks.filter(t => !t.completed && t.date && t.date < ts).length,
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
      case 'vandaag':   return tasks.filter(t => t.date === ts)
      case 'morgen':    return tasks.filter(t => t.date === tom)
      case 'week':      return tasks.filter(t => t.date && t.date >= ts && t.date <= wEnd)
      case 'urgent':    return tasks.filter(t => (t.priority ?? 2) === 1)
      case 'telaat':    return tasks.filter(t => t.date && t.date < ts)
      case 'ongepland': return tasks.filter(t => !t.date)
      default:          return tasks
    }
  }, [tasks, filter, ts, tom, wEnd])

  useEffect(() => {
    if (!highlightFilter) return
    // Navigeer naar de juiste filter
    const filterMap = { urgent: 'urgent', telaat: 'telaat', open: 'alles' }
    setFilter(filterMap[highlightFilter] ?? 'alles')
    // Bepaal welke taken gehighlight worden
    const matchFn = {
      urgent: t => !t.completed && (t.priority ?? 2) === 1,
      telaat: t => !t.completed && t.date && t.date < ts,
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
      {/* Filter chips */}
      <div style={{
        flexShrink: 0,
        padding: '16px 16px 0',
        overflowX: 'auto',
        display: 'flex',
        gap: 6,
        scrollbarWidth: 'none',
        borderTop: '2px solid rgba(0,255,209,0.2)',
      }}>
        {FILTERS.map(f => {
          const active = filter === f.id
          const cnt = counts[f.id]
          const isUrgentChip = f.id === 'urgent'
          const urgentHasItems = isUrgentChip && cnt > 0
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 20,
                border: active
                  ? isUrgentChip ? '1px solid rgba(255,60,60,0.55)' : '1px solid color-mix(in srgb, var(--accent) 50%, transparent)'
                  : urgentHasItems ? '1px solid rgba(255,60,60,0.3)' : '1px solid rgba(255,255,255,0.1)',
                background: active
                  ? isUrgentChip ? 'rgba(255,50,50,0.15)' : 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : urgentHasItems ? 'rgba(255,50,50,0.06)' : 'rgba(255,255,255,0.03)',
                color: active
                  ? isUrgentChip ? '#ff5555' : 'var(--accent)'
                  : urgentHasItems ? 'rgba(255,80,80,0.75)' : 'var(--text-3)',
                fontSize: 12,
                fontWeight: active || urgentHasItems ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              {isUrgentChip ? '🔥 ' : ''}{f.label}
              {cnt > 0 && (
                <span style={{
                  fontSize: 10,
                  background: active
                    ? isUrgentChip ? 'rgba(255,50,50,0.25)' : 'color-mix(in srgb, var(--accent) 25%, transparent)'
                    : urgentHasItems ? 'rgba(255,50,50,0.12)' : 'rgba(255,255,255,0.08)',
                  color: active
                    ? isUrgentChip ? '#ff5555' : 'var(--accent)'
                    : urgentHasItems ? 'rgba(255,80,80,0.8)' : 'var(--text-3)',
                  borderRadius: 10,
                  padding: '1px 5px',
                  fontWeight: 700,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
        {/* Groep chips */}
        {groups.map(g => {
          const id = `group:${g}`
          const active = filter === id
          const cnt = counts[id]
          return (
            <button
              key={id}
              onClick={() => setFilter(active ? 'alles' : id)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 20,
                border: active
                  ? '1px solid rgba(250,204,21,0.5)'
                  : '1px solid rgba(250,204,21,0.2)',
                background: active
                  ? 'rgba(250,204,21,0.12)'
                  : 'rgba(250,204,21,0.04)',
                color: active ? '#FACC15' : 'rgba(250,204,21,0.5)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              {g}
              {cnt > 0 && (
                <span style={{
                  fontSize: 10,
                  background: active ? 'rgba(250,204,21,0.25)' : 'rgba(250,204,21,0.08)',
                  color: active ? '#FACC15' : 'rgba(250,204,21,0.5)',
                  borderRadius: 10,
                  padding: '1px 5px',
                  fontWeight: 600,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflow: 'hidden', overflowY: 'auto', padding: '12px 16px 100px' }}>
        {filtered.length === 0 && !filter.startsWith('group:') ? (
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
            highlightedIds={highlightedIds}
          />
        )}
      </div>

      {undoTask && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: isDesktop ? 24 : 90, left: isDesktop ? 'calc(220px + 50%)' : '50%', transform: 'translateX(-50%)',
          zIndex: 9998, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'sheetUp 0.3s ease', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>✓ Afgerond</span>
          <button
            onClick={() => { onToggle({ ...undoTask, completed: true }); setUndoTask(null); clearTimeout(undoTimerRef.current) }}
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Ongedaan maken
          </button>
        </div>,
        document.body
      )}

      {/* FAB — mobiel only */}
      {!isDesktop && ReactDOM.createPortal(
        <button
          onClick={() => onNew?.()}
          style={{
            position: 'fixed', bottom: undoTask ? 148 : 88, right: 18,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent)', color: '#000',
            border: 'none', cursor: 'pointer', zIndex: 9996,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, lineHeight: 1,
            boxShadow: '0 4px 18px color-mix(in srgb, var(--accent) 45%, transparent)',
            transition: 'bottom 0.2s ease',
          }}
          aria-label="Nieuwe taak"
        >+</button>,
        document.body
      )}

      {/* Swipe-hint overlay — éénmalig */}
      {showSwipeHint && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9997, display: 'flex', alignItems: 'center', gap: 16,
          background: 'rgba(15,15,15,0.92)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 18px',
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
