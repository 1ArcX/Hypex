import React, { useState } from 'react'
import PomodoroTimer from '../components/PomodoroTimer'
import StudieBuddiesWidget from '../components/StudieBuddiesWidget'
import PomodoroStats from '../components/PomodoroStats'
import SpotifyWidget from '../components/SpotifyWidget'
import SessionGoalCard from '../components/pomodoro/SessionGoalCard'
import { Target, Clock3, CalendarCheck } from 'lucide-react'
import { toISO } from '../utils/recurrence'

const SESSION_LOG_KEY = 'pomodoro_session_log'
const MODE_META = {
  work:      { label: 'Focus',       icon: '🎯', color: 'var(--accent)' },
  break:     { label: 'Pauze',       icon: '☕', color: '#FF8C42' },
  longBreak: { label: 'Lange pauze', icon: '🌙', color: '#A78BFA' },
}
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_LOG_KEY)) || [] } catch { return [] }
}
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const today = toISO(new Date())
  const yesterday = toISO(new Date(Date.now() - 86400000))
  if (dateStr === today) return 'Vandaag'
  if (dateStr === yesterday) return 'Gisteren'
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function SessionRow({ session }) {
  const m = MODE_META[session.mode] || MODE_META.work
  const durationMins = session.durationMins
  const h = Math.floor(durationMins / 60)
  const min = durationMins % 60
  const durStr = h > 0 ? `${h}u ${min}m` : `${min}m`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div aria-hidden="true" style={{
        width: 32, height: 32, borderRadius: 'var(--r-sm)', flexShrink: 0,
        background: `color-mix(in srgb, ${m.color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${m.color} 20%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--c-text)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.tag || m.label}
        </p>
        <p className="t-meta tnum" style={{ margin: 0 }}>
          {durStr}{session.completedAt ? ` · klaar ${fmtTime(session.completedAt)}` : ''}
          {session.goal && session.goal !== session.tag ? ` · ${session.goal}` : ''}
          {session.checkTotal > 0 ? ` · ✓ ${session.checkDone}/${session.checkTotal}` : ''}
        </p>
      </div>
      <span style={{
        fontSize: 11, color: m.color, fontWeight: 600, flexShrink: 0,
        background: `color-mix(in srgb, ${m.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${m.color} 19%, transparent)`,
        borderRadius: 'var(--r-xs)', padding: '2px 8px',
      }}>
        {m.label}
      </span>
    </div>
  )
}

function DayLog({ label, sessions }) {
  const focusSessions = sessions.filter(s => s.mode === 'work')
  const totalMins = focusSessions.reduce((sum, s) => sum + (s.durationMins || 0), 0)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const totalStr = h > 0 ? `${h}u ${m}m` : `${totalMins}m`

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p className="t-card" style={{ margin: 0 }}>
          {label}
        </p>
        {totalMins > 0 && (
          <span className="tnum" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            {totalStr} focus
          </span>
        )}
      </div>
      {sessions.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ height: 1, background: 'var(--c-border)', margin: '1px 0' }} />}
          <SessionRow session={s} />
        </React.Fragment>
      ))}
    </div>
  )
}

function TodayCard({ count, mins, sessionsInCycle, sessionsPerLong }) {
  return (
    <div className="card pomo-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CalendarCheck size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <h3 className="t-card" style={{ margin: 0 }}>Vandaag</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="pomo-stat">
          <Target size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <span>
            <span className="t-kpi tnum" style={{ fontSize: 18, display: 'block' }}>{count}</span>
            <span className="t-meta">{count === 1 ? 'focussessie' : 'focussessies'}</span>
          </span>
        </div>
        <div className="pomo-stat">
          <Clock3 size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <span>
            <span className="t-kpi tnum" style={{ fontSize: 18, display: 'block' }}>{mins}<span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}> min</span></span>
            <span className="t-meta">focus tijd</span>
          </span>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="t-meta" style={{ flexShrink: 0 }}>Cyclus</span>
        <div style={{ display: 'flex', gap: 6, flex: 1 }} aria-label={`${sessionsInCycle} van ${sessionsPerLong} sessies in deze cyclus`}>
          {Array.from({ length: sessionsPerLong }, (_, i) => (
            <span key={i} className={`pomo-dot${i < sessionsInCycle ? ' is-done' : ''}`} />
          ))}
        </div>
        <span className="t-meta tnum">{sessionsInCycle}/{sessionsPerLong}</span>
      </div>
    </div>
  )
}

export default function PomodoroPage({ onModeChange, onFocusModeChange, onPomodoroActive, userId, profiles, onlineUsers = [], onXPEarned, tasks = [], onToggleTask, seedTask, onSeedConsumed }) {
  const [sessions, setSessions] = useState(loadSessions)

  const handleSessionComplete = (session) => {
    setSessions(prev => {
      const next = [session, ...prev].slice(0, 100)
      localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next))
      return next
    })
  }

  const today = toISO(new Date())
  const byDate = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 14)
  const todayFocus = (byDate[today] || []).filter(s => s.mode === 'work')
  const todayFocusMins = todayFocus.reduce((sum, s) => sum + (s.durationMins || 0), 0)

  return (
    <div className="pomo-page">
      <PomodoroTimer
        onModeChange={onModeChange}
        onFocusModeChange={onFocusModeChange}
        onPomodoroActive={onPomodoroActive}
        userId={userId}
        noFocusOverlay
        fullPage
        onSessionComplete={handleSessionComplete}
        onXPEarned={onXPEarned}
        seedTask={seedTask}
        onSeedConsumed={onSeedConsumed}
        renderCards={(t) => (
          <>
            <TodayCard count={todayFocus.length} mins={todayFocusMins} sessionsInCycle={t.sessionsInCycle} sessionsPerLong={t.sessionsPerLong} />
            <SessionGoalCard goal={t.goal} checklist={t.checklist} goalApi={t.goalApi} tasks={tasks} onToggleTask={onToggleTask} />
            <SpotifyWidget compact title="Focus playlist" className="pomo-card" />
          </>
        )}
      />

      {/* Onder de hero: wie studeert er, weekstats en sessie-log */}
      <div className="pomo-below">
        <div className="pomo-below-grid">
          <StudieBuddiesWidget profiles={profiles} onlineUsers={onlineUsers} />
          <PomodoroStats refreshKey={sessions.length} userId={userId} />
        </div>

        {sessions.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
              <span className="t-overline" style={{ color: 'var(--c-text-3)' }}>Sessie log</span>
              <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            </div>
            <div className="pomo-log">
              {sortedDates.map(date => (
                <DayLog key={date} label={fmtDate(date)} sessions={byDate[date]} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
