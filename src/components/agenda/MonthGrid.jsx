import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { taskOnDay, isMultiDay } from '../../utils/taskStatus'
import { taskCategory, eventCategory, categoryColor } from '../../utils/category'
import { eventDisplay } from '../../utils/eventTitle'
import { daypartEmoji } from '../../utils/daypart'

const DAYPART_SORT = { ochtend: 8 * 60, middag: 12 * 60, avond: 17 * 60 }

// Maandweergave in de stijl van Apple/iCloud Agenda (mobiel): maanden onder elkaar, per dag
// gekleurde blokjes, meerdaagse items als doorlopende balk. Het dunne balkje rechts (of Ctrl+scroll)
// zoomt tussen alleen stipjes en grote vakken met tijden.

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const WEEKDAYS = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']
const MIN_H = 52, MAX_H = 210, DEFAULT_H = 112
const NUM_H = 26     // hoogte van de dagnummer-regel
const LINE = 16      // hoogte van één blokje/balk (incl. ruimte)
const ZOOM_KEY = 'agenda_month_zoom'
const RAIL_GUTTER = 14 // vrije marge rechts voor de zoombalk

const pad = n => String(n).padStart(2, '0')
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const isAllDay = (s, e) => s.getHours() === 0 && s.getMinutes() === 0 && (e - s >= 23 * 3600000)

// Herhaling van eigen agenda-items (zelfde regels als Timeline/AgendaList)
function recurringOn(ev, date) {
  const start = new Date(ev.start_time)
  const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  if (date < startD) return false
  const r = ev.recurrence
  if (r === 'daily') return true
  if (r === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5
  if (r === 'weekly') return ev.recurrence_days?.includes(date.getDay())
  if (r === 'biweekly') {
    const days = ev.recurrence_days?.length ? ev.recurrence_days : [start.getDay()]
    if (!days.includes(date.getDay())) return false
    return Math.round((mondayOf(date) - mondayOf(startD)) / (7 * 86400000)) % 2 === 0
  }
  if (r === 'monthly') return start.getDate() === date.getDate()
  if (r === 'yearly') return start.getMonth() === date.getMonth() && start.getDate() === date.getDate()
  return false
}

/** Alle items in [from, to] als { singles: Map(dag → items), spans: [...] }. */
function buildIndex({ from, to, tasks, calendarEvents, magisterLessons }) {
  const singles = new Map()
  const spans = []
  const add = (day, item) => { const k = ds(day); if (!singles.has(k)) singles.set(k, []); singles.get(k).push(item) }
  const inRange = d => d >= from && d <= to

  for (const ev of calendarEvents || []) {
    if (ev.hidden) continue
    const s = new Date(ev.start_time), e = new Date(ev.end_time)
    if (Number.isNaN(+s)) continue
    const work = ev.description?.startsWith('pmt:')
    const color = work ? categoryColor('werk') : categoryColor(eventCategory(ev))
    const title = work ? 'Werk' : eventDisplay(ev).title
    const allDay = !!ev.all_day || isAllDay(s, e)
    const base = { key: `ev-${ev.id}`, title, color, time: allDay ? null : hhmm(s), sort: allDay ? -1 : s.getHours() * 60 + s.getMinutes() }
    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate()), ed = new Date(e.getFullYear(), e.getMonth(), e.getDate())
    if (!ev.recurrence && ed > sd) {
      if (ed >= from && sd <= to) spans.push({ ...base, from: sd, to: ed })
      continue
    }
    if (inRange(sd)) add(sd, base)
    if (ev.recurrence) for (let d = addDays(sd > from ? sd : from, sd >= from ? 1 : 0); d <= to; d = addDays(d, 1)) if (recurringOn(ev, d)) add(d, { ...base, key: `${base.key}-${ds(d)}` })
  }

  for (const les of magisterLessons || []) {
    if (!les.start || les.uitgevallen || les.cancelled) continue
    const s = new Date(les.start)
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate())
    if (inRange(d)) add(d, { key: `les-${les.start}-${les.vak || les.title}`, title: les.vak || les.description || les.title || 'Les', color: categoryColor('school'), time: hhmm(s), sort: s.getHours() * 60 + s.getMinutes() })
  }

  try {
    for (const sh of JSON.parse(localStorage.getItem('pmt_work_shifts')) || []) {
      if (!sh.date) continue
      const d = new Date(sh.date.slice(0, 10) + 'T00:00:00')
      const t = sh.start || sh.start_time
      if (inRange(d)) add(d, { key: `work-${sh.date}-${t}`, title: 'Werk', color: categoryColor('werk'), time: t?.slice(0, 5) || null, sort: t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0 })
    }
  } catch { /* geen diensten */ }

  for (const t of tasks || []) {
    if (!t.recurrence && t.completed) continue
    const color = categoryColor(taskCategory(t))
    const time = t.start_time || t.time || null
    // Dagdeel zonder tijd: emoji ervoor en sorteren op het begin van het dagdeel
    const dp = !time && DAYPART_SORT[t.daypart] != null ? t.daypart : null
    const base = {
      key: `task-${t.id}`, title: `${t.recurrence ? '🔁 ' : ''}${dp ? `${daypartEmoji(dp)} ` : ''}${t.title}`, color, time: time?.slice(0, 5) || null,
      sort: time ? +time.slice(0, 2) * 60 + +time.slice(3, 5) : dp ? DAYPART_SORT[dp] : 2000 + (t.recurrence ? 1 : 0),
    }
    if (isMultiDay(t)) {
      const sd = new Date(t.date + 'T00:00:00'), ed = new Date(t.end_date + 'T00:00:00')
      if (ed >= from && sd <= to) spans.push({ ...base, from: sd, to: ed })
      continue
    }
    if (t.recurrence) {
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) if (taskOnDay(t, ds(d))) add(d, { ...base, key: `${base.key}-${ds(d)}` })
    } else if (t.date) {
      const d = new Date(t.date + 'T00:00:00')
      if (inRange(d)) add(d, base)
    }
  }

  for (const list of singles.values()) list.sort((a, b) => a.sort - b.sort)
  return { singles, spans }
}

function readZoom() { try { const v = +localStorage.getItem(ZOOM_KEY); return v >= MIN_H && v <= MAX_H ? v : DEFAULT_H } catch { return DEFAULT_H } }

export default function MonthGrid({ selectedDay, onSelectDay, tasks, calendarEvents, magisterLessons }) {
  const now = new Date()
  const scrollRef = useRef(null)
  const monthRefs = useRef({})
  const [rowH, setRowH] = useState(readZoom)
  const prevH = useRef(rowH)
  const zoomCenter = useRef(null) // y binnen de scroller waar omheen gezoomd wordt

  // Bereik: 6 maanden terug, 12 vooruit rond de gekozen dag
  const anchorKey = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}`
  const months = useMemo(() => Array.from({ length: 19 }, (_, i) => new Date(selectedDay.getFullYear(), selectedDay.getMonth() - 6 + i, 1)), [anchorKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const from = months[0], to = new Date(months[18].getFullYear(), months[18].getMonth() + 1, 0)
  const index = useMemo(() => buildIndex({ from, to, tasks, calendarEvents, magisterLessons }), [anchorKey, tasks, calendarEvents, magisterLessons]) // eslint-disable-line react-hooks/exhaustive-deps

  // Naar de maand van de gekozen dag
  useLayoutEffect(() => {
    const el = monthRefs.current[anchorKey]
    if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 30
  }, [anchorKey])

  // Zoomen: hetzelfde punt onder je vingers houden
  useLayoutEffect(() => {
    const el = scrollRef.current
    const k = rowH / prevH.current
    if (el && k !== 1) {
      const cy = zoomCenter.current ?? el.clientHeight / 2
      el.scrollTop = (el.scrollTop + cy) * k - cy
    }
    prevH.current = rowH
    try { localStorage.setItem(ZOOM_KEY, String(Math.round(rowH))) } catch { /* ok */ }
  }, [rowH])

  const zoomTo = (h, cy) => { zoomCenter.current = cy ?? null; setRowH(Math.min(MAX_H, Math.max(MIN_H, h))) }

  // Ctrl+scroll (muis/trackpad) zoomt ook — niet-passief zodat de browser niet de pagina zoomt
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = e => { if (!e.ctrlKey) return; e.preventDefault(); zoomTo(prevH.current * Math.exp(-e.deltaY / 300), e.clientY - el.getBoundingClientRect().top) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const dots = rowH < 70
  const showTime = rowH >= 140
  const scrollToToday = () => {
    const el = monthRefs.current[`${now.getFullYear()}-${now.getMonth()}`]
    if (el) scrollRef.current?.scrollTo({ top: el.offsetTop - 30, behavior: 'smooth' })
    else onSelectDay(now)
  }

  const renderWeek = (monday, month) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    const inMonth = d => d.getMonth() === month
    // Balken (meerdaagse items) die deze week raken, in banen
    const segs = index.spans
      .filter(sp => sp.to >= days[0] && sp.from <= days[6])
      .map(sp => {
        const s = Math.max(0, Math.round((sp.from - days[0]) / 86400000)), e = Math.min(6, Math.round((sp.to - days[0]) / 86400000))
        return { ...sp, s, e }
      })
      .filter(sg => days.slice(sg.s, sg.e + 1).some(inMonth))
      .sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s))
    const laneEnds = []
    for (const sg of segs) {
      let lane = laneEnds.findIndex(end => end < sg.s)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(sg.e) } else laneEnds[lane] = sg.e
      sg.lane = lane
    }
    const capacity = Math.max(0, Math.floor((rowH - NUM_H - 4) / LINE))
    const lanesShown = dots ? 0 : Math.min(laneEnds.length, capacity)

    return (
      <div key={+monday} style={{ position: 'relative', height: rowH, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: '1px solid var(--c-border)' }}>
        {days.map((d, i) => {
          if (!inMonth(d)) return <div key={i} />
          const today = sameDay(d, now)
          const weekend = i >= 5
          const items = index.singles.get(ds(d)) || []
          // Hoeveel balken liggen er op deze dag (ruimte die al bezet is)
          const busyLanes = segs.filter(sg => sg.lane < lanesShown && sg.s <= i && sg.e >= i).reduce((m, sg) => Math.max(m, sg.lane + 1), 0)
          const free = Math.max(0, capacity - busyLanes)
          const hiddenSpans = segs.filter(sg => sg.lane >= lanesShown && sg.s <= i && sg.e >= i).length
          const total = items.length + hiddenSpans
          // Op hoogte vullen: met tijden ingezoomd is een getimed blokje twee regels hoog
          const chipH = it => (showTime && it.time ? 2 * LINE - 2 : LINE)
          let space = free * LINE, fit = 0
          for (const it of items) {
            const rest = total - fit - 1 > 0 ? LINE : 0 // ruimte voor "+N" als er nog meer komt
            if (chipH(it) + rest > space) break
            space -= chipH(it); fit++
          }
          const more = total - fit
          return (
            <button key={i} type="button" onClick={() => onSelectDay(d)}
              aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}${total ? `, ${total} items` : ''}`}
              style={{ position: 'relative', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', minWidth: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <span style={{ height: NUM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="tnum" style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: today ? 700 : 500,
                  background: today ? 'var(--accent)' : sameDay(d, selectedDay) ? 'var(--c-surface-3)' : 'transparent',
                  color: today ? 'var(--on-accent)' : weekend ? 'var(--c-text-3)' : 'var(--c-text)',
                }}>{d.getDate()}</span>
              </span>
              {dots ? (
                <span style={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap', padding: '0 4px' }}>
                  {[...segs.filter(sg => sg.s <= i && sg.e >= i), ...items].slice(0, 4).map(it => (
                    <span key={it.key} style={{ width: 5, height: 5, borderRadius: '50%', background: it.color }} />
                  ))}
                </span>
              ) : (
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: `${Math.max(busyLanes, 0) * LINE}px 2px 0`, minWidth: 0 }}>
                  {items.slice(0, fit).map(it => (
                    <span key={it.key} style={{
                      display: 'block', height: chipH(it) - 2, lineHeight: `${LINE - 2}px`, borderRadius: 4, padding: '0 4px',
                      fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip',
                      background: `color-mix(in srgb, ${it.color} 30%, var(--c-surface-solid))`, color: `color-mix(in srgb, ${it.color} 55%, white)`,
                    }}>
                      {it.title}
                      {showTime && it.time && <span style={{ display: 'block', fontSize: 9.5, fontWeight: 500, opacity: 0.75, lineHeight: '12px' }}>{it.time}</span>}
                    </span>
                  ))}
                  {more > 0 && <span style={{ fontSize: 10, color: 'var(--c-text-3)', paddingLeft: 4, height: LINE - 2, lineHeight: `${LINE - 2}px` }}>+{more}</span>}
                </span>
              )}
            </button>
          )
        })}
        {/* Doorlopende balken over de dagen heen */}
        {segs.filter(sg => sg.lane < lanesShown).map(sg => {
          let s = sg.s, e = sg.e
          while (!inMonth(days[s])) s++
          while (!inMonth(days[e])) e--
          const cutL = sg.from < days[s], cutR = sg.to > days[e]
          return (
            <span key={`${sg.key}-${+monday}`} aria-hidden="true" style={{
              position: 'absolute', top: NUM_H + sg.lane * LINE, height: LINE - 2, lineHeight: `${LINE - 2}px`,
              left: `calc(${(s / 7) * 100}% + 2px)`, width: `calc(${((e - s + 1) / 7) * 100}% - 4px)`,
              borderRadius: `${cutL ? 0 : 4}px ${cutR ? 0 : 4}px ${cutR ? 0 : 4}px ${cutL ? 0 : 4}px`,
              background: `color-mix(in srgb, ${sg.color} 45%, var(--c-surface-solid))`, color: `color-mix(in srgb, ${sg.color} 30%, white)`,
              fontSize: 10.5, fontWeight: 700, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none',
            }}>{sg.title}</span>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Weekdagen + zoom */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', padding: `6px ${RAIL_GUTTER}px 4px 0`, borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-solid)' }}>
        {WEEKDAYS.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: i >= 5 ? 'var(--c-text-3)' : 'var(--c-text-2)' }}>{w}</span>)}
      </div>
      <div ref={scrollRef} className="mini-month-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 90, paddingRight: RAIL_GUTTER, scrollbarWidth: 'none' }}>
        {months.map(m => {
          const y = m.getFullYear(), mo = m.getMonth()
          const weeks = []
          for (let d = mondayOf(m); d.getMonth() === mo || d < m; d = addDays(d, 7)) weeks.push(d)
          return (
            <section key={`${y}-${mo}`} ref={el => { monthRefs.current[`${y}-${mo}`] = el }}>
              <h3 style={{ margin: 0, padding: '18px 14px 8px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: y === now.getFullYear() && mo === now.getMonth() ? 'var(--accent)' : 'var(--c-text)' }}>
                {MONTHS[mo]}{y !== now.getFullYear() ? <span style={{ fontWeight: 600, color: 'var(--c-text-3)', fontSize: 18 }}> {y}</span> : null}
              </h3>
              {weeks.map(w => renderWeek(w, mo))}
            </section>
          )
        })}
      </div>
      {/* Zoombalk rechts (in de marge naast zondag) */}
      <ZoomRail value={rowH} onChange={h => zoomTo(h)} />
      {/* Vandaag */}
      <div style={{ position: 'absolute', right: 22, bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={scrollToToday} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 13, borderRadius: 20, background: 'var(--c-surface-solid)', boxShadow: 'var(--shadow-float)' }}>Vandaag</button>
      </div>
    </div>
  )
}

/** Dun, verticaal zoombalkje: omhoog = inzoomen. In rust bijna onzichtbaar, tijdens slepen helder. */
function ZoomRail({ value, onChange }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(false)
  const TRACK = 150
  const frac = (value - MIN_H) / (MAX_H - MIN_H)
  const fromY = (clientY) => {
    const r = trackRef.current.getBoundingClientRect()
    const f = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    onChange(MIN_H + f * (MAX_H - MIN_H))
  }
  const onDown = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setActive(true)
    fromY(e.clientY)
  }
  const onMove = (e) => { if (active) fromY(e.clientY) }
  const onUp = () => setActive(false)
  const onKey = (e) => {
    const step = (MAX_H - MIN_H) / 10
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(MAX_H, value + step)) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(MIN_H, value - step)) }
  }
  return (
    <div role="slider" aria-label="Zoom maandweergave" aria-orientation="vertical" tabIndex={0}
      aria-valuemin={MIN_H} aria-valuemax={MAX_H} aria-valuenow={Math.round(value)}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
      style={{
        position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: RAIL_GUTTER + 8, height: TRACK + 28,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0',
        touchAction: 'none', cursor: 'ns-resize', zIndex: 5, outline: 'none',
        opacity: active ? 1 : 0.45, transition: 'opacity 0.25s',
      }}>
      <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1, color: 'var(--c-text-3)', userSelect: 'none' }}>+</span>
      <div ref={trackRef} style={{ position: 'relative', width: 3, height: TRACK, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${frac * 100}%`, borderRadius: 2, background: 'color-mix(in srgb, var(--accent) 55%, transparent)' }} />
        <div style={{
          position: 'absolute', left: '50%', top: `${(1 - frac) * 100}%`, transform: 'translate(-50%, -50%)',
          width: active ? 12 : 9, height: active ? 22 : 18, borderRadius: 6,
          background: active ? 'var(--accent)' : 'var(--c-text-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          transition: 'width 0.15s, height 0.15s, background 0.15s',
        }} />
      </div>
      <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1, color: 'var(--c-text-3)', userSelect: 'none' }}>−</span>
    </div>
  )
}
