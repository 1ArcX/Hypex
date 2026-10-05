import React, { useState, useEffect } from 'react'
import { taskOnDay } from '../utils/taskStatus'
import { ChevronLeft, ChevronRight } from 'lucide-react'
// ChevronLeft/Right kept for WeekStrip
import Timeline from '../components/Timeline'
import AgendaList from '../components/AgendaList'
import WeekStrip, { getDayDensity, densityColor } from '../components/agenda/WeekStrip'
import { useIsDesktop } from '../hooks/useIsDesktop'

const GLASS_BAR = 'rgba(255,255,255,0.03)'

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
    navigator.vibrate?.(10)
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
    fontSize: 12, padding: '4px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-2)',
    fontWeight: active ? 600 : 400, transition: 'all 0.12s',
  })

  return (
    <>
      {/* ── Desktop (md+): full Timeline ── */}
      <div className="hidden md:flex" style={{ height: '100%', flexDirection: 'column', padding: '24px 28px' }}>
        <h1 className="t-page" style={{ margin: '0 0 16px', flexShrink: 0 }}>Agenda</h1>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
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

        {/* Toggle Dag | Lijst | Maand — compact, geen dubbele titel (globale header toont al "Agenda") */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 12px', background: GLASS_BAR, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 2, border: '1px solid var(--border)' }}>
            <button style={tabStyle(mobileView === 'dag')}   onClick={() => setMobileView('dag')}>Dag</button>
            <button style={tabStyle(mobileView === 'lijst')} onClick={() => setMobileView('lijst')}>Lijst</button>
            <button style={tabStyle(mobileView === 'maand')} onClick={() => setMobileView('maand')}>Maand</button>
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

        {/* ── Lijst view ── */}
        {mobileView === 'lijst' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AgendaList
              tasks={tasks}
              subjects={subjects}
              calendarEvents={calendarEvents}
              magisterLessons={magisterLessons}
              onOpenDay={handleSelectDay}
              onToggleTask={onToggleTask}
              onViewDetail={onViewDetail}
            />
          </div>
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
