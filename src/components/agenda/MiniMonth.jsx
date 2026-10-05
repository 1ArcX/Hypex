import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../ui'

// Doorlopende mini-kalender in de agenda-rail: weken onder elkaar, maanden lopen in elkaar over
// (zo zie je ook de dagen van vorige/volgende maand). De titel volgt de maand die in beeld is;
// ‹ › scrollen een maand en verplaatsen ook de agenda. Weeknummer links, klik = naar die week.

const MONTHS_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const ROW = 26           // rijhoogte (24) + gap (2)
const VISIBLE = 6        // zichtbare weken
const BEFORE = 26, AFTER = 60 // weken vóór/na het anker

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
}

/**
 * @param current  datum die de agenda toont
 * @param inView   (date) => boolean — valt de dag in de huidige agenda-weergave
 * @param onPick   (date) => void — naar die datum/week gaan
 */
export default function MiniMonth({ current, inView, onPick }) {
  const now = new Date()
  const scrollRef = useRef(null)
  const [anchor, setAnchor] = useState(() => mondayOf(current))
  const weeks = useMemo(() => {
    const start = addDays(anchor, -BEFORE * 7)
    return Array.from({ length: BEFORE + AFTER }, (_, i) => addDays(start, i * 7))
  }, [anchor])
  const [focus, setFocus] = useState({ y: current.getFullYear(), m: current.getMonth() })

  const rowOf = (date) => Math.round((mondayOf(date) - weeks[0]) / (7 * 86400000))
  const scrollToRow = (row, smooth) => scrollRef.current?.scrollTo({ top: Math.max(0, row * ROW), behavior: smooth ? 'smooth' : 'auto' })
  const scrollToMonth = (y, m, smooth) => scrollToRow(rowOf(new Date(y, m, 1)), smooth)

  // Agenda verspringt naar een datum buiten beeld → mini-kalender schuift mee
  useLayoutEffect(() => {
    const row = rowOf(current)
    if (row < 2 || row > weeks.length - VISIBLE - 2) { setAnchor(mondayOf(current)); return }
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop / ROW
    if (row < top || row > top + VISIBLE - 1) scrollToMonth(current.getFullYear(), current.getMonth(), el.scrollTop > 0)
  }, [current, weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eerste keer: begin bij de week van de 1e van de maand
  useLayoutEffect(() => { scrollToMonth(current.getFullYear(), current.getMonth(), false) }, [anchor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Titel = maand van de week die (ongeveer) midden in beeld staat
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const row = Math.min(weeks.length - 1, Math.floor(el.scrollTop / ROW + VISIBLE / 2 - 0.5))
    const thu = addDays(weeks[row], 3)
    setFocus(f => (f.y === thu.getFullYear() && f.m === thu.getMonth()) ? f : { y: thu.getFullYear(), m: thu.getMonth() })
  }
  useEffect(onScroll, [weeks]) // eslint-disable-line react-hooks/exhaustive-deps

  const shiftMonth = (dir) => {
    const d = new Date(focus.y, focus.m + dir, 1)
    scrollToMonth(d.getFullYear(), d.getMonth(), true)
    onPick(d)
  }

  const grid = { display: 'grid', gridTemplateColumns: '18px repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center' }
  return (
    <div className="card glow-card" style={{ '--glow': 'var(--cat-persoonlijk)', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <p className="t-card" aria-live="polite" style={{ margin: 0, flex: 1, textTransform: 'capitalize' }}>{MONTHS_FULL[focus.m]} {focus.y}</p>
        <IconButton icon={ChevronLeft} label="Vorige maand" size={24} iconSize={13} onClick={() => shiftMonth(-1)} />
        <IconButton icon={ChevronRight} label="Volgende maand" size={24} iconSize={13} onClick={() => shiftMonth(1)} />
      </div>
      <div style={{ ...grid, marginBottom: 2 }}>
        <span className="t-meta" style={{ fontSize: 9, opacity: 0.7 }} title="Weeknummer">wk</span>
        {['M', 'D', 'W', 'D', 'V', 'Z', 'Z'].map((d, i) => <span key={i} className="t-meta" style={{ fontSize: 10 }}>{d}</span>)}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="mini-month-scroll"
        style={{ height: VISIBLE * ROW - 2, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none' }}>
        <div style={grid}>
          {weeks.flatMap((monday) => {
            const wk = isoWeek(monday)
            const thisWeek = sameDay(monday, mondayOf(now))
            const out = [
              <button key={`wk-${+monday}`} type="button" onClick={() => onPick(monday)}
                aria-label={`Week ${wk}`} title={`Week ${wk}`} className="tnum"
                style={{ height: 24, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 9, fontWeight: thisWeek ? 700 : 500,
                  color: thisWeek ? 'var(--accent)' : 'var(--c-text-3)', opacity: thisWeek ? 1 : 0.75 }}>
                {wk}
              </button>,
            ]
            for (let i = 0; i < 7; i++) {
              const d = addDays(monday, i)
              const today = sameDay(d, now)
              const sel = inView(d)
              const inFocus = d.getFullYear() === focus.y && d.getMonth() === focus.m
              const first = d.getDate() === 1
              out.push(
                <button key={+d} type="button" onClick={() => onPick(d)}
                  aria-label={`${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`} aria-current={today ? 'date' : undefined}
                  className="tnum"
                  style={{
                    height: 24, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: today ? 'var(--accent)' : sel ? 'var(--accent-soft)' : 'transparent',
                    color: today ? 'var(--on-accent)' : sel ? 'var(--accent)' : inFocus ? 'var(--c-text-2)' : 'var(--c-text-3)',
                    opacity: today || sel || inFocus ? 1 : 0.55,
                    fontWeight: today || sel || first ? 700 : 400,
                    transition: 'color 0.15s, opacity 0.15s',
                  }}>
                  {d.getDate()}
                  {first && <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.02em', marginTop: 1, opacity: 0.85 }}>{MONTHS_SHORT[d.getMonth()]}</span>}
                </button>
              )
            }
            return out
          })}
        </div>
      </div>
    </div>
  )
}
