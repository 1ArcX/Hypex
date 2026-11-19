import { useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, BookOpen, CalendarClock, ChevronRight, Clock, Plus } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { addDays, dayOf, daysBetween, fmtDec, fmtDur, fmtHours, fmtShortDate, todayISO } from '../lib/format'
import { STATUSES } from '../lib/meta'
import { FilterTabs } from '../../recap/components/ui'
import type { Course, CourseStatus } from '../types'

const LS_FILTER = 'focus_course_filter'
const STALE_DAYS = 7

interface CourseRow {
  course: Course
  totalMins: number
  weekMins: number
  lastDay: string | null
  staleDays: number | null // dagen sinds laatst gestudeerd (null = nog nooit)
  next: { title: string; date: string; days: number } | null
  topicDone: number // minuten die meetellen voor de doeluren (per onderwerp afgetopt op het doel)
  topicGoal: number // som van de doeluren in minuten
  topicCount: number
}

/**
 * Vakken als kaarten in Dash-stijl: kleurbalk, naam + kort label, dagen tot de eerstvolgende toets, uren deze week,
 * voortgang van de onderwerpen (gestudeerd / doeluren). Gesorteerd op eerstvolgende toets; vakken die je langer dan
 * een week niet hebt gestudeerd krijgen een markering.
 */
export function CoursesView({ onOpenCourse, onNewCourse, onShowInsights }: {
  onOpenCourse: (id: string) => void
  onNewCourse: () => void
  onShowInsights: () => void
}) {
  const courses = useFocusStore(s => s.courses)
  const sessions = useFocusStore(s => s.sessions)
  const dates = useFocusStore(s => s.dates)
  const topics = useFocusStore(s => s.topics)
  const [filter, setFilterState] = useState<CourseStatus>(() => { try { return (localStorage.getItem(LS_FILTER) as CourseStatus) || 'active' } catch { return 'active' } })
  const setFilter = (f: CourseStatus) => { setFilterState(f); try { localStorage.setItem(LS_FILTER, f) } catch { /* privé-venster */ } }

  const today = todayISO()
  const monday = addDays(today, -((new Date().getDay() + 6) % 7))

  const rows = useMemo<CourseRow[]>(() => {
    const byCourse = new Map<string, { total: number; week: number; last: string | null; perTopic: Record<string, number> }>()
    for (const s of sessions) {
      if (!s.course_id) continue
      const day = dayOf(s.completed_at)
      const r = byCourse.get(s.course_id) || { total: 0, week: 0, last: null, perTopic: {} }
      r.total += s.duration_minutes || 0
      if (day >= monday) r.week += s.duration_minutes || 0
      if (!r.last || day > r.last) r.last = day
      if (s.topic_id) r.perTopic[s.topic_id] = (r.perTopic[s.topic_id] || 0) + (s.duration_minutes || 0)
      byCourse.set(s.course_id, r)
    }
    return courses.filter(c => c.status === filter).map(c => {
      const r = byCourse.get(c.id) || { total: 0, week: 0, last: null, perTopic: {} }
      const up = dates.filter(d => d.course_id === c.id && d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
      const next = up ? { title: up.title, date: up.date, days: daysBetween(today, up.date) }
        : c.final_date && c.final_date >= today ? { title: 'Eindtoets', date: c.final_date, days: daysBetween(today, c.final_date) } : null
      const ts = topics.filter(t => t.course_id === c.id)
      return {
        course: c, totalMins: r.total, weekMins: r.week, lastDay: r.last,
        staleDays: r.last ? daysBetween(r.last, today) : null,
        next,
        topicDone: ts.reduce((a, t) => a + Math.min(r.perTopic[t.id] || 0, t.target_minutes || 0), 0),
        topicGoal: ts.reduce((a, t) => a + (t.target_minutes || 0), 0),
        topicCount: ts.length,
      }
    }).sort((a, b) => {
      // Eerstvolgende toets eerst; zonder toets daarna, op naam
      if (a.next && b.next) return a.next.date.localeCompare(b.next.date) || a.course.name.localeCompare(b.course.name)
      if (a.next || b.next) return a.next ? -1 : 1
      return a.course.sort_order - b.course.sort_order || a.course.name.localeCompare(b.course.name)
    })
  }, [courses, sessions, dates, topics, filter, today, monday])

  const total = rows.reduce((a, r) => a + r.totalMins, 0)
  const goal = rows.reduce((a, r) => a + r.topicGoal, 0)
  const done = rows.reduce((a, r) => a + r.topicDone, 0)

  return (
    <div className="fx-page">
      <FilterTabs variant="segmented" label="Status" value={filter} onChange={(v: CourseStatus) => setFilter(v)} style={{ alignSelf: 'flex-start', width: 'fit-content', maxWidth: '100%' }}
        items={STATUSES.map(st => ({ value: st.id, label: st.label, count: courses.filter(c => c.status === st.id).length || undefined }))} />

      {rows.length > 0 && (
        <div className="fx-total">
          {/* Totaal met doel: de doeluren van alle onderwerpen (gestudeerd per onderwerp, afgetopt op het doel) */}
          <button type="button" className="fx-total-head" onClick={onShowInsights} title="Naar Inzichten">
            {goal > 0 ? <>
              <b className="tnum">{fmtDec(done / 60)} van {fmtDec(goal / 60, 0)} u</b>
              <span className="fx-label">doeluren onderwerpen · {fmtHours(total)} totaal gestudeerd</span>
            </> : <>
              <b className="tnum">{fmtHours(total)}</b>
              <span className="fx-label">totaal · geef onderwerpen doeluren om een doel te zien</span>
            </>}
            <ChevronRight size={18} color="var(--fx-text-3)" style={{ alignSelf: 'center' }} />
          </button>
          <div className="fx-total-track" aria-hidden="true">
            <div className="fx-total-fill" style={{ width: goal > 0 ? `${Math.min(100, (done / goal) * 100)}%` : '100%' }}>
              {rows.map(r => {
                const v = goal > 0 ? r.topicDone : r.totalMins
                return v > 0 ? <span key={r.course.id} style={{ flex: v, background: r.course.color }} /> : null
              })}
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="fx-card fx-empty-mini" style={{ marginTop: 16 }}>
          <BookOpen size={22} color="var(--fx-orange)" style={{ flexShrink: 0 }} />
          <div>
            <b>{filter === 'active' ? 'Nog geen vakken' : `Geen ${STATUSES.find(s => s.id === filter)!.label.toLowerCase()} vakken`}</b>
            {filter === 'active' && 'Maak een vak aan om je studietijd per vak, onderwerp en toets bij te houden.'}
          </div>
          {filter === 'active' && <button type="button" className="fx-btn is-primary" onClick={onNewCourse}><Plus size={16} /> Vak</button>}
        </div>
      ) : (
        <div className="fx-cgrid">
          {rows.map(r => <CourseCard key={r.course.id} row={r} active={filter === 'active'} onOpen={() => onOpenCourse(r.course.id)} />)}
        </div>
      )}
    </div>
  )
}

function CourseCard({ row, active, onOpen }: { row: CourseRow; active: boolean; onOpen: () => void }) {
  const { course: c, next, weekMins, staleDays, topicDone, topicGoal, topicCount } = row
  const stale = active && (staleDays == null || staleDays > STALE_DAYS)
  const pct = topicGoal > 0 ? Math.round((topicDone / topicGoal) * 100) : null
  const when = next ? (next.days === 0 ? 'Vandaag' : next.days === 1 ? 'Morgen' : `Over ${next.days} d`) : null
  const nextLabel = next ? `${next.title} ${when?.toLowerCase()}` : null
  return (
    <button type="button" className={`fx-ccard${stale ? ' is-stale' : ''}`} style={{ '--course': c.color } as CSSProperties} onClick={onOpen}
      aria-label={`${c.name}${nextLabel ? `, ${nextLabel}` : ''}, ${fmtDur(weekMins)} deze week`}>
      <div className="fx-ccard-top">
        <span className="fx-ccard-name">{c.name}</span>
        {c.code && <span className="fx-ccard-code">{c.code}</span>}
      </div>
      <div className="fx-ccard-meta">
        {next && (
          <span className={`fx-ccard-next${next.days <= 3 ? ' is-urgent' : next.days <= 14 ? ' is-soon' : ''}`} title={`${next.title} · ${fmtShortDate(next.date)}`}>
            <CalendarClock size={13} /> <b>{when}</b> <em>{next.title}</em>
          </span>
        )}
        <span><Clock size={13} /> {fmtDur(weekMins)} deze week</span>
      </div>
      <div className="fx-ccard-prog">
        <small>
          <span>{topicCount ? `Onderwerpen · ${topicCount}` : 'Nog geen onderwerpen'}</span>
          {pct != null && <span className="tnum">{fmtDec(topicDone / 60)} / {fmtDec(topicGoal / 60, 0)} u · {pct}%</span>}
        </small>
        <div className="fx-ccard-bar"><i style={{ width: `${pct ?? 0}%` }} /></div>
      </div>
      {stale && (
        <span className="fx-stale"><AlertTriangle size={13} /> {staleDays == null ? 'Nog niet gestudeerd' : `${staleDays} dagen niet gestudeerd`}</span>
      )}
    </button>
  )
}
