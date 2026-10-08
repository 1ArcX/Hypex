import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { monthStats, weekSummary } from '../lib/stats'
import { addDays, dayOf, fmtDec, fmtShortDate, isoDate, MONTHS, todayISO } from '../lib/format'
import { NO_COURSE } from '../lib/meta'
import { WeekBars } from '../charts/charts'
import { Delta } from '../components/ui'
import { SessionList } from '../components/SessionList'

const WEEKDAYS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']

export function CalendarView({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  const allSessions = useFocusStore(s => s.sessions)
  const courses = useFocusStore(s => s.courses)
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(todayISO())
  const [courseFilter, setCourseFilter] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)

  const sessions = useMemo(() => courseFilter ? allSessions.filter(s => (s.course_id || NO_COURSE.id) === courseFilter) : allSessions, [allSessions, courseFilter])
  const ms = useMemo(() => monthStats(sessions, ym.y, ym.m), [sessions, ym])
  const week = useMemo(() => weekSummary(sessions, selected), [sessions, selected])
  const daySessions = sessions.filter(s => dayOf(s.completed_at) === selected)
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth()

  // Raster: maandag eerst
  const first = new Date(ym.y, ym.m, 1)
  const lead = (first.getDay() + 6) % 7
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate()
  const maxDay = Math.max(...Object.values(ms.days).map(d => d.mins), 60)
  const today = todayISO()
  const move = (n: number) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const fc = courseFilter ? (courses.find(c => c.id === courseFilter) || NO_COURSE) : null

  return (
    <div className="fx-page">
      <div className="fx-top">
        <div className="fx-dropdown">
          <button type="button" className={`fx-iconbtn is-solo${courseFilter ? ' is-on' : ''}`} onClick={() => setFilterOpen(o => !o)} aria-label="Filter op vak" aria-expanded={filterOpen}
            style={courseFilter ? { color: fc?.color } : undefined}>
            <ListFilter size={22} />
          </button>
          {filterOpen && (
            <div className="fx-menu" role="menu">
              <button type="button" onClick={() => { setCourseFilter(null); setFilterOpen(false) }}>Alle vakken{!courseFilter && <span style={{ color: 'var(--fx-orange)' }}>●</span>}</button>
              {courses.map(c => (
                <button key={c.id} type="button" onClick={() => { setCourseFilter(c.id); setFilterOpen(false) }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, display: 'inline-block' }} />{c.name}</span>
                  {courseFilter === c.id && <span style={{ color: 'var(--fx-orange)' }}>●</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <h1 className="fx-h1">Kalender</h1>
      {fc && <div className="fx-muted" style={{ marginTop: -8, marginBottom: 10 }}>Gefilterd op <b style={{ color: fc.color }}>{fc.name}</b></div>}

      <div className="fx-cols"><div className="fx-col">
      <div className="fx-cal-stats">
        <Stat label="Uren" value={fmtDec(ms.mins / 60, ms.mins >= 600 ? 0 : 1)} delta={ms.deltaMins} />
        <Stat label="Sessies" value={String(ms.count)} delta={ms.deltaCount} />
        <Stat label="Daggem." value={fmtDec(ms.dailyAvg / 60)} delta={ms.deltaAvg} />
      </div>

      <div className="fx-cal-nav">
        <button type="button" className="fx-iconbtn" onClick={() => move(-1)} aria-label="Vorige maand"><ChevronLeft size={24} color="var(--fx-text-3)" /></button>
        <h2>{MONTHS[ym.m].replace(/^./, c => c.toUpperCase())} {ym.y}</h2>
        <button type="button" className="fx-iconbtn" onClick={() => move(1)} disabled={isCurrent} aria-label="Volgende maand" style={{ opacity: isCurrent ? 0.3 : 1 }}><ChevronRight size={24} color="var(--fx-text-3)" /></button>
      </div>

      <div className="fx-cal-grid" role="grid" aria-label="Studie-uren per dag">
        {WEEKDAYS.map((d, i) => <span key={i} className="fx-cal-wd">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const iso = isoDate(new Date(ym.y, ym.m, i + 1))
          const info = ms.days[iso]
          const level = info ? Math.min(1, info.mins / maxDay) : 0
          const future = iso > today
          return (
            <button key={iso} type="button" role="gridcell" disabled={future}
              className={`fx-cal-day${info ? ' has-data' : ''}${iso === selected ? ' is-selected' : ''}${future ? ' is-future' : ''}`}
              style={info ? { '--lvl': `${Math.round(30 + level * 70)}%` } as React.CSSProperties : undefined}
              onClick={() => { setSelected(iso); setDayOpen(!!info) }}
              aria-label={`${fmtShortDate(iso)}: ${info ? `${fmtDec(info.mins / 60)} uur` : 'niet gestudeerd'}`}>
              <b className="tnum">{i + 1}</b>
              {info && <small className="tnum">{info.mins >= 60 ? `${Math.round(info.mins / 60)}u` : `${info.mins}m`}</small>}
            </button>
          )
        })}
      </div>

      </div><div className="fx-col">
      <button type="button" className="fx-section-head fx-day-head" onClick={() => setDayOpen(o => !o)} aria-expanded={dayOpen}
        style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', marginTop: 22 }}>
        <h2 className="fx-h2">Sessies op {fmtShortDate(selected)} {parseInt(selected.slice(0, 4))}</h2>
        <ChevronRight size={22} style={{ transform: dayOpen ? 'rotate(90deg)' : undefined, transition: 'transform 0.2s' }} />
      </button>
      {dayOpen && (daySessions.length
        ? <SessionList sessions={daySessions} onOpen={onOpenSession} />
        : <div className="fx-card fx-empty" style={{ padding: 22 }}>Geen sessies op deze dag.</div>)}

      <div className="fx-week-card">
        <h3>Weekoverzicht <span className="fx-faint" style={{ fontWeight: 500, fontSize: 14 }}>{fmtShortDate(week.days[0].date)} – {fmtShortDate(addDays(week.days[0].date, 6))}</span></h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div><div className="fx-muted" style={{ fontSize: 15 }}>Totaal uren</div><b className="tnum">{fmtDec(week.total / 60)}</b></div>
          <div style={{ textAlign: 'right' }}><div className="fx-muted" style={{ fontSize: 15 }}>Daggemiddelde</div><b className="tnum">{fmtDec(week.dailyAvg / 60)}</b></div>
        </div>
        <WeekBars days={week.days} />
      </div>
      </div></div>
    </div>
  )
}

function Stat({ label, value, delta }: { label: string; value: string; delta: number | null }) {
  return (
    <div>
      <div className="fx-overline">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span className="tnum" style={{ fontSize: 28, fontWeight: 800 }}>{value}</span>
        <span style={{ fontSize: 15 }}><Delta value={delta} suffix="t.o.v. vorige maand" /></span>
      </div>
    </div>
  )
}
