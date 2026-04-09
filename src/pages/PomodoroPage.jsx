import React, { useState } from 'react'
import PomodoroTimer from '../components/PomodoroTimer'
import StudieBuddiesWidget from '../components/StudieBuddiesWidget'
import PomodoroStats from '../components/PomodoroStats'

const SESSION_LOG_KEY = 'pomodoro_session_log'
const MODE_META = {
  work:      { label: 'Focus',       icon: '🎯', color: '#00FFD1' },
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
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
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
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: m.color + '18', border: `1px solid ${m.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {m.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.tag || m.label}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
          {durStr}{session.completedAt ? ` · klaar ${fmtTime(session.completedAt)}` : ''}
        </p>
      </div>
      <span style={{
        fontSize: 11, color: m.color, fontWeight: 600, flexShrink: 0,
        background: m.color + '15', border: `1px solid ${m.color}30`,
        borderRadius: 6, padding: '2px 8px',
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
    <div className="card" style={{ padding: '14px 16px', borderLeft: '3px solid rgba(0,255,209,0.25)', background: 'linear-gradient(135deg, rgba(0,255,209,0.02) 0%, transparent 60%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </p>
        {totalMins > 0 && (
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
            {totalStr} focus
          </span>
        )}
      </div>
      {sessions.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '1px 0' }} />}
          <SessionRow session={s} />
        </React.Fragment>
      ))}
    </div>
  )
}

export default function PomodoroPage({ onModeChange, onFocusModeChange, onPomodoroActive, userId, profiles, onlineUsers = [], onXPEarned }) {
  const [sessions, setSessions] = useState(loadSessions)

  const handleSessionComplete = (session) => {
    setSessions(prev => {
      const next = [session, ...prev].slice(0, 100)
      localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next))
      return next
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const byDate = {}
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 14)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-base)' }}>
      {/* Full-page timer */}
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <StudieBuddiesWidget profiles={profiles} onlineUsers={onlineUsers} />
        <PomodoroTimer
          onModeChange={onModeChange}
          onFocusModeChange={onFocusModeChange}
          onPomodoroActive={onPomodoroActive}
          userId={userId}
          noFocusOverlay
          fullPage
          onSessionComplete={handleSessionComplete}
          onXPEarned={onXPEarned}
        />
      </div>

      {/* Week stats */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
        <PomodoroStats refreshKey={sessions.length} userId={userId} />
      </div>

      {/* Session log */}
      {sessions.length > 0 && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>Sessie log</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {sortedDates.map(date => (
            <DayLog key={date} label={fmtDate(date)} sessions={byDate[date]} />
          ))}
        </div>
      )}
    </div>
  )
}
