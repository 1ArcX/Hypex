import React, { useState } from 'react'
import { Flame, Plus, AlertTriangle, Repeat, ListTodo, Sun, Sunset, Moon, CheckCircle2 } from 'lucide-react'
import {
  todayISO, toISO, recurrenceLabel, isDueToday, isDoneToday, isStreakActive, appliesOn,
} from '../utils/recurrence'
import { taskDaypart, daypartLabel, daypartOrder } from '../utils/daypart'
import { ProgressBar, SectionHeader, EmptyState } from './ui'
import TaskRow from './tasks/TaskRow'
import { taskOnDay, taskLastDate } from '../utils/taskStatus'

// Vandaag / Morgen (mockup paneel 3): voortgangskop + gegroepeerde, inklapbare secties
// Urgent → Te laat → dagdelen (Ochtend/Middag/Avond/Overig) → Routines.

const NL_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const DAYPART_ICON = { ochtend: Sun, middag: Sunset, avond: Moon }
const COLLAPSE_KEY = 'taken_collapsed_v2'

function daysLate(dateStr, today) {
  return Math.round((Date.parse(today) - Date.parse(dateStr)) / 86400000)
}
function lateLabel(n) {
  if (n <= 1) return 'gisteren'
  if (n < 7) return `${n} dagen te laat`
  if (n < 14) return '1 week te laat'
  return `${Math.floor(n / 7)} weken te laat`
}

export const taskTimeSort = (a, b) => {
  const pa = a.priority ?? 2, pb = b.priority ?? 2
  if (pa !== pb) return pa - pb
  return (a.start_time || a.time || '99:99').localeCompare(b.start_time || b.time || '99:99')
}

// Inklapstatus per sectie onthouden (per apparaat, alleen gemak)
function useCollapsed() {
  const [set, setSet] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []) } catch { return new Set() }
  })
  const toggle = (id) => setSet(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])) } catch {}
    return next
  })
  return [set, toggle]
}

// compactHeader: geen eigen titel (de Overzicht-kaart tekent die), wel de voortgang.
// showDone: eenmalige taken die vandaag al afgerond zijn, doorgestreept onderaan.
export default function TodayView({ tasks, subjects = [], dateOffset = 0, onToggleRoutine, onToggleTask, onOpen, onNew, compactHeader = false, showDone = false, dragBind, rowClass }) {
  const [collapsed, toggleCollapsed] = useCollapsed()
  const today = todayISO()
  const isToday = dateOffset === 0
  const d = new Date(); d.setDate(d.getDate() + dateOffset)
  const target = toISO(d)
  const dateLabel = `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
  const heading = isToday ? 'Vandaag' : dateOffset === 1 ? 'Morgen' : dateLabel
  const subjectName = t => subjects.find(s => s.id === t.subject_id)?.name

  // Routines voor de doeldag. Vandaag: due (incl. gemist) of vandaag al gedaan.
  // Toekomst: routines die op die dag vallen (alleen preview, geen afvinken).
  const routines = tasks
    .filter(t => t.recurrence && (isToday ? (isDueToday(t, today) || isDoneToday(t, today)) : appliesOn(t, target)))
    .sort((a, b) => {
      if (isToday) {
        const da = isDoneToday(a, today) ? 1 : 0
        const db = isDoneToday(b, today) ? 1 : 0
        if (da !== db) return da - db
      }
      return (b.streak || 0) - (a.streak || 0)
    })

  // Te laat (alleen op de vandaag-weergave): meegenomen naar vandaag, gevlagd.
  const overdueTasks = isToday
    ? tasks.filter(t => !t.recurrence && !t.completed && t.date && taskLastDate(t) < today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.priority ?? 2) - (b.priority ?? 2))
    : []

  // Eenmalige taken van de doeldag: urgent apart, de rest per dagdeel.
  const dayTasks = tasks.filter(t => !t.recurrence && !t.completed && taskOnDay(t, target))
  const urgentTasks = dayTasks.filter(t => (t.priority ?? 2) === 1).sort(taskTimeSort)
  const buckets = {}
  for (const t of dayTasks) {
    if ((t.priority ?? 2) === 1) continue
    const dp = taskDaypart(t) || 'none'
    ;(buckets[dp] ||= []).push(t)
  }
  const dayGroups = Object.keys(buckets)
    .sort((a, b) => daypartOrder(a === 'none' ? null : a) - daypartOrder(b === 'none' ? null : b))
    .map(dp => ({ id: dp, items: buckets[dp].sort(taskTimeSort) }))

  // Voortgang: routines van vandaag + eenmalige taken met datum vandaag (open én afgerond)
  const doneOneoff = isToday ? tasks.filter(t => !t.recurrence && t.completed && taskOnDay(t, today)).length : 0
  const routinesDone = isToday ? routines.filter(t => isDoneToday(t, today)).length : 0
  const total = routines.length + dayTasks.length + doneOneoff
  const done = routinesDone + doneOneoff
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const doneTasks = isToday ? tasks.filter(t => !t.recurrence && t.completed && taskOnDay(t, today)).sort(taskTimeSort) : []
  const isEmpty = routines.length === 0 && dayTasks.length === 0 && overdueTasks.length === 0 && !(showDone && doneTasks.length)

  const section = (id, props, rows) => (
    <section key={id}>
      <SectionHeader {...props} collapsible open={!collapsed.has(id)} onToggle={() => toggleCollapsed(id)} />
      {!collapsed.has(id) && <div className="task-list">{rows}</div>}
    </section>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Voortgangskop */}
      <div>
        {!compactHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 className="t-page" style={{ margin: 0 }}>{heading}</h2>
            <span className="t-meta" style={{ fontSize: 12, textTransform: 'capitalize' }}>{dateLabel}</span>
          </div>
        )}
        {isToday && total > 0 && (
          <div style={{ marginTop: compactHeader ? 0 : 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                <strong className="tnum" style={{ color: 'var(--c-text)' }}>{done} van {total}</strong> voltooid
              </span>
              <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? 'var(--c-success)' : 'var(--accent)' }}>{pct}%</span>
            </div>
            <ProgressBar value={done} max={total} tone={pct === 100 ? 'success' : 'accent'} height={6} label="Voortgang vandaag" />
          </div>
        )}
        {!isToday && total > 0 && (
          <p className="t-meta" style={{ margin: '4px 0 0', fontSize: 12 }}>
            {dayTasks.length} {dayTasks.length === 1 ? 'taak' : 'taken'}{routines.length ? ` · ${routines.length} ${routines.length === 1 ? 'routine' : 'routines'}` : ''}
          </p>
        )}
      </div>

      {urgentTasks.length > 0 && section('urgent', { icon: Flame, title: 'Urgent', count: urgentTasks.length, tone: 'danger' },
        urgentTasks.map(t => (
          <TaskRow key={t.id} task={t} today={today} subjectName={subjectName(t)} onToggle={onToggleTask} onOpen={onOpen} dragProps={dragBind?.(t)} className={rowClass?.(t)} />
        )))}

      {overdueTasks.length > 0 && section('telaat', { icon: AlertTriangle, title: 'Te laat', count: overdueTasks.length, tone: 'danger' },
        overdueTasks.map(t => (
          <TaskRow key={t.id} task={t} today={today} late
            subtitle={[lateLabel(daysLate(t.date, today)), subjectName(t)].filter(Boolean).join(' · ')}
            onToggle={onToggleTask} onOpen={onOpen} dragProps={dragBind?.(t)} className={rowClass?.(t)} />
        )))}

      {dayGroups.map(g => section(`dp:${g.id}`, {
        icon: DAYPART_ICON[g.id] || ListTodo,
        title: g.id === 'none' ? 'Overig' : daypartLabel(g.id),
        count: g.items.length,
      }, g.items.map(t => (
        <TaskRow key={t.id} task={t} today={today} subjectName={subjectName(t)} showDate={false} onToggle={onToggleTask} onOpen={onOpen} dragProps={dragBind?.(t)} className={rowClass?.(t)} />
      ))))}

      {routines.length > 0 && section('routines', {
        icon: Repeat, title: 'Routines', tone: 'routine',
        count: isToday ? `${routinesDone}/${routines.length}` : routines.length,
      }, routines.map(t => (
        <TaskRow key={t.id} task={t} today={today}
          done={isToday && isDoneToday(t, today)} preview={!isToday} streakActive={isStreakActive(t, today)}
          subtitle={[recurrenceLabel(t.recurrence, t.recurrence_days), t.start_time || t.time].filter(Boolean).join(' · ')}
          onToggle={onToggleRoutine} onOpen={onOpen} />
      )))}

      {showDone && isToday && doneTasks.length > 0 && section('afgerond', { icon: CheckCircle2, title: 'Afgerond vandaag', count: doneTasks.length, tone: 'success' },
        doneTasks.map(t => (
          <TaskRow key={t.id} task={t} today={today} done subjectName={subjectName(t)} showDate={false} onToggle={onToggleTask} onOpen={onOpen} />
        )))}

      {/* Lege staat */}
      {isEmpty && (
        <EmptyState icon={Sun} title={isToday ? 'Niets voor vandaag' : 'Niets gepland'}
          text="Geen routines of taken gepland. Voeg er een toe of geniet van je vrije dag."
          action={<button onClick={onNew} className="btn-primary"><Plus size={15} aria-hidden="true" /> Nieuwe taak</button>} />
      )}

      {/* Alles-gedaan melding wanneer er routines waren maar alles af is (alleen vandaag) */}
      {isToday && !isEmpty && dayTasks.length === 0 && overdueTasks.length === 0 && routines.length > 0 && routinesDone === routines.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'color-mix(in srgb, var(--c-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--c-success) 25%, transparent)' }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>🎉</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-success)' }}>Alle routines afgevinkt vandaag — sterk!</span>
        </div>
      )}
    </div>
  )
}
