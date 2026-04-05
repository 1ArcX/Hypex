import React, { useState, useMemo } from 'react'
import ReactDOM from 'react-dom'
import TasksWidget from '../components/TasksWidget'

const FILTERS = [
  { id: 'alles',     label: 'Alles'    },
  { id: 'vandaag',   label: 'Vandaag'  },
  { id: 'morgen',    label: 'Morgen'   },
  { id: 'week',      label: 'Week'     },
  { id: 'urgent',    label: 'Urgent'   },
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

export default function TakenPage({
  tasks, subjects,
  onAdd, onEdit, onDelete, onToggle, onViewDetail, onNew,
}) {
  const [filter, setFilter] = useState('alles')
  const [undoTask, setUndoTask] = useState(null)
  const undoTimerRef = React.useRef(null)

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
      case 'ongepland': return tasks.filter(t => !t.date)
      default:          return tasks
    }
  }, [tasks, filter, ts, tom, wEnd])

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
        <TasksWidget
          tasks={filtered}
          subjects={subjects}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={handleToggleWithUndo}
          onViewDetail={onViewDetail}
          onNew={onNew}
        />
      </div>

      {undoTask && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'sheetUp 0.3s ease', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>✓ Afgerond</span>
          <button
            onClick={() => { onToggle(undoTask); setUndoTask(null); clearTimeout(undoTimerRef.current) }}
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Ongedaan maken
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
