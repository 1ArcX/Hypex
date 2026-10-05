import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { taskOnDay } from '../../utils/taskStatus'

// Weekstrook (ma–zo) met drukte-stip per dag; tik/klik = die dag, swipe of ‹ › = andere week.
// Gebruikt in de mobiele dagweergave (AgendaPage) en de desktop-dagweergave (Timeline).

const GLASS_BAR = 'rgba(255,255,255,0.03)'
const DAYS_SHORT = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO']
const MONTHS_NL  = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const MONTHS_S   = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function getWeekDays(date) {
  const start = new Date(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}
function pad2(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }

export function getDayDensity(day, tasks, calendarEvents, magisterLessons) {
  const ds = toDateStr(day)
  let count = 0
  // Taken
  count += (tasks || []).filter(t => (t.recurrence ? t.date === ds : taskOnDay(t, ds)) && !t.completed).length
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

export function densityColor(count) {
  if (count === 0) return 'transparent'
  if (count <= 2) return 'rgba(74,222,128,0.7)'   // groen
  if (count <= 4) return 'rgba(250,204,21,0.7)'    // geel
  return 'rgba(255,107,107,0.7)'                    // rood
}

// ─── Week strip (like the image) ─────────────────────────────────────────────
export default function WeekStrip({ selectedDay, onSelectDay, onPrevWeek, onNextWeek, tasks, calendarEvents, magisterLessons, showToday = true }) {
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
      style={{ flexShrink: 0, background: GLASS_BAR, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Month label + week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px 2px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{monthLabel}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {showToday && !weekDays.some(d => isSameDay(d, now)) && (
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '2px 8px 6px' }}>
        {weekDays.map((day, i) => {
          const isToday    = isSameDay(day, now)
          const isSelected = isSameDay(day, selectedDay)
          const density    = getDayDensity(day, tasks, calendarEvents, magisterLessons)

          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none' }}
            >
              {/* Weekday abbreviation */}
              <span style={{
                fontSize: 10, letterSpacing: '0.04em', fontWeight: 500, textTransform: 'uppercase',
                color: isToday ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {DAYS_SHORT[i]}
              </span>

              {/* Day number circle */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
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
