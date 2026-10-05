import React from 'react'
import {
  CalendarCheck, CalendarClock, AlertTriangle, ChevronLeft, ChevronRight, ArrowRight, MapPin, Plus, Clock3, Car, Repeat,
} from 'lucide-react'
import { Card, CardHeader, CardLink, CheckButton, Pill, IconButton, FilterTabs, EmptyState, ProgressBar } from '../ui'
import { taskCategory, categoryColor } from '../../utils/category'
import { daysLate, taskOnDay } from '../../utils/taskStatus'
import { isDueToday, isDoneToday } from '../../utils/recurrence'
import { DAYPARTS } from '../../utils/daypart'
import { countdownLabel } from '../../utils/upcoming'

// Bovenaan het dashboard: links "Vandaag" (eerst dit → schema → dagdelen → routines, met voortgang),
// rechts "Volgende" (aftellen, reistijd → vertrektijd). Elk met een eigen gekleurde gloed.

const pad2 = n => String(n).padStart(2, '0')
const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const toMins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

export const NEXT_FILTERS = [
  { value: 'alle',  label: 'Alle' },
  { value: 'event', label: 'Agenda' },
  { value: 'werk',  label: 'Werk' },
  { value: 'taak',  label: 'Taken' },
]

// ── Vandaag ──────────────────────────────────────────────────────────────────
function TodayPanel({ tasks, subjects, today, todayItems, attention, overdueIds, lim, onToggleTask, onOpenTask, onOpenItem, onNewTask, onOpenList }) {
  const subjectName = id => subjects?.find(s => s.id === id)?.name
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()

  // Voortgang: zoals Taken → Vandaag (routines van vandaag + eenmalige taken op vandaag)
  const isDone = t => t.recurrence ? isDoneToday(t, today) : t.completed
  const todays = tasks.filter(t => t.recurrence ? (isDueToday(t, today) || isDoneToday(t, today)) : taskOnDay(t, today))
  const done = todays.filter(isDone).length
  const total = todays.length

  // Taken zonder tijd van vandaag per dagdeel (urgent/te laat staan al bij "Eerst dit")
  const attIds = new Set(attention.map(t => t.id))
  const untimed = tasks.filter(t => !t.recurrence && !t.completed && taskOnDay(t, today) && !(t.start_time || t.time) && !attIds.has(t.id))
  const groups = [...DAYPARTS.map(dp => ({ id: dp.id, label: `${dp.emoji} ${dp.label}`, items: untimed.filter(t => t.daypart === dp.id) })),
    { id: 'none', label: 'Vandaag', items: untimed.filter(t => !t.daypart) }].filter(g => g.items.length)
  const routines = tasks.filter(t => t.recurrence && (isDueToday(t, today) || isDoneToday(t, today)))

  // Schema: tot `lim.schedule` items, met de eerstvolgende in beeld (afgelopen items vallen eerst weg)
  const schedule = todayItems.filter(i => !(i.type === 'task' && attIds.has(i.raw?.id)))
  const firstUpcoming = schedule.findIndex(i => (i.end ? toMins(i.end) : i.sortMins) >= nowMins)
  const from = Math.max(0, Math.min(firstUpcoming < 0 ? schedule.length : firstUpcoming - 1, schedule.length - lim.schedule))
  const shown = schedule.slice(from, from + lim.schedule)
  const hidden = schedule.length - shown.length
  const nowIdx = shown.findIndex(i => i.sortMins > nowMins)

  const att = attention.slice(0, lim.attention)
  const isEmpty = !attention.length && !schedule.length && !groups.length && !routines.length

  const taskRow = (t, { late, urgent } = {}) => {
    const n = late ? daysLate(t, today) : 0
    const sub = [late ? `${n} ${n === 1 ? 'dag' : 'dagen'} te laat` : urgent ? 'Urgent' : null, subjectName(t.subject_id)].filter(Boolean).join(' · ')
    return (
      <div key={t.id} className={`dash-row${late || urgent ? ' is-alert' : ''}`}>
        <CheckButton checked={false} onChange={() => onToggleTask?.(t)} label={`Markeer "${t.title}" als gedaan`} tone={late || urgent ? 'danger' : 'accent'} />
        <button type="button" className="dash-row__main" onClick={() => onOpenTask?.(t)}>
          <span className="dash-row__dot" style={{ background: categoryColor(taskCategory(t)) }} aria-hidden="true" />
          <span className="dash-row__title">{t.title}</span>
          {sub && <span className="dash-row__sub">{sub}</span>}
        </button>
      </div>
    )
  }

  return (
    <Card glow="accent" pad={16} className="dash-focus__today">
      <CardHeader icon={CalendarCheck} title="Vandaag"
        action={<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconButton icon={Plus} label="Nieuwe taak" onClick={onNewTask} size={26} />
          <CardLink onClick={onOpenList}>Alle taken <ArrowRight size={13} /></CardLink>
        </div>} />

      {total > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}><strong className="tnum" style={{ color: 'var(--c-text)' }}>{done} van {total}</strong> gedaan</span>
            <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: done === total ? 'var(--c-success)' : 'var(--accent)' }}>{Math.round(done / total * 100)}%</span>
          </div>
          <ProgressBar value={done} max={total} tone={done === total ? 'success' : 'accent'} height={6} label="Voortgang vandaag" />
        </div>
      )}

      <div className="dash-focus__cols">
        {/* Eerst dit + taken per dagdeel + routines */}
        <div className="dash-focus__col">
          {att.length > 0 && (
            <div className="dash-group">
              <p className="dash-group__head" style={{ color: 'var(--c-danger)' }}><AlertTriangle size={12} aria-hidden="true" /> Eerst dit</p>
              {att.map(t => taskRow(t, { late: overdueIds.has(t.id), urgent: !overdueIds.has(t.id) }))}
              {attention.length > att.length && <button type="button" className="dash-more" onClick={onOpenList}>+{attention.length - att.length} meer</button>}
            </div>
          )}
          {groups.map(g => (
            <div key={g.id} className="dash-group">
              <p className="dash-group__head">{g.label} <span className="tnum">· {g.items.length}</span></p>
              {g.items.slice(0, lim.tasks).map(t => taskRow(t))}
              {g.items.length > lim.tasks && <button type="button" className="dash-more" onClick={onOpenList}>+{g.items.length - lim.tasks} meer</button>}
            </div>
          ))}
          {routines.length > 0 && (
            <div className="dash-group">
              <p className="dash-group__head"><Repeat size={12} aria-hidden="true" /> Routines <span className="tnum">· {routines.filter(t => isDoneToday(t, today)).length}/{routines.length}</span></p>
              <div className="dash-routines">
                {routines.map(t => {
                  const d = isDoneToday(t, today)
                  return (
                    <button key={t.id} type="button" className={`dash-routine${d ? ' is-done' : ''}`} onClick={() => onToggleTask?.(t)}
                      aria-pressed={d} aria-label={`${t.title}: ${d ? 'gedaan, klik om terug te zetten' : 'klik om af te vinken'}`}>
                      <span className="dash-routine__box" aria-hidden="true">{d ? '✓' : ''}</span>{t.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Schema van vandaag (tijdlijn) */}
        {schedule.length > 0 && (
          <div className="dash-focus__col">
            <div className="dash-group">
              <p className="dash-group__head"><Clock3 size={12} aria-hidden="true" /> Schema</p>
              <ol className="dash-timeline">
                {shown.map((item, i) => {
                  const end = item.end ? toMins(item.end) : item.sortMins
                  const isNow = item.sortMins <= nowMins && item.end && end >= nowMins
                  const past = end < nowMins && !isNow
                  return (
                    <React.Fragment key={item.highlightKey || i}>
                      {i === nowIdx && !shown.some(x => x.sortMins <= nowMins && x.end && toMins(x.end) >= nowMins) && (
                        <li className="dash-timeline__now" aria-label={`Nu, ${hhmm(new Date())}`}><span>{hhmm(new Date())}</span></li>
                      )}
                      <li className={`dash-timeline__item${past ? ' is-past' : ''}${isNow ? ' is-now' : ''}`}>
                        <span className="dash-timeline__time tnum">{item.time}</span>
                        <span className="dash-timeline__bar" style={{ background: item.color }} aria-hidden="true" />
                        <button type="button" className="dash-timeline__body" onClick={() => onOpenItem?.(item)}>
                          <span className="dash-row__title">{item.label}</span>
                          <span className="dash-row__sub tnum">
                            {item.end ? `tot ${item.end}` : ''}{item.sub ? `${item.end ? ' · ' : ''}${item.sub}` : ''}
                          </span>
                        </button>
                        {isNow && <Pill tone="accent">Nu</Pill>}
                        {!past && item.travelBefore > 0 && <Pill tone="neutral" title={`${item.travelBefore} min reistijd`}><Car size={11} aria-hidden="true" /> {item.travelBefore}m</Pill>}
                        {item.type === 'task' && item.raw && (
                          <CheckButton checked={false} onChange={() => onToggleTask?.(item.raw)} label={`Markeer "${item.label}" als gedaan`} />
                        )}
                      </li>
                    </React.Fragment>
                  )
                })}
                {nowIdx === -1 && shown.length > 0 && shown[shown.length - 1].sortMins <= nowMins && !shown.some(x => x.end && toMins(x.end) >= nowMins) && (
                  <li className="dash-timeline__now"><span>{hhmm(new Date())}</span></li>
                )}
              </ol>
              {hidden > 0 && <button type="button" className="dash-more" onClick={() => onOpenItem?.(null)}>+{hidden} meer in de agenda</button>}
            </div>
          </div>
        )}
      </div>

      {isEmpty && <EmptyState compact title="Niets meer voor vandaag" text="Geen taken, routines of afspraken. Geniet ervan!" />}
    </Card>
  )
}

// ── Volgende ─────────────────────────────────────────────────────────────────
function NextPanel({ ev, hasMore, skip, setSkip, filter, setFilter, current, onOpen, onOpenAgenda }) {
  const color = ev ? categoryColor(ev.cat) : 'var(--accent)'
  const now = new Date()
  const tb = ev?.travelBefore || 0
  const depart = ev && tb ? new Date(ev.ts.getTime() - tb * 60000) : null
  const departMins = depart ? Math.round((depart - now) / 60000) : null

  let cdText, cdColor
  if (ev && depart) {
    if (departMins <= 0) { cdText = 'Vertrek nu!'; cdColor = 'var(--c-danger)' }
    else { cdText = `Vertrek ${countdownLabel(depart, now).toLowerCase()}`; cdColor = departMins < 15 ? 'var(--c-warning)' : 'var(--accent)' }
  } else if (ev) {
    cdText = countdownLabel(ev.ts, now)
    cdColor = ev.ts - now < 3600000 ? 'var(--c-warning)' : 'var(--accent)'
  }

  return (
    <Card glow={color} pad={16} className="dash-focus__next" style={{ display: 'flex', flexDirection: 'column' }}>
      <CardHeader icon={CalendarClock} title="Volgende"
        action={<div style={{ display: 'flex', gap: 2 }}>
          <IconButton icon={ChevronLeft} label="Vorige afspraak" size={26} disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - 1))} />
          <IconButton icon={ChevronRight} label="Volgende afspraak" size={26} disabled={!ev || !hasMore} onClick={() => setSkip(s => s + 1)} />
        </div>} />
      <FilterTabs variant="segmented" items={NEXT_FILTERS} value={filter} onChange={setFilter} label="Soort afspraak" style={{ marginBottom: 12, alignSelf: 'flex-start' }} />

      {current && skip === 0 && filter === 'alle' && (
        <div className="dash-nowbar">
          <span className="dash-nowbar__dot" aria-hidden="true" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Nu bezig</span>
          <span style={{ fontSize: 12, color: 'var(--c-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.label}</span>
          <span className="t-meta tnum">nog {current.minsLeft} min</span>
        </div>
      )}

      {ev ? (
        <>
          <p className="dash-next__cd" style={{ color: cdColor }}>
            {depart ? <Car size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />} {cdText}
          </p>
          <button type="button" onClick={() => onOpen(ev)} className="dash-next__item">
            <span aria-hidden="true" style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span className="dash-next__title">{ev.label}</span>
              <span className="t-meta tnum" style={{ display: 'block', fontSize: 12, marginTop: 2 }}>
                {ev.ts.toDateString() !== now.toDateString() && `${ev.ts.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} · `}
                {hhmm(ev.ts)}{ev.end ? ` – ${hhmm(ev.end)}` : ''}
              </span>
              {ev.code && <span className="t-meta" style={{ display: 'block', fontSize: 11, marginTop: 2, letterSpacing: '0.02em' }}>{ev.code}</span>}
              {ev.location && (
                <span className="t-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 2 }}>
                  <MapPin size={11} aria-hidden="true" /> {ev.location}
                </span>
              )}
            </span>
          </button>
          {depart && (
            <div className="dash-next__travel">
              <Car size={13} aria-hidden="true" />
              <span>Vertrek om <strong className="tnum">{hhmm(depart)}</strong> · {tb} min reistijd</span>
            </div>
          )}
        </>
      ) : (
        <EmptyState compact text="Niets meer gepland." />
      )}
      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <button type="button" className="btn-ghost" onClick={() => onOpenAgenda(ev)}>
          Bekijk agenda <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </Card>
  )
}

export default function TodayFocusCard(props) {
  return (
    <section className="dash-focus" aria-label="Vandaag en volgende afspraak">
      <TodayPanel {...props.today} />
      <NextPanel {...props.next} />
    </section>
  )
}
