import React, { useState, useMemo } from 'react'
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

  const ts = todayStr()
  const tom = tomorrowStr()
  const wEnd = weekEndStr()

  const counts = useMemo(() => ({
    alles:     tasks.filter(t => !t.completed).length,
    vandaag:   tasks.filter(t => !t.completed && t.date === ts).length,
    morgen:    tasks.filter(t => !t.completed && t.date === tom).length,
    week:      tasks.filter(t => !t.completed && t.date && t.date >= ts && t.date <= wEnd).length,
    urgent:    tasks.filter(t => !t.completed && (t.priority ?? 2) === 1).length,
    ongepland: tasks.filter(t => !t.completed && !t.date).length,
  }), [tasks, ts, tom, wEnd])

  const filtered = useMemo(() => {
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
      }}>
        {FILTERS.map(f => {
          const active = filter === f.id
          const cnt = counts[f.id]
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 20,
                border: active
                  ? '1px solid color-mix(in srgb, var(--accent) 50%, transparent)'
                  : '1px solid rgba(255,255,255,0.1)',
                background: active
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'rgba(255,255,255,0.03)',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              {cnt > 0 && (
                <span style={{
                  fontSize: 10,
                  background: active ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'rgba(255,255,255,0.08)',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
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
          onToggle={onToggle}
          onViewDetail={onViewDetail}
          onNew={onNew}
        />
      </div>
    </div>
  )
}
