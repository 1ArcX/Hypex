import React, { useState, useEffect, useMemo } from 'react'
import Timeline from '../components/Timeline'
import AgendaList from '../components/AgendaList'
import WeekStrip from '../components/agenda/WeekStrip'
import MonthGrid from '../components/agenda/MonthGrid'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { loadExternalEvents } from '../utils/externalEvents'

const GLASS_BAR = 'rgba(255,255,255,0.03)'

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
  // Geïmporteerde items (alle, ook verleden) voor de mobiele maand-/weekweergave
  const [imported, setImported] = useState([])
  useEffect(() => {
    if (isDesktop) return
    const load = () => loadExternalEvents().then(d => d && setImported(d))
    load()
    window.addEventListener('refreshExternalCalendarEvents', load)
    return () => window.removeEventListener('refreshExternalCalendarEvents', load)
  }, [isDesktop])
  const mobileEvents = useMemo(() => [...(calendarEvents || []).filter(e => !e.external), ...imported.filter(e => !e.hidden)], [calendarEvents, imported])
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
              calendarEvents={mobileEvents}
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
              calendarEvents={mobileEvents}
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
            <MonthGrid
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
              tasks={tasks}
              calendarEvents={mobileEvents}
              magisterLessons={magisterLessons}
            />
          </div>
        )}
      </div>
    </>
  )
}
