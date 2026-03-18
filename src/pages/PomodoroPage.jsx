import React, { useState } from 'react'
import PomodoroTimer from '../components/PomodoroTimer'

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
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function SessionRow({ session }) {
  const m = MODE_META[session.mode] || MODE_META.work
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{m.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.tag || m.label}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
          {session.durationMins} min
          {session.completedAt ? ` · ${fmtTime(session.completedAt)}` : ''}
        </p>
      </div>
      <span style={{ fontSize: 11, color: m.color, fontWeight: 600, flexShrink: 0,
        background: m.color + '18', border: `1px solid ${m.color}33`,
        borderRadius: 6, padding: '2px 7px' }}>
        {m.label}
      </span>
    </div>
  )
}

export default function PomodoroPage({ onModeChange, onFocusModeChange, userId }) {
  const [sessions, setSessions] = useState(loadSessions)

  const handleSessionComplete = (session) => {
    setSessions(prev => {
      const next = [session, ...prev].slice(0, 100)
      localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next))
      return next
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const todaySessions = sessions.filter(s => s.date === today)
  const pastByDate = {}
  for (const s of sessions.filter(s => s.date !== today)) {
    if (!pastByDate[s.date]) pastByDate[s.date] = []
    pastByDate[s.date].push(s)
  }
  const pastDates = Object.keys(pastByDate).sort((a, b) => b.localeCompare(a)).slice(0, 7)

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--bg-base)', padding: '32px 20px 48px', gap: 20,
    }}>
      {/* Timer widget, centered */}
      <div style={{ width: '100%', maxWidth: 400 }}>
        <PomodoroTimer
          onModeChange={onModeChange}
          onFocusModeChange={onFocusModeChange}
          userId={userId}
          noFocusOverlay
          onSessionComplete={handleSessionComplete}
        />
      </div>

      {/* Session log */}
      {sessions.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Sessie log
          </p>

          {todaySessions.length > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 8px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>Vandaag</p>
              {todaySessions.map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />}
                  <SessionRow session={s} />
                </React.Fragment>
              ))}
            </div>
          )}

          {pastDates.map(date => (
            <div key={date} className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 8px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>{fmtDate(date)}</p>
              {pastByDate[date].map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />}
                  <SessionRow session={s} />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
