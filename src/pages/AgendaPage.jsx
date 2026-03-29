import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Timeline from '../components/Timeline'

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
    try { return new Date(ev.start_time).toISOString().slice(0, 10) === ds } catch { return false }
  }).length
  // Magister lessen
  count += (magisterLessons || []).filter(l => {
    try { return new Date(l.start).toISOString().slice(0, 10) === ds } catch { return false }
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

  return (
    <div style={{ flexShrink: 0, background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
      {/* Month label + week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{monthLabel}</span>
        <div style={{ display: 'flex', gap: 4 }}>
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
function MonthCalendar({ selectedDay, onSelectDay }) {
  const now   = new Date()
  const year  = selectedDay.getFullYear()
  const month = selectedDay.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth  = new Date(year, month + 1, 0)

  // Pad to Monday
  const startPad = new Date(firstOfMonth)
  const dow = firstOfMonth.getDay()
  startPad.setDate(firstOfMonth.getDate() - (dow === 0 ? 6 : dow - 1))

  const cells = []
  const cursor = new Date(startPad)
  while (cells.length < 42 && (cursor <= lastOfMonth || cells.length % 7 !== 0)) {
    cells.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', padding: '6px 0', fontWeight: 600, letterSpacing: '0.04em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          const isToday    = isSameDay(day, now)
          const isSelected = isSameDay(day, selectedDay)
          const inMonth    = day.getMonth() === month

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 38, borderRadius: 8, cursor: 'pointer',
                background: isToday
                  ? 'var(--accent)'
                  : isSelected && !isToday ? 'var(--bg-card-2)' : 'transparent',
                color: isToday ? '#000' : inMonth ? 'var(--text-1)' : 'var(--text-3)',
                fontSize: 14, fontWeight: isToday ? 700 : isSelected ? 600 : 400,
                border: isSelected && !isToday ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'background 0.12s',
              }}
            >
              {day.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main AgendaPage ──────────────────────────────────────────────────────────
export default function AgendaPage({
  userId, tasks, subjects,
  calendarEvents, magisterLessons,
  onToggleTask, onEditTask, isAdmin,
  onLessonsChange, onEventsChange, onMagisterError,
}) {
  const today = new Date()
  const [mobileView, setMobileView] = useState('dag')          // 'dag' | 'maand'
  const [selectedDay, setSelectedDay] = useState(today)
  const [monthAnchor, setMonthAnchor] = useState(today)        // for month nav

  const handleSelectDay = (day) => {
    setSelectedDay(day)
    setMonthAnchor(day)
    setMobileView('dag')
  }

  const prevWeek = () => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  const nextWeek = () => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })

  const prevMonth = () => setMonthAnchor(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  const nextMonth = () => setMonthAnchor(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })

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
            <Timeline
              userId={userId} tasks={tasks} subjects={subjects}
              onToggleTask={onToggleTask} onEditTask={onEditTask} isAdmin={isAdmin}
              onLessonsChange={onLessonsChange} onEventsChange={onEventsChange}
              onMagisterError={onMagisterError}
            />
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
                userId={userId} tasks={tasks} subjects={subjects}
                onToggleTask={onToggleTask} onEditTask={onEditTask} isAdmin={isAdmin}
                onLessonsChange={onLessonsChange} onEventsChange={onEventsChange}
                onMagisterError={onMagisterError}
                defaultView="day"
                initialDate={selectedDay}
                isMobile
                hideToolbar
              />
            </div>
          </>
        )}

        {/* ── Maand view ── */}
        {mobileView === 'maand' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Month nav header */}
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 8px', borderRadius: 6 }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                {MONTHS_NL[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
              </span>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 8px', borderRadius: 6 }}>
                <ChevronRight size={18} />
              </button>
            </div>

            <MonthCalendar
              selectedDay={new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), selectedDay.getDate())}
              onSelectDay={handleSelectDay}
            />
          </div>
        )}
      </div>
    </>
  )
}
