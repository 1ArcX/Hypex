import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
// ChevronLeft/Right kept for WeekStrip
import Timeline from '../components/Timeline'
import { useIsDesktop } from '../hooks/useIsDesktop'

// ─── helpers ─────────────────────────────────────────────────────────────────
const DAYS_SHORT = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO']
const MONTHS_NL  = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const MONTHS_S   = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(date) {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function pad2(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }

function getDayDensity(day, tasks, calendarEvents, magisterLessons) {
  const ds = toDateStr(day)
  let count = 0
  // Taken
  count += (tasks || []).filter(t => t.date === ds && !t.completed).length
  // Agenda-events
  count += (calendarEvents || []).filter(ev => {
    try {
      const startDs = toDateStr(new Date(ev.start_time))
      const endDs = toDateStr(new Date(ev.end_time))
      return ds >= startDs && ds <= endDs
    } catch { return false }
  }).length
  // Magister/SOMtoday lessen (alleen niet-geannuleerd)
  count += (magisterLessons || []).filter(l => {
    try {
      if (l.cancelled || l.uitgevallen) return false
      return toDateStr(new Date(l.start)) === ds
    } catch { return false }
  }).length
  return count
}

function densityColor(count) {
  if (count === 0) return 'transparent'
  if (count <= 2) return 'rgba(74,222,128,0.7)'   // groen
  if (count <= 4) return 'rgba(250,204,21,0.7)'    // geel
  return 'rgba(255,107,107,0.7)'                    // rood
}

// ─── Week strip (like the image) ─────────────────────────────────────────────
function WeekStrip({ selectedDay, onSelectDay, onPrevWeek, onNextWeek, tasks, calendarEvents, magisterLessons }) {
  const now = new Date()
  const weekDays = getWeekDays(selectedDay)
  const weekStart = weekDays[0]
  const weekEnd   = weekDays[6]

  const monthLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${MONTHS_NL[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${MONTHS_S[weekStart.getMonth()]} – ${MONTHS_S[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  const swipeStartX = React.useRef(null)
  const swipeStartY = React.useRef(null)
  const swipeIntent = React.useRef(null)

  const handleTouchStart = e => {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeIntent.current = null
  }
  const handleTouchMove = e => {
    if (swipeIntent.current === null) {
      const dx = Math.abs(e.touches[0].clientX - swipeStartX.current)
      const dy = Math.abs(e.touches[0].clientY - swipeStartY.current)
      if (dx < 6 && dy < 6) return
      swipeIntent.current = dx > dy ? 'h' : 'v'
    }
    if (swipeIntent.current === 'h') e.preventDefault()
  }
  const handleTouchEnd = e => {
    if (swipeIntent.current !== 'h' || swipeStartX.current === null) { swipeStartX.current = null; return }
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null; swipeIntent.current = null
    if (Math.abs(dx) < 40) return
    dx < 0 ? onNextWeek() : onPrevWeek()
  }

  return (
    <div
      style={{ flexShrink: 0, background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Month label + week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{monthLabel}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!weekDays.some(d => isSameDay(d, now)) && (
            <button
              onClick={() => { onSelectDay(now) }}
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 8, cursor: 'pointer', color: 'var(--accent)', padding: '3px 9px', fontSize: 11, fontWeight: 600 }}
            >
              Vandaag
            </button>
          )}
          <button onClick={onPrevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px 6px', borderRadius: 6 }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={onNextWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px 6px', borderRadius: 6 }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 8px 12px' }}>
        {weekDays.map((day, i) => {
          const isToday    = isSameDay(day, now)
          const isSelected = isSameDay(day, selectedDay)
          const density    = getDayDensity(day, tasks, calendarEvents, magisterLessons)

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}
            >
              {/* Weekday abbreviation */}
              <span style={{
                fontSize: 11, letterSpacing: '0.04em', fontWeight: 500, textTransform: 'uppercase',
                color: isToday ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {DAYS_SHORT[i]}
              </span>

              {/* Day number circle */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday
                  ? 'var(--accent)'
                  : isSelected && !isToday
                    ? 'var(--bg-card-2)'
                    : 'transparent',
                border: isSelected && !isToday ? '1px solid var(--border)' : 'none',
                color: isToday ? '#000' : isSelected ? 'var(--text-1)' : 'var(--text-2)',
                fontSize: 15, fontWeight: isToday || isSelected ? 600 : 400,
                transition: 'background 0.12s',
              }}>
                {day.getDate()}
              </div>

              {/* Density dot */}
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: densityColor(density),
                transition: 'background 0.2s',
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Month calendar ───────────────────────────────────────────────────────────
function MonthCalendar({ selectedDay, onSelectDay, tasks, calendarEvents, magisterLessons }) {
  const now = new Date()
  const scrollRef = React.useRef(null)
  const monthRefs = React.useRef({})

  // Render 25 months centered on selectedDay's month
  const months = React.useMemo(() => {
    const result = []
    for (let i = -12; i <= 12; i++) {
      result.push(new Date(selectedDay.getFullYear(), selectedDay.getMonth() + i, 1))
    }
    return result
  }, [selectedDay.getFullYear(), selectedDay.getMonth()])

  React.useLayoutEffect(() => {
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}`
    const el = monthRefs.current[key]
    if (el && scrollRef.current) el.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [selectedDay.getFullYear(), selectedDay.getMonth()])

  const renderMonth = (monthDate) => {
    const year  = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const key   = `${year}-${month}`

    const firstOfMonth = new Date(year, month, 1)
    const lastOfMonth  = new Date(year, month + 1, 0)
    const dow = firstOfMonth.getDay()
    const startPad = new Date(firstOfMonth)
    startPad.setDate(firstOfMonth.getDate() - (dow === 0 ? 6 : dow - 1))

    const cells = []
    const cursor = new Date(startPad)
    while (cells.length < 42 && (cursor <= lastOfMonth || cells.length % 7 !== 0)) {
      cells.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    return (
      <div key={key} ref={el => { monthRefs.current[key] = el }} style={{ flexShrink: 0, padding: '0 12px 16px' }}>
        {/* Month label */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', padding: '14px 0 6px', letterSpacing: '0.01em' }}>
          {MONTHS_NL[month]} {year}
        </div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', padding: '4px 0', fontWeight: 600, letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>
        {/* Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            const isToday    = isSameDay(day, now)
            const isSelected = isSameDay(day, selectedDay)
            const inMonth    = day.getMonth() === month
            const density    = getDayDensity(day, tasks, calendarEvents, magisterLessons)
            const dotColor   = densityColor(density)
            return (
              <div key={i} onClick={() => onSelectDay(day)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 38, borderRadius: 8, cursor: 'pointer', gap: 2,
                background: isToday ? 'var(--accent)' : isSelected && !isToday ? 'var(--bg-card-2)' : 'transparent',
                color: isToday ? '#000' : inMonth ? 'var(--text-1)' : 'var(--text-3)',
                fontSize: 14, fontWeight: isToday ? 700 : isSelected ? 600 : 400,
                border: isSelected && !isToday ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'background 0.12s', opacity: inMonth ? 1 : 0.35,
              }}>
                {day.getDate()}
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: density > 0 ? (isToday ? 'rgba(0,0,0,0.4)' : dotColor) : 'transparent', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {months.map(m => renderMonth(m))}
    </div>
  )
}

// ─── Main AgendaPage ──────────────────────────────────────────────────────────
export default function AgendaPage({
  userId, userEmail, tasks, subjects,
  calendarEvents, magisterLessons,
  onToggleTask, onEditTask, onViewDetail, isAdmin,
  onLessonsChange, onEventsChange, onMagisterError,
  jumpTo, onJumpHandled,
}) {
  const isDesktop = useIsDesktop()
  const today = new Date()
  const [mobileView, setMobileView] = useState('dag')          // 'dag' | 'maand'
  const [selectedDay, setSelectedDay] = useState(today)
  const [highlightKey, setHighlightKey] = useState(null)
  const handleSelectDay = (day) => {
    setSelectedDay(day)
    setMobileView('dag')
  }

  useEffect(() => {
    if (!jumpTo?.date) return
    setSelectedDay(jumpTo.date)
    setMobileView('dag')
    setHighlightKey(jumpTo.highlightKey || null)
    onJumpHandled?.()
    // Clear highlight after 3s
    const t = setTimeout(() => setHighlightKey(null), 3000)
    return () => clearTimeout(t)
  }, [jumpTo])

  const prevWeek = () => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const tabStyle = (active) => ({
    fontSize: 13, padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-2)',
    fontWeight: active ? 600 : 400, transition: 'all 0.12s',
  })

  return (
    <>
      {/* ── Desktop (md+): full Timeline ── */}
      <div className="hidden md:flex" style={{ height: '100%', flexDirection: 'column', padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>Agenda</h2>
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
            {isDesktop && (
              <Timeline
                userId={userId} userEmail={userEmail} tasks={tasks} subjects={subjects}
                onToggleTask={onToggleTask} onEditTask={onEditTask} onViewDetail={onViewDetail} isAdmin={isAdmin}
                onLessonsChange={onLessonsChange} onEventsChange={onEventsChange}
                onMagisterError={onMagisterError}
                highlightKey={highlightKey}
                initialDate={jumpTo?.date}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: week strip / month calendar ── */}
      <div className="md:hidden flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>

        {/* Toggle Maand | Dag */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Agenda</span>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-card-2)', borderRadius: 22, padding: 3, border: '1px solid var(--border)' }}>
            <button style={tabStyle(mobileView === 'maand')} onClick={() => setMobileView('maand')}>Maand</button>
            <button style={tabStyle(mobileView === 'dag')}   onClick={() => setMobileView('dag')}>Dag</button>
          </div>
        </div>

        {/* ── Dag view ── */}
        {mobileView === 'dag' && (
          <>
            <WeekStrip
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              tasks={tasks}
              calendarEvents={calendarEvents}
              magisterLessons={magisterLessons}
            />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Timeline
                key={selectedDay.toDateString()}
                userId={userId} userEmail={userEmail} tasks={tasks} subjects={subjects}
                onToggleTask={onToggleTask} onEditTask={onEditTask} onViewDetail={onViewDetail} isAdmin={isAdmin}
                onLessonsChange={onLessonsChange} onEventsChange={onEventsChange}
                onMagisterError={onMagisterError}
                defaultView="day"
                initialDate={selectedDay}
                isMobile
                hideToolbar
                onDateChange={day => setSelectedDay(day)}
                highlightKey={highlightKey}
              />
            </div>
          </>
        )}

        {/* ── Maand view ── */}
        {mobileView === 'maand' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <MonthCalendar
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              tasks={tasks}
              calendarEvents={calendarEvents}
              magisterLessons={magisterLessons}
            />
          </div>
        )}
      </div>
    </>
  )
}
