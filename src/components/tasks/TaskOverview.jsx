import React, { useMemo } from 'react'
import { Repeat, CalendarDays, Inbox } from 'lucide-react'
import TodayView, { taskTimeSort } from '../TodayView'
import TaskRow from './TaskRow'
import { Pill } from '../ui'
import { appliesOn, todayISO, toISO } from '../../utils/recurrence'

// Taken → "Overzicht": alle taken met hun dag. Vandaag staat gemarkeerd (links op desktop),
// de komende dagen als tijdlijn ernaast/eronder. Routines staan per dag als één compacte regel.

const NL_DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const ROUTINE_DAYS = 14 // routines alleen de komende twee weken tonen, anders houdt de lijst nooit op

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d) }
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
function dayTitle(iso, today) {
  const n = dayDiff(today, iso)
  if (n === 1) return 'Morgen'
  if (n === 2) return 'Overmorgen'
  const d = new Date(iso + 'T00:00:00')
  return NL_DAYS[d.getDay()].replace(/^./, c => c.toUpperCase())
}
function daySub(iso, today) {
  const d = new Date(iso + 'T00:00:00')
  const n = dayDiff(today, iso)
  const rel = n < 7 ? `over ${n} dagen` : n < 14 ? 'volgende week' : `over ${Math.round(n / 7)} weken`
  return `${d.getDate()} ${NL_MONTHS[d.getMonth()]}${n > 2 ? ` · ${rel}` : ''}`
}

export default function TaskOverview({ tasks, subjects = [], onToggleTask, onToggleRoutine, onOpen, onNew }) {
  const today = todayISO()
  const now = new Date()
  const subjectName = t => subjects.find(s => s.id === t.subject_id)?.name

  // Komende dagen: open eenmalige taken die ná vandaag beginnen + routines (komende 14 dagen)
  const days = useMemo(() => {
    const map = new Map()
    const at = (ds) => { if (!map.has(ds)) map.set(ds, { date: ds, tasks: [], routines: [] }); return map.get(ds) }
    for (const t of tasks) {
      if (t.recurrence || t.completed || !t.date || t.date <= today) continue
      at(t.date).tasks.push(t)
    }
    const routines = tasks.filter(t => t.recurrence)
    for (let i = 1; i <= ROUTINE_DAYS; i++) {
      const ds = addDays(today, i)
      const list = routines.filter(t => appliesOn(t, ds))
      if (list.length) at(ds).routines.push(...list)
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, tasks: d.tasks.sort(taskTimeSort) }))
  }, [tasks, today])

  // Taken zonder datum (urgent eerst)
  const unplanned = tasks.filter(t => !t.recurrence && !t.completed && !t.date)
    .sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || (a.created_at || '').localeCompare(b.created_at || ''))

  return (
    <div className="task-overview">
      <div className="task-overview__grid">
        <div className="task-overview__left">
        {/* Vandaag: gemarkeerd */}
        <section className="task-overview__today glow-card" style={{ '--glow': 'var(--accent)' }} aria-labelledby="ov-today">
          <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 id="ov-today" className="t-page" style={{ margin: 0 }}>Vandaag</h2>
            <Pill tone="accent" solid>Nu</Pill>
            <span className="t-meta" style={{ marginLeft: 'auto', fontSize: 12 }}>
              {NL_DAYS[now.getDay()]} {now.getDate()} {NL_MONTHS[now.getMonth()]}
            </span>
          </header>
          <TodayView tasks={tasks} subjects={subjects} compactHeader showDone
            onToggleRoutine={onToggleRoutine} onToggleTask={onToggleTask} onOpen={onOpen} onNew={onNew} />
        </section>

        {/* Nog in te plannen: taken zonder datum, direct onder Vandaag zodat ze niet vergeten worden */}
        {unplanned.length > 0 && (
          <section className="task-overview__unplanned glow-card" style={{ '--glow': 'var(--cat-school)' }} aria-labelledby="ov-unplanned">
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Inbox size={15} aria-hidden="true" style={{ color: 'var(--cat-school)' }} />
              <h2 id="ov-unplanned" className="t-section" style={{ margin: 0 }}>Nog in te plannen</h2>
              <Pill tone="var(--cat-school)">{unplanned.length}</Pill>
              <span className="t-meta" style={{ marginLeft: 'auto', fontSize: 11 }}>Geef ze een dag</span>
            </header>
            <div className="task-list">
              {unplanned.map(t => (
                <TaskRow key={t.id} task={t} today={today} subjectName={subjectName(t)} onToggle={onToggleTask} onOpen={onOpen} />
              ))}
            </div>
          </section>
        )}
        </div>

        {/* Komende dagen */}
        <section className="task-overview__upcoming" aria-labelledby="ov-upcoming">
          <h2 id="ov-upcoming" className="t-section" style={{ margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={15} aria-hidden="true" style={{ color: 'var(--c-text-3)' }} /> Komende dagen
          </h2>
          {days.length === 0 && (
            <p className="t-meta" style={{ margin: 0, fontSize: 13 }}>Nog niets gepland na vandaag.</p>
          )}
          {days.map((d, i) => {
            const newWeek = i === 0 || isoWeek(d.date) !== isoWeek(days[i - 1].date)
            return (
              <React.Fragment key={d.date}>
                {newWeek && (
                  <div className="task-overview__week">
                    <span>Week {isoWeek(d.date)}</span>
                  </div>
                )}
                <div className="task-overview__day">
                  <div className="task-overview__dayhead">
                    <span className="task-overview__dayname">{dayTitle(d.date, today)}</span>
                    <span className="t-meta" style={{ fontSize: 11 }}>{daySub(d.date, today)}</span>
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.tasks.length > 0 && (
                      <div className="task-list">
                        {d.tasks.map(t => (
                          <TaskRow key={t.id} task={t} today={today} subjectName={subjectName(t)} showDate={false}
                            onToggle={onToggleTask} onOpen={onOpen} />
                        ))}
                      </div>
                    )}
                    {d.routines.length > 0 && (
                      <div className="task-overview__routines">
                        <Repeat size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
                        {d.routines.map((t, ri) => (
                          <React.Fragment key={t.id}>
                            {ri > 0 && <span aria-hidden="true">·</span>}
                            <button type="button" onClick={() => onOpen?.(t)}>{t.title}</button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </section>
      </div>
    </div>
  )
}
