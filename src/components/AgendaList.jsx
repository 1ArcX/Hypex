import React from 'react'
import { appliesOn } from '../utils/recurrence'
import { taskDaypart, daypartLabel } from '../utils/daypart'

// Chronologische lijst-weergave (iOS "Lijst"): komende dagen met al hun items
// — events, lessen, werk, taken en routines — gegroepeerd per dag op tijd.

const NL_DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const DAYS_AHEAD = 35

function pad2(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = String(str).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function fmtTime(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }

// Replica van de event-matching uit Timeline (incl. herhaling)
function eventMatchesDay(ev, date) {
  const start = new Date(ev.start_time)
  const end = new Date(ev.end_time)
  const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const checkD = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (checkD >= startD && checkD <= endD) return true
  if (checkD < startD) return false
  const r = ev.recurrence
  if (r === 'daily') return true
  if (r === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5
  if (r === 'weekly') return ev.recurrence_days?.includes(date.getDay())
  if (r === 'monthly') return start.getDate() === date.getDate()
  if (r === 'yearly') return start.getMonth() === date.getMonth() && start.getDate() === date.getDate()
  return false
}

function getWorkShifts(ds) {
  try {
    return (JSON.parse(localStorage.getItem('pmt_work_shifts')) || []).filter(s => s.date?.slice(0, 10) === ds)
  } catch { return [] }
}

function buildDayItems(date, { tasks, subjects, calendarEvents, magisterLessons }) {
  const ds = toDateStr(date)
  const items = []

  // Events
  for (const ev of (calendarEvents || [])) {
    if (ev.description?.startsWith('pmt:')) continue
    if (!eventMatchesDay(ev, date)) continue
    const s = new Date(ev.start_time), e = new Date(ev.end_time)
    const allDay = s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59
    items.push({ kind: 'event', allDay, mins: allDay ? -1 : s.getHours() * 60 + s.getMinutes(), timeLabel: allDay ? 'hele dag' : fmtTime(s), title: ev.title, color: ev.color || '#818CF8' })
  }
  // Lessen
  for (const les of (magisterLessons || [])) {
    if (!les.start || !isSameDay(new Date(les.start), date)) continue
    const s = new Date(les.start)
    const cancelled = les.uitgevallen || les.cancelled
    items.push({ kind: 'lesson', mins: s.getHours() * 60 + s.getMinutes(), timeLabel: fmtTime(s), title: les.vak || les.description || 'Les', color: cancelled ? '#FF6B6B' : '#FACC15', cancelled, sub: les.lokaal || les.location })
  }
  // Werk
  for (const sh of getWorkShifts(ds)) {
    items.push({ kind: 'work', mins: timeStrToMins(sh.start), timeLabel: `${sh.start || ''}`, title: '💼 Jumbo', color: '#FF8C42', sub: sh.end ? `tot ${sh.end}` : '' })
  }
  // Taken + routines
  for (const t of (tasks || [])) {
    const match = t.recurrence ? appliesOn(t, ds) : t.date === ds
    if (!match) continue
    if (!t.recurrence && t.completed) continue
    const timed = t.start_time || t.time
    const dp = taskDaypart(t)
    const subject = subjects?.find(s => s.id === t.subject_id)
    const color = subject?.color || t.color || (t.recurrence ? '#5EEAD4' : '#818CF8')
    items.push({
      kind: 'task', task: t, color,
      mins: timed ? timeStrToMins(timed) : -1,
      timeLabel: timed || (dp ? daypartLabel(dp) : 'taak'),
      title: `${t.recurrence ? '🔁 ' : ''}${t.title}`,
    })
  }

  items.sort((a, b) => a.mins - b.mins)
  return items
}

function dayHeading(date, today) {
  const diff = Math.round((date - today) / 86400000)
  const rel = isSameDay(date, today) ? 'Vandaag' : diff === 1 ? 'Morgen' : null
  const base = `${NL_DAYS[date.getDay()]} ${date.getDate()} ${NL_MONTHS[date.getMonth()]}`
  return rel ? `${rel} · ${base}` : base
}

export default function AgendaList({ tasks, subjects, calendarEvents, magisterLessons, onOpenDay, onToggleTask, onViewDetail }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const days = []
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i)
    const items = buildDayItems(d, { tasks, subjects, calendarEvents, magisterLessons })
    if (items.length) days.push({ date: d, items })
  }

  // Te laat bovenaan
  const todayStr = toDateStr(today)
  const overdue = (tasks || [])
    .filter(t => !t.recurrence && !t.completed && t.date && t.date < todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (days.length === 0 && overdue.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-3)' }}>
        <span style={{ fontSize: 40 }}>🗓️</span>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Niets gepland de komende weken</p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 100px', WebkitOverflowScrolling: 'touch' }}>
      {overdue.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#ff8080', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '0 0 8px', padding: '0 2px' }}>⚠️ Te laat</p>
          {overdue.map(t => (
            <Row key={t.id} color="#FF6B6B" timeLabel="te laat"
              title={t.title} onClick={() => onViewDetail?.(t)}
              check={{ done: false, onToggle: () => onToggleTask?.(t) }} />
          ))}
        </div>
      )}

      {days.map(({ date, items }) => (
        <div key={toDateStr(date)} style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: isSameDay(date, today) ? 'var(--accent)' : 'var(--text-2)', letterSpacing: '0.03em', margin: '0 0 8px', padding: '0 2px', textTransform: 'capitalize' }}>
            {dayHeading(date, today)}
          </p>
          {items.map((it, i) => (
            <Row key={i} color={it.color} timeLabel={it.timeLabel} title={it.title} sub={it.sub}
              cancelled={it.cancelled}
              onClick={() => it.kind === 'task' ? onViewDetail?.(it.task) : onOpenDay?.(date)}
              check={it.kind === 'task' && !it.task.recurrence ? { done: false, onToggle: () => onToggleTask?.(it.task) } : null} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Row({ color, timeLabel, title, sub, cancelled, onClick, check }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6,
        borderRadius: 12, cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      }}>
      <div style={{ width: 50, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {timeLabel}
      </div>
      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: color, flexShrink: 0 }} />
      {check && (
        <button onClick={e => { e.stopPropagation(); check.onToggle() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${color}` }} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: cancelled ? 'line-through' : 'none' }}>
          {title}
        </p>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
      </div>
    </div>
  )
}
