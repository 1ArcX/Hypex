import { useMemo, useState } from 'react'
import { ArrowRight, Bell, ChevronDown, ChevronLeft, ChevronUp, GraduationCap, MoreHorizontal, Pencil, Play, Calculator } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { courseStats, kindBreakdown, topicMinutes } from '../lib/stats'
import { daysBetween, fmtDec, fmtDur, fmtLongDate, fmtShortDate, parseDay, todayISO, MONTHS_SHORT, clamp } from '../lib/format'
import { KIND_BY_ID, STATUSES } from '../lib/meta'
import { neededFinal } from '../lib/grade'
import { KindDonut } from '../charts/charts'
import { TopicRing } from '../charts/svgCharts'
import { ActionMenu } from '../components/ui'
import { SessionList } from '../components/SessionList'
import type { CourseStatus } from '../types'

export function CourseDetail({ courseId, onBack, onEdit, onReminders, onGrades, onStudy, onOpenSession }: {
  courseId: string
  onBack: () => void
  onEdit: () => void
  onReminders: () => void
  onGrades: () => void
  onStudy: () => void
  onOpenSession: (id: string) => void
}) {
  const course = useFocusStore(s => s.courses.find(c => c.id === courseId))
  const allSessions = useFocusStore(s => s.sessions)
  const allDates = useFocusStore(s => s.dates)
  const allTopics = useFocusStore(s => s.topics)
  const allParts = useFocusStore(s => s.gradeParts)
  const saveCourse = useFocusStore(s => s.saveCourse)
  const deleteCourse = useFocusStore(s => s.deleteCourse)
  const [topicsOpen, setTopicsOpen] = useState(true)
  const [allSess, setAllSess] = useState(false)

  const sessions = useMemo(() => allSessions.filter(s => s.course_id === courseId), [allSessions, courseId])
  const dates = allDates.filter(d => d.course_id === courseId)
  const topics = allTopics.filter(t => t.course_id === courseId)
  const parts = allParts.filter(p => p.course_id === courseId)
  const stats = useMemo(() => courseStats(sessions), [sessions])
  const kinds = useMemo(() => kindBreakdown(sessions), [sessions])
  const tmins = useMemo(() => topicMinutes(sessions), [sessions])

  if (!course) return null
  const today = todayISO()
  const next = dates.find(d => d.date >= today)
  const start = course.start_date || course.created_at.slice(0, 10)
  const end = course.final_date || dates[dates.length - 1]?.date || null
  const grade = course.target_grade != null && parts.length ? neededFinal(parts, Number(course.target_grade)) : null

  const setStatus = (status: CourseStatus) => saveCourse({ id: course.id, name: course.name, status })
  const statusItems = STATUSES.filter(s => s.id !== course.status).map(s => ({
    label: s.id === 'active' ? 'Weer actief maken' : s.id === 'paused' ? 'Pauzeren' : s.id === 'completed' ? 'Markeer als afgerond' : 'Archiveren',
    onClick: () => setStatus(s.id),
  }))

  return (
    <div className="fx-course" style={{ '--course': course.color } as React.CSSProperties}>
      <div className="fx-course-glow" aria-hidden="true" />
      <div className="fx-page" style={{ position: 'relative' }}>
        <div className="fx-top has-back">
          <button type="button" className="fx-iconbtn is-solo" onClick={onBack} aria-label="Terug"><ChevronLeft size={26} /></button>
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</div>
            {course.code && <div className="fx-muted" style={{ fontSize: 14 }}>{course.code}</div>}
          </div>
          <div className="fx-pillbtns">
            <button type="button" className="fx-iconbtn" onClick={onEdit} aria-label="Vak bewerken"><Pencil size={20} /></button>
            <ActionMenu
              trigger={<button type="button" className="fx-iconbtn" aria-label="Meer"><MoreHorizontal size={22} /></button>}
              items={[
                { label: 'Studeer dit vak', onClick: onStudy },
                { label: 'Herinneringen', onClick: onReminders },
                { label: 'Cijfercalculator', onClick: onGrades },
                ...statusItems,
                { label: 'Vak verwijderen', danger: true, onClick: () => { if (window.confirm(`"${course.name}" verwijderen? Je sessies blijven bewaard, zonder vak.`)) { deleteCourse(course.id); onBack() } } },
              ]} />
          </div>
        </div>

        <div className="fx-cols"><div className="fx-col">
        {/* Aftellen + tijdlijn */}
        {next ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="tnum" style={{ fontSize: 34, fontWeight: 800 }}>{daysBetween(today, next.date)}</span>
              <span className="fx-overline" style={{ fontSize: 16, letterSpacing: '0.1em' }}>
                {daysBetween(today, next.date) === 1 ? 'dag' : 'dagen'} tot {next.title}
              </span>
            </div>
            {end && <Timeline start={start} end={end} today={today} marks={dates.map(d => d.date)} />}
          </div>
        ) : (
          <button type="button" className="fx-card is-pad" onClick={onReminders} style={{ width: '100%', marginTop: 14, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <GraduationCap size={26} color="var(--course)" />
            <span style={{ flex: 1 }}><b>Toetsdatum toevoegen</b><br /><span className="fx-muted" style={{ fontSize: 14 }}>Zie hoeveel dagen je nog hebt en krijg herinneringen</span></span>
            <ArrowRight size={20} />
          </button>
        )}

        {/* Vakstatistieken */}
        <div className="fx-section" style={{ marginTop: 26 }}>
          <h2 className="fx-h2" style={{ marginBottom: 12 }}>Vakstatistieken</h2>
          <div className="fx-record">
            <div><div className="fx-muted" style={{ fontSize: 14 }}>Persoonlijk record</div><b className="tnum">{stats.record ? fmtDur(stats.record.mins) : '–'}</b></div>
            <ArrowRight size={22} color="var(--course)" strokeWidth={3} />
            <div style={{ textAlign: 'right' }}><div className="fx-muted" style={{ fontSize: 14 }}>Gezet op</div><b>{stats.record ? fmtRecordDate(stats.record.date) : '–'}</b></div>
          </div>
          <div className="fx-tiles is-grid" style={{ marginTop: 10 }}>
            <button type="button" className="fx-tile is-pink is-link" onClick={() => setAllSess(true)}><b className="tnum">{stats.count ? fmtDur(stats.avgSession) : '–'}</b><span>Gem. sessie ›</span></button>
            <div className="fx-tile is-beige"><b className="tnum">{stats.count}</b><span>Sessies</span></div>
            <div className="fx-tile is-lav"><b className="tnum">{stats.avgRating != null ? fmtDec(stats.avgRating) : '–'}</b><span>Gem. score</span></div>
          </div>
        </div>

        {/* Sessie-verdeling */}
        <div className="fx-breakdown">
          <KindDonut data={kinds.map(k => ({ label: k.kind === 'other' ? 'Overig' : KIND_BY_ID[k.kind].label, color: k.kind === 'other' ? '#8E8E93' : KIND_BY_ID[k.kind].color, mins: k.mins }))}
            centerTop={fmtDur(stats.total)} centerBottom="totaal" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 10px' }}>Sessie-verdeling</h3>
            {kinds.length === 0 && <p className="fx-muted" style={{ margin: 0, fontSize: 14 }}>Kies bij het starten van de timer wat voor werk je doet.</p>}
            {kinds.map(k => {
              const meta = k.kind === 'other' ? { label: 'Overig', color: '#8E8E93' } : KIND_BY_ID[k.kind]
              return (
                <div key={k.kind} className="fx-legend-row">
                  <span><i style={{ background: meta.color }} />{meta.label}</span>
                  <span className="tnum fx-muted">{fmtDur(k.mins)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Onderwerpen */}
        <div className="fx-section">
          <button type="button" className="fx-section-head" onClick={() => setTopicsOpen(o => !o)} aria-expanded={topicsOpen}
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
            <h2 className="fx-h2">Bestudeerd ({topics.filter(t => (tmins[t.id] || 0) > 0).length})</h2>
            {topicsOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
          </button>
          {topicsOpen && (topics.length === 0
            ? <button type="button" className="fx-card is-pad fx-muted" onClick={onEdit} style={{ width: '100%', cursor: 'pointer', textAlign: 'center' }}>Voeg onderwerpen toe (bijv. hoofdstukken) om je voortgang per onderwerp te zien</button>
            : <div className="fx-topic-grid">{topics.map(t => <TopicRing key={t.id} name={t.name} mins={tmins[t.id] || 0} target={t.target_minutes} />)}</div>)}
        </div>

        {/* Belangrijke datums */}
        </div><div className="fx-col">
        <div className="fx-section fx-section--side">
          <div className="fx-section-head">
            <h2 className="fx-h2">Belangrijke datums</h2>
            <button type="button" className="fx-iconbtn is-solo" onClick={onReminders} aria-label="Herinneringen"><Bell size={20} /></button>
          </div>
          {dates.length === 0
            ? <button type="button" className="fx-card is-pad fx-muted" onClick={onReminders} style={{ width: '100%', cursor: 'pointer' }}>Nog geen datums. Tik om een toets toe te voegen.</button>
            : <div className="fx-card fx-list">{dates.map(d => (
                <div key={d.id} className="fx-date-row">
                  <span className="fx-datebadge"><small>{MONTHS_SHORT[parseDay(d.date).getMonth()]}</small><b>{parseDay(d.date).getDate()}</b></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 16 }}>{d.title}{d.is_final ? ' 🎓' : ''}</b>
                    <div className="fx-muted" style={{ fontSize: 14 }}>{fmtLongDate(d.date)}{d.date < today ? ' · voorbij' : ` · over ${daysBetween(today, d.date)} d`}</div>
                  </span>
                  {d.reminder_offsets?.length > 0 && <Bell size={16} color="var(--course)" aria-label="Herinnering aan" />}
                </div>
              ))}</div>}
        </div>

        {/* Cijfer */}
        <div className="fx-section">
          <button type="button" className="fx-card is-pad" onClick={onGrades} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Calculator size={26} color="var(--course)" />
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 17 }}>Cijfercalculator</b>
              <div className="fx-muted" style={{ fontSize: 14 }}>
                {grade?.needed != null
                  ? (grade.reachable ? `Je hebt een ${fmtDec(Math.max(1, grade.needed))} nodig op het tentamen voor een ${fmtDec(Number(course.target_grade))}` : `Een ${fmtDec(Number(course.target_grade))} is niet meer haalbaar`)
                  : 'Bereken welk cijfer je nodig hebt op je tentamen'}
              </div>
            </span>
            <ArrowRight size={20} />
          </button>
        </div>

        {/* Sessies van dit vak */}
        <div className="fx-section">
          <div className="fx-section-head">
            <h2 className="fx-h2">Sessies</h2>
            <button type="button" className="fx-btn is-primary" style={{ height: 40, fontSize: 15, padding: '0 16px' }} onClick={onStudy}><Play size={16} fill="currentColor" /> Studeer</button>
          </div>
          {sessions.length === 0
            ? <div className="fx-card fx-empty" style={{ padding: 24 }}>Nog geen sessies voor dit vak.</div>
            : <SessionList sessions={allSess ? sessions : sessions.slice(0, 5)} onOpen={onOpenSession}
                more={sessions.length > 5 ? { label: allSess ? 'Minder tonen' : `Alle ${sessions.length} sessies`, onClick: () => setAllSess(v => !v) } : undefined} />}
        </div>
        </div></div>
      </div>
    </div>
  )
}

function fmtRecordDate(iso: string) {
  const d = parseDay(iso)
  return `${fmtShortDate(iso)} ${d.getFullYear()}`
}

/** Tijdlijn van start tot eindtoets: gevuld tot vandaag, stippen op belangrijke datums */
function Timeline({ start, end, today, marks }: { start: string; end: string; today: string; marks: string[] }) {
  const span = Math.max(1, daysBetween(start, end))
  const pos = (d: string) => clamp(daysBetween(start, d) / span, 0, 1) * 100
  const now = pos(today)
  return (
    <div style={{ marginTop: 14 }}>
      <div className="fx-timeline">
        <span className="fx-timeline-fill" style={{ width: `${now}%` }} />
        {marks.map(m => <span key={m} className={`fx-timeline-mark${m <= today ? ' is-past' : ''}`} style={{ left: `${pos(m)}%` }} />)}
        <span className="fx-timeline-knob" style={{ left: `${now}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }} className="fx-faint">
        <span>{fmtShortDate(start)}</span><span>{fmtShortDate(end)}</span>
      </div>
    </div>
  )
}
