import React from 'react'
import { Flame, Plus, Repeat, Clock } from 'lucide-react'
import {
  todayISO, recurrenceLabel, isDueToday, isDoneToday, isStreakActive,
} from '../utils/recurrence'

const NL_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function CheckCircle({ done, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `2px solid ${done ? color : 'rgba(255,255,255,0.25)'}`,
        background: done ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.18s',
      }}>
        {done && <span style={{ fontSize: 14, color: '#000', fontWeight: 800, lineHeight: 1 }}>✓</span>}
      </div>
    </button>
  )
}

function RoutineRow({ task, today, onToggle, onOpen }) {
  const done = isDoneToday(task, today)
  const active = isStreakActive(task, today)
  const streak = task.streak || 0
  const accent = task.color || 'var(--accent)'
  return (
    <div onClick={() => onOpen(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 14, cursor: 'pointer', marginBottom: 6,
        background: done ? 'rgba(255,255,255,0.02)' : 'color-mix(in srgb, var(--accent) 5%, transparent)',
        border: `1px solid ${done ? 'rgba(255,255,255,0.06)' : 'color-mix(in srgb, var(--accent) 22%, transparent)'}`,
        opacity: done ? 0.6 : 1, transition: 'opacity 0.18s, background 0.18s',
      }}>
      <CheckCircle done={done} color={accent} onClick={(e) => { e.stopPropagation(); onToggle(task) }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Repeat size={10} /> {recurrenceLabel(task.recurrence, task.recurrence_days)}
          {(task.start_time || task.time) ? <> · <Clock size={10} /> {task.start_time || task.time}</> : null}
        </p>
      </div>
      {streak > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
          padding: '4px 9px', borderRadius: 20,
          background: active ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${active ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          <Flame size={13} style={{ color: active ? '#FB923C' : 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#FB923C' : 'rgba(255,255,255,0.3)' }}>{streak}</span>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, subjects, today, onToggle, onOpen }) {
  const subject = subjects.find(s => s.id === task.subject_id)
  const isUrgent = (task.priority ?? 2) === 1
  const accent = isUrgent ? '#FF6B6B' : (task.color || 'var(--accent)')
  return (
    <div onClick={() => onOpen(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 14, cursor: 'pointer', marginBottom: 6,
        background: isUrgent ? 'rgba(255,80,80,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isUrgent ? 'rgba(255,80,80,0.25)' : 'rgba(255,255,255,0.07)'}`,
      }}>
      <CheckCircle done={false} color={accent} onClick={(e) => { e.stopPropagation(); onToggle(task) }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: isUrgent ? 600 : 500, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title}
        </p>
        {(task.start_time || task.time || subject) && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
            {(task.start_time || task.time) ? `${task.start_time || task.time}${task.end_time ? `–${task.end_time}` : ''}` : ''}
            {(task.start_time || task.time) && subject ? ' · ' : ''}
            {subject ? subject.name : ''}
          </p>
        )}
      </div>
      {isUrgent && (
        <span style={{ fontSize: 10, fontWeight: 700, color: '#ff5555', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>
          🔥 URGENT
        </span>
      )}
    </div>
  )
}

function SectionLabel({ children, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 2px 8px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{children}</span>
      {count != null && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{count}</span>}
    </div>
  )
}

export default function TodayView({ tasks, subjects = [], onToggleRoutine, onToggleTask, onOpen, onNew, onShowOverdue }) {
  const today = todayISO()
  const d = new Date()
  const dateLabel = `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`

  // Routines: herhalende taken die vandaag op de planning staan of vandaag al gedaan zijn
  const routines = tasks
    .filter(t => t.recurrence && (isDueToday(t, today) || isDoneToday(t, today)))
    .sort((a, b) => {
      const da = isDoneToday(a, today) ? 1 : 0
      const db = isDoneToday(b, today) ? 1 : 0
      if (da !== db) return da - db
      return (b.streak || 0) - (a.streak || 0)
    })

  // Eenmalige taken van vandaag (nog niet afgerond, geen herhaling)
  const todayTasks = tasks
    .filter(t => !t.recurrence && !t.completed && t.date === today)
    .sort((a, b) => {
      const pa = a.priority ?? 2, pb = b.priority ?? 2
      if (pa !== pb) return pa - pb
      return (a.start_time || a.time || '99:99').localeCompare(b.start_time || b.time || '99:99')
    })

  const overdueCount = tasks.filter(t => !t.recurrence && !t.completed && t.date && t.date < today).length
  const routinesDone = routines.filter(t => isDoneToday(t, today)).length
  const isEmpty = routines.length === 0 && todayTasks.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Datumkop */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>Vandaag</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '3px 0 0', textTransform: 'capitalize' }}>
          {dateLabel}
          {routines.length > 0 ? ` · ${routinesDone}/${routines.length} routines` : ''}
        </p>
      </div>

      {/* Te laat — subtiele melding */}
      {overdueCount > 0 && (
        <button onClick={onShowOverdue}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.22)' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13, color: '#ff8080', fontWeight: 600 }}>
            {overdueCount} {overdueCount === 1 ? 'taak staat' : 'taken staan'} te laat
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,128,128,0.5)' }}>→</span>
        </button>
      )}

      {/* Routines */}
      {routines.length > 0 && (
        <div>
          <SectionLabel count={`${routinesDone}/${routines.length}`}>Routines</SectionLabel>
          {routines.map(t => (
            <RoutineRow key={t.id} task={t} today={today} onToggle={onToggleRoutine} onOpen={onOpen} />
          ))}
        </div>
      )}

      {/* Taken vandaag */}
      {todayTasks.length > 0 && (
        <div>
          <SectionLabel count={todayTasks.length}>Taken vandaag</SectionLabel>
          {todayTasks.map(t => (
            <TaskRow key={t.id} task={t} subjects={subjects} today={today} onToggle={onToggleTask} onOpen={onOpen} />
          ))}
        </div>
      )}

      {/* Lege staat */}
      {isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 50, gap: 10, textAlign: 'center' }}>
          <span style={{ fontSize: 44 }}>🌤️</span>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Niets voor vandaag</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: 240 }}>
            Geen routines of taken gepland. Voeg er een toe of geniet van je vrije dag.
          </p>
          <button onClick={onNew}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--accent)', borderRadius: 12, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Nieuwe taak
          </button>
        </div>
      )}

      {/* Alles-gedaan vlag wanneer er routines waren maar alles af is */}
      {!isEmpty && todayTasks.length === 0 && routines.length > 0 && routinesDone === routines.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Alle routines afgevinkt vandaag — sterk!</span>
        </div>
      )}
    </div>
  )
}
