import React, { useMemo, useRef, useState } from 'react'
import { CheckCircle2, RotateCcw, Repeat, Flame, TrendingUp, TrendingDown } from 'lucide-react'
import { EmptyState } from '../ui'
import { useCompletions } from '../../utils/taskCompletions'
import { todayISO, toISO } from '../../utils/recurrence'
import { taskCategory, categoryColor } from '../../utils/category'

// Taken → "Gedaan": afgeronde taken per dag (logboek task_completions), voortgang van de
// laatste 14 dagen en terugzetten. Routines staan per dag als compacte chips onder de taken.

const NL_DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const NL_DAYS_LONG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const BAR_DAYS = 14

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d) }
const dateOf = (iso) => new Date(iso + 'T12:00:00')
const shortDay = (iso) => { const d = dateOf(iso); return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}` }
function dayTitle(iso, today) {
  if (iso === today) return 'Vandaag'
  if (iso === addDays(today, -1)) return 'Gisteren'
  return NL_DAYS_LONG[dateOf(iso).getDay()]
}
const timeOf = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const mondayOf = (iso) => { const d = dateOf(iso); return addDays(iso, -((d.getDay() + 6) % 7)) }

export default function DoneView({ userId, tasks = [], onRestore, onOpen }) {
  const [range, setRange] = useState(35)
  const { rows, loading, needsMigration } = useCompletions(userId, range)
  const [busy, setBusy] = useState(null)
  const today = todayISO()
  const dayRefs = useRef({})
  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])

  const byDay = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      if (!m.has(r.day)) m.set(r.day, { tasks: [], routines: [] })
      m.get(r.day)[r.recurring ? 'routines' : 'tasks'].push(r)
    }
    return m
  }, [rows])

  const stats = useMemo(() => {
    const count = (iso) => { const d = byDay.get(iso); return d ? d.tasks.length + d.routines.length : 0 }
    const bars = []
    for (let i = BAR_DAYS - 1; i >= 0; i--) {
      const iso = addDays(today, -i)
      const d = byDay.get(iso)
      bars.push({ iso, tasks: d?.tasks.length || 0, routines: d?.routines.length || 0 })
    }
    const max = Math.max(1, ...bars.map(b => b.tasks + b.routines))
    // Deze week t/m vandaag vs. dezelfde dagen vorige week
    const mon = mondayOf(today)
    let week = 0, prev = 0
    for (let iso = mon; iso <= today; iso = addDays(iso, 1)) { week += count(iso); prev += count(addDays(iso, -7)) }
    // Reeks: dagen op rij met minstens één afgeronde taak (vandaag telt mee zodra er iets is)
    let streak = 0
    for (let iso = count(today) ? today : addDays(today, -1); count(iso) > 0; iso = addDays(iso, -1)) streak++
    const avg = bars.reduce((s, b) => s + b.tasks + b.routines, 0) / BAR_DAYS
    return { bars, max, today: count(today), week, prev, streak, avg }
  }, [byDay, today])

  const restore = async (entry) => {
    setBusy(entry.id)
    try { await onRestore?.(entry) } finally { setBusy(null) }
  }

  const jump = (iso) => dayRefs.current[iso]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (needsMigration) {
    return <EmptyState icon={CheckCircle2} title="Nog één stap" text="Draai add_task_completions.sql in Supabase om afgeronde taken per dag te bewaren." style={{ paddingTop: 48 }} />
  }

  const days = [...byDay.keys()]
  const delta = stats.week - stats.prev

  return (
    <div className="done-view">
      <section className="done-stats" aria-label="Voortgang">
        <div className="done-kpis">
          <div className="done-kpi"><span className="done-kpi__v tnum">{stats.today}</span><span className="done-kpi__l">vandaag</span></div>
          <div className="done-kpi">
            <span className="done-kpi__v tnum">{stats.week}</span>
            <span className="done-kpi__l">deze week
              {(stats.week || stats.prev) ? (
                <span className={`done-delta ${delta >= 0 ? 'is-up' : 'is-down'}`} title={`Vorige week tot nu: ${stats.prev}`}>
                  {delta >= 0 ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
                  {delta >= 0 ? '+' : ''}{delta}
                </span>
              ) : null}
            </span>
          </div>
          <div className="done-kpi"><span className="done-kpi__v tnum"><Flame size={16} aria-hidden="true" style={{ color: stats.streak ? 'var(--c-warning)' : 'var(--c-text-3)' }} /> {stats.streak}</span><span className="done-kpi__l">{stats.streak === 1 ? 'dag op rij' : 'dagen op rij'}</span></div>
          <div className="done-kpi"><span className="done-kpi__v tnum">{stats.avg.toFixed(1).replace('.', ',')}</span><span className="done-kpi__l">gem. per dag</span></div>
        </div>

        <div className="done-bars" role="list" aria-label="Afgerond per dag, laatste 14 dagen">
          {stats.bars.map(b => {
            const total = b.tasks + b.routines
            return (
              <button key={b.iso} type="button" role="listitem" className={`done-bar${b.iso === today ? ' is-today' : ''}`}
                onClick={() => total && jump(b.iso)} disabled={!total}
                title={`${shortDay(b.iso)}: ${b.tasks} ${b.tasks === 1 ? 'taak' : 'taken'}${b.routines ? `, ${b.routines} routine${b.routines === 1 ? '' : 's'}` : ''}`}>
                <span className="done-bar__n tnum">{total || ''}</span>
                <span className="done-bar__track">
                  <span className="done-bar__fill" style={{ height: `${(total / stats.max) * 100}%` }}>
                    {b.routines > 0 && <span className="done-bar__routine" style={{ height: `${(b.routines / total) * 100}%` }} />}
                  </span>
                </span>
                <span className="done-bar__d">{NL_DAYS[dateOf(b.iso).getDay()]}</span>
              </button>
            )
          })}
        </div>
        <p className="done-legend"><span className="done-legend__t" /> taken <span className="done-legend__r" /> routines</p>
      </section>

      {loading ? null : days.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nog niets afgerond" text="Afgevinkte taken komen hier per dag te staan." style={{ paddingTop: 32 }} />
      ) : (
        <div className="done-days">
          {days.map(iso => {
            const d = byDay.get(iso)
            return (
              <section key={iso} className={`done-day${iso === today ? ' is-today' : ''}`} ref={el => { dayRefs.current[iso] = el }}>
                <header className="done-day__head">
                  <span className="done-day__title">{dayTitle(iso, today)}</span>
                  <span className="done-day__sub">{shortDay(iso)}</span>
                  <span className="done-day__count tnum">{d.tasks.length + d.routines.length} gedaan</span>
                </header>

                {d.tasks.map(r => {
                  const task = taskById.get(r.task_id)
                  const color = categoryColor(taskCategory({ type_id: r.type_id }))
                  const moved = r.planned_date && r.planned_date !== r.day
                  return (
                    <div key={r.id} className="done-row" role={task ? 'button' : undefined} tabIndex={task ? 0 : undefined}
                      onClick={() => task && onOpen?.(task)}
                      onKeyDown={e => { if (task && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen?.(task) } }}>
                      <CheckCircle2 size={17} aria-hidden="true" className="done-row__check" style={{ color }} />
                      <div className="done-row__main">
                        <p className="done-row__title">{r.title}</p>
                        <p className="t-meta done-row__meta">
                          om {timeOf(r.completed_at)}
                          {moved && <> · gepland {shortDay(r.planned_date)}</>}
                          {!r.planned_date && <> · zonder datum</>}
                          {!task && <> · verwijderd</>}
                        </p>
                      </div>
                      {task && task.completed && (
                        <button type="button" className="done-restore" disabled={busy === r.id}
                          onClick={e => { e.stopPropagation(); restore(r) }}
                          title={r.planned_date ? `Terugzetten naar ${shortDay(r.planned_date)}` : 'Terugzetten naar Nog in te plannen'}
                          aria-label={`Zet "${r.title}" terug`}>
                          <RotateCcw size={13} aria-hidden="true" /> <span>Terugzetten</span>
                        </button>
                      )}
                    </div>
                  )
                })}

                {d.routines.length > 0 && (
                  <div className="done-routines">
                    <span className="done-routines__label"><Repeat size={12} aria-hidden="true" /> Routines</span>
                    {d.routines.map(r => (
                      <span key={r.id} className="done-chip">
                        {r.title}
                        {taskById.has(r.task_id) && (
                          <button type="button" disabled={busy === r.id} onClick={() => restore(r)}
                            title={iso === today ? 'Niet gedaan (afvinken ongedaan maken)' : 'Niet gedaan (uit de geschiedenis halen)'}
                            aria-label={`${r.title} niet gedaan`}><RotateCcw size={11} /></button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {rows.length > 0 && (
            <button type="button" className="btn-ghost done-more" onClick={() => setRange(r => r + 35)}>Toon oudere dagen</button>
          )}
        </div>
      )}
    </div>
  )
}
