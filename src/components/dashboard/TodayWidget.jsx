import React from 'react'
import { CalendarCheck, Plus } from 'lucide-react'
import { CardHeader, IconButton, CheckButton } from '../ui'
import { taskCategory, categoryColor } from '../../utils/category'

// Dashboard-widget "Vandaag": voortgangsring (afgerond / gepland vandaag, incl. routines)
// + de eerstvolgende open taken met afvinkknop.
export default function TodayWidget({ tasks, today, onToggleTask, onOpenTask, onNewTask, onOpenList }) {
  const todays = tasks.filter(t => t.date === today)
  const done = todays.filter(t => t.completed).length
  const total = todays.length
  const open = todays
    .filter(t => !t.completed)
    .sort((a, b) => ((a.priority ?? 2) - (b.priority ?? 2)) || (a.start_time || a.time || '99').localeCompare(b.start_time || b.time || '99'))
  const shown = open.slice(0, 3)

  const R = 26, C = 2 * Math.PI * R
  const pct = total > 0 ? done / total : 0

  return (
    <div className="card" style={{ padding: 14, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <CardHeader icon={CalendarCheck} title="Vandaag"
        action={<IconButton icon={Plus} label="Nieuwe taak" onClick={onNewTask} size={26} />} />
      {total === 0 ? (
        <p className="t-meta" style={{ margin: 0 }}>Niets gepland voor vandaag.</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <span style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }} role="img" aria-label={`${done} van ${total} voltooid`}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="32" cy="32" r={R} fill="none" stroke="var(--c-surface-3)" strokeWidth="5" />
              <circle cx="32" cy="32" r={R} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }} />
            </svg>
            <span className="tnum" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
              {done}/{total}
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {shown.length === 0 && <p className="t-meta" style={{ margin: 0, color: 'var(--c-success)' }}>Alles voor vandaag gedaan ✓</p>}
            {shown.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <CheckButton checked={false} onChange={() => onToggleTask(t)} label={`Markeer "${t.title}" als gedaan`} />
                <button type="button" onClick={() => onOpenTask(t)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: categoryColor(taskCategory(t)), flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </button>
              </div>
            ))}
            {open.length > shown.length && (
              <button type="button" onClick={onOpenList} className="t-meta"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--c-text-3)' }}>
                +{open.length - shown.length} meer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
