import React, { useState, useEffect } from 'react'

export default function Clock({ isBreak }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
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

  return (
    <div className="text-center py-4">
      <div className={`font-bold tracking-tight select-none ${clockClass}`}
        style={{ fontSize: 'clamp(48px, 8vw, 80px)', letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
        {hours}<span style={{ opacity: 0.6, animation: 'blink 1s step-end infinite' }}>:</span>{minutes}
        <span className="ml-2" style={{ fontSize: '0.4em', opacity: 0.7 }}>{seconds}</span>
      </div>
      <p className="mt-1 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{dateStr}</p>
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
      `}</style>
    </div>
  )
}