import React from 'react'
import { Flag, Flame, Repeat, GripVertical, Trash2 } from 'lucide-react'
import { Pill, CheckButton } from '../ui'
import { taskCategory, categoryColor } from '../../utils/category'
import { shortDate, isMultiDay, spanLabel, taskOnDay } from '../../utils/taskStatus'
import { recurrenceLabel } from '../../utils/recurrence'

// Compacte taakrij (Hypex v2, mockup paneel 3): Wat? — Wanneer? — Status? — Actie?
//   [grip] ● Titel                         [pill] [⚑] [🗑] [☐]
//          subtitel (tijd · vak · te laat)
// Gedeeld door TodayView (Vandaag/Morgen) en TasksWidget (overige filters).

export default function TaskRow({
  task, today, subjectName,
  subtitle,              // optioneel: eigen subtitel i.p.v. de standaard
  late = false,          // te laat (datum < vandaag)
  done = false,          // afgevinkt (routines vandaag)
  preview = false,       // routine-preview (morgen): geen afvinkknop
  streakActive = false,  // routine-streak loopt nog
  showDate = true,
  onToggle, onOpen, onDelete,
  grip = false, dragProps, className, style,
}) {
  const urgent = (task.priority ?? 2) === 1
  const time = task.start_time || task.time
  const dot = done ? 'var(--c-success)' : categoryColor(taskCategory(task))
  const mins = task.duration_minutes
  const defaultSub = [
    isMultiDay(task) ? `${spanLabel(task)}${time ? ' elke dag' : ''}` : null,
    task.recurrence ? [recurrenceLabel(task.recurrence, task.recurrence_days), time].filter(Boolean).join(' · ') : (time ? `${time}${task.end_time ? `–${task.end_time}` : ''}` : null),
    subjectName,
    mins && !task.recurrence && time ? (mins >= 60 ? `${Math.floor(mins / 60)}u${mins % 60 ? String(mins % 60).padStart(2, '0') : ''}` : `${mins} min`) : null,
    task.due_date && task.due_date !== task.date ? `deadline ${shortDate(task.due_date, today)}` : null,
  ].filter(Boolean).join(' · ')
  const sub = subtitle ?? defaultSub

  return (
    <div
      {...dragProps}
      role="button" tabIndex={0}
      onClick={() => onOpen?.(task)}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen?.(task) } }}
      className={['task-row', urgent && !done ? 'task-row--urgent' : '', late ? 'task-row--late' : '', className].filter(Boolean).join(' ')}
      style={{ opacity: done ? 0.55 : preview ? 0.85 : 1, ...style }}
    >
      {grip && <GripVertical size={13} aria-hidden="true" style={{ color: 'var(--c-text-3)', opacity: 0.5, flexShrink: 0, cursor: 'grab' }} />}
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: urgent || late ? 600 : 500, color: 'var(--c-text)', lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none',
        }}>{task.title}</p>
        {(sub || task.recurrence) && (
          <p className="t-meta" style={{ margin: '1px 0 0', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap', color: late ? 'color-mix(in srgb, var(--c-danger) 80%, white)' : undefined }}>
            {task.recurrence && !subtitle && <Repeat size={10} aria-hidden="true" style={{ flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
          </p>
        )}
      </div>

      {task.recurrence && (task.streak || 0) > 0 && (
        <Pill tone={streakActive ? 'warning' : 'neutral'} title={`Streak: ${task.streak} dagen`}>
          <Flame size={11} aria-hidden="true" /> {task.streak}
        </Pill>
      )}
      {showDate && !task.recurrence && task.date && (isMultiDay(task)
        ? <Pill tone={late ? 'danger' : taskOnDay(task, today) ? (urgent ? 'danger' : 'accent') : 'neutral'} title={`${shortDate(task.date, today)} t/m ${shortDate(task.end_date, today)}`}>{spanLabel(task)}</Pill>
        : <Pill tone={late ? 'danger' : task.date === today ? (urgent ? 'danger' : 'accent') : 'neutral'}>{shortDate(task.date, today)}</Pill>
      )}
      {urgent && !done && <Flag size={14} aria-label="Urgent" style={{ color: 'var(--c-danger)', flexShrink: 0 }} />}
      {(task.priority ?? 2) === 3 && <Flag size={14} aria-label="Later" style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />}

      {onDelete && (
        <button type="button" className="task-row__del" aria-label={`Verwijder "${task.title}"`} title="Verwijderen"
          onClick={e => { e.stopPropagation(); onDelete(task.id) }}>
          <Trash2 size={13} />
        </button>
      )}
      {!preview && onToggle && (
        <CheckButton checked={done} onChange={() => onToggle(task)} label={`${done ? 'Markeer als niet gedaan' : 'Markeer als gedaan'}: ${task.title}`}
          tone={late || urgent ? 'danger' : 'accent'} />
      )}
      {preview && <Repeat size={14} aria-label="Routine (voorbeeld)" style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />}
    </div>
  )
}
