import { useMemo, useState, type CSSProperties } from 'react'
import { BookOpen, ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { courseTotals } from '../lib/stats'
import { fmtHours } from '../lib/format'
import { STATUSES } from '../lib/meta'
import { ActionMenu, useFxLayout } from '../components/ui'
import type { Course, CourseStatus } from '../types'

const LS_FILTER = 'focus_course_filter'

export function CoursesView({ onOpenCourse, onNewCourse, onAddSession, onShowInsights }: {
  onOpenCourse: (id: string) => void
  onNewCourse: () => void
  onAddSession: () => void
  onShowInsights: () => void
}) {
  const courses = useFocusStore(s => s.courses)
  const sessions = useFocusStore(s => s.sessions)
  const [filter, setFilterState] = useState<CourseStatus>(() => { try { return (localStorage.getItem(LS_FILTER) as CourseStatus) || 'active' } catch { return 'active' } })
  const setFilter = (f: CourseStatus) => { setFilterState(f); try { localStorage.setItem(LS_FILTER, f) } catch { /* */ } }
  const totals = useMemo(() => courseTotals(sessions), [sessions])
  const shown = courses.filter(c => c.status === filter)
  const total = shown.reduce((a, c) => a + (totals[c.id] || 0), 0)

  return (
    <div className="fx-page">
      <div className="fx-top">
        <div className="fx-pillbtns">
          <button type="button" className="fx-iconbtn" onClick={onNewCourse} aria-label="Nieuw vak"><Plus size={24} /></button>
          <ActionMenu
            trigger={<button type="button" className="fx-iconbtn" aria-label="Meer"><MoreHorizontal size={22} /></button>}
            items={[{ label: 'Nieuw vak', onClick: onNewCourse }, { label: 'Sessie toevoegen', onClick: onAddSession }]} />
        </div>
      </div>
      <h1 className="fx-h1">Vakken</h1>

      <div className="fx-chip-row" role="tablist" aria-label="Status">
        {STATUSES.map(st => {
          const n = courses.filter(c => c.status === st.id).length
          return (
            <button key={st.id} type="button" role="tab" aria-selected={filter === st.id} className={`fx-chip${filter === st.id ? ' is-active' : ''}`} onClick={() => setFilter(st.id)}>
              {st.label} <span className="fx-count tnum">{n}</span>
            </button>
          )
        })}
      </div>

      {shown.length > 0 && (
        <>
          <button type="button" onClick={onShowInsights} style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '22px 0 10px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <span className="tnum" style={{ fontSize: 30, fontWeight: 800 }}>{fmtHours(total)}</span>
            <span className="fx-label">totaal</span>
            <ChevronRight size={20} color="var(--fx-text-3)" style={{ alignSelf: 'center' }} />
          </button>
          <div style={{ display: 'flex', gap: 3, height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--fx-line)' }} aria-hidden="true">
            {shown.map(c => (totals[c.id] || 0) > 0 && <span key={c.id} style={{ flex: totals[c.id], background: c.color, borderRadius: 6 }} />)}
          </div>
        </>
      )}

      {shown.length === 0 ? (
        <div className="fx-empty">
          <BookOpen size={44} color="var(--fx-orange)" />
          <h3>{filter === 'active' ? 'Nog geen vakken' : `Geen ${STATUSES.find(s => s.id === filter)!.label.toLowerCase()} vakken`}</h3>
          {filter === 'active' && <>
            <p style={{ margin: '0 0 18px' }}>Maak een vak aan om je studietijd per vak, onderwerp en toets bij te houden.</p>
            <button type="button" className="fx-btn is-primary" onClick={onNewCourse}><Plus size={20} /> Vak toevoegen</button>
          </>}
        </div>
      ) : (
        <Bookshelf courses={shown} totals={totals} onOpen={onOpenCourse} />
      )}
    </div>
  )
}

/** Boekenplank: elk vak een boek in de vakkleur met de code op de rug en de uren onderaan */
function Bookshelf({ courses, totals, onOpen }: { courses: Course[]; totals: Record<string, number>; onOpen: (id: string) => void }) {
  const { desktop } = useFxLayout()
  const PER_SHELF = desktop ? 9 : 5
  const max = Math.max(...courses.map(c => totals[c.id] || 0), 1)
  const shelves: Course[][] = []
  for (let i = 0; i < courses.length; i += PER_SHELF) shelves.push(courses.slice(i, i + PER_SHELF))
  return (
    <div style={{ marginTop: 34 }}>
      {shelves.map((row, si) => (
        <div key={si} className="fx-shelf">
          <div className="fx-shelf-books">
            {row.map((c, i) => {
              const mins = totals[c.id] || 0
              const h = 250 + Math.round((mins / max) * 50)
              const lean = i === row.length - 1 && row.length < PER_SHELF
              const [a, b] = splitCode(c)
              return (
                <button key={c.id} type="button" className={`fx-book${lean ? ' is-lean' : ''}`} onClick={() => onOpen(c.id)}
                  style={{ '--book': c.color, height: h } as CSSProperties} aria-label={`${c.name}, ${fmtHours(mins)}`}>
                  <span className="fx-book-ribbon" aria-hidden="true" />
                  <span className="fx-book-lines top" aria-hidden="true" />
                  <span className="fx-book-title">{a}{b && <><br />{b}</>}</span>
                  <span className="fx-book-lines bottom" aria-hidden="true" />
                  <span className="fx-book-hours tnum">{fmtHours(mins)}</span>
                </button>
              )
            })}
          </div>
          <div className="fx-shelf-board" aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

function splitCode(c: Course): [string, string] {
  const src = (c.code || c.name).trim()
  const m = src.match(/^([A-Za-z]+)\s*([\d\w-]+)$/)
  if (c.code && m) return [m[1].toUpperCase(), m[2]]
  const words = src.split(/\s+/)
  if (words.length > 1) return [words[0], words.slice(1).join(' ')]
  return [src, '']
}
