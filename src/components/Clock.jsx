import React, { useState, useEffect } from 'react'

const MODES = {
  work:      { label: 'Focus',       color: '#00FFD1' },
  break:     { label: 'Pauze',       color: '#FF8C42' },
  longBreak: { label: 'Lang',        color: '#A78BFA' },
}

function getPomodoroDisplay() {
  try {
    const s = JSON.parse(localStorage.getItem('pomodoro_v3'))
    if (!s || !s.running) return null
    const remaining = s.endTime
      ? Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000))
      : (s.remainingSeconds ?? 0)
    if (remaining <= 0) return null
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
    const ss = String(remaining % 60).padStart(2, '0')
    return { time: `${mm}:${ss}`, mode: s.mode || 'work' }
  } catch { return null }
}

export default function Clock({ isBreak }) {
  const [time, setTime] = useState(new Date())
  const [pomodoro, setPomodoro] = useState(getPomodoroDisplay)

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
      setPomodoro(getPomodoroDisplay())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const pad = n => String(n).padStart(2, '0')
  const hours = pad(time.getHours())
  const minutes = pad(time.getMinutes())
  const seconds = pad(time.getSeconds())

  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`

  const clockClass = isBreak ? 'neon-clock-orange' : 'neon-clock'
  const pomColor = pomodoro ? MODES[pomodoro.mode]?.color : null

  return (
    <div className="text-center py-4">
      <div className={`font-bold tracking-tight select-none ${clockClass}`}
        style={{ fontSize: 'clamp(48px, 8vw, 80px)', letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
        {hours}<span style={{ opacity: 0.6, animation: 'blink 1s step-end infinite' }}>:</span>{minutes}
        <span className="ml-2" style={{ fontSize: '0.4em', opacity: 0.7 }}>{seconds}</span>
      </div>
      <p className="mt-1 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{dateStr}</p>

      {/* Pomodoro timer indicator */}
      {pomodoro && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 10, padding: '6px 14px', borderRadius: 20,
          background: `${pomColor}12`,
          border: `1px solid ${pomColor}35`,
        }}>
          {/* Running dot */}
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: pomColor,
            boxShadow: `0 0 8px ${pomColor}`,
            animation: 'pulse 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: pomColor, letterSpacing: 1 }}>
            {pomodoro.time}
          </span>
          <span style={{ fontSize: 11, color: `${pomColor}99`, fontWeight: 500 }}>
            {MODES[pomodoro.mode]?.label}
          </span>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
      `}</style>
    </div>
  )
}
