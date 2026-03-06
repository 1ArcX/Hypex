import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react'

const WORK_MINS = 25
const BREAK_MINS = 5

export default function PomodoroTimer({ onModeChange }) {
  const [isBreak, setIsBreak] = useState(false)
  const [seconds, setSeconds] = useState(WORK_MINS * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef(null)

  const totalSeconds = isBreak ? BREAK_MINS * 60 : WORK_MINS * 60
  const progress = 1 - seconds / totalSeconds
  const circumference = 2 * Math.PI * 54

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            if (!isBreak) setSessions(n => n + 1)
            const next = !isBreak
            setIsBreak(next)
            onModeChange(next)
            return next ? BREAK_MINS * 60 : WORK_MINS * 60
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, isBreak])

  const reset = () => {
    setRunning(false)
    setSeconds(isBreak ? BREAK_MINS * 60 : WORK_MINS * 60)
  }

  const switchMode = (toBreak) => {
    setRunning(false)
    setIsBreak(toBreak)
    setSeconds(toBreak ? BREAK_MINS * 60 : WORK_MINS * 60)
    onModeChange(toBreak)
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  const accent = isBreak ? '#FF8C42' : '#00FFD1'

  return (
    <div className={`glass-card p-4 ${isBreak ? 'glass-card-orange' : ''}`} style={{ transition: 'all 0.5s ease' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isBreak ? <Coffee size={16} style={{ color: accent }} /> : <Brain size={16} style={{ color: accent }} />}
          <h3 className="text-sm font-semibold text-white">Pomodoro</h3>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(sessions, 4) }).map((_, i) => (
            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }} />
          ))}
          {sessions > 4 && <span className="text-xs" style={{ color: accent }}>+{sessions - 4}</span>}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <button onClick={() => switchMode(false)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: !isBreak ? `rgba(0,255,209,0.15)` : 'transparent',
            color: !isBreak ? '#00FFD1' : 'rgba(255,255,255,0.4)',
            border: !isBreak ? '1px solid rgba(0,255,209,0.3)' : '1px solid transparent'
          }}>
          Werken
        </button>
        <button onClick={() => switchMode(true)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: isBreak ? `rgba(255,140,66,0.15)` : 'transparent',
            color: isBreak ? '#FF8C42' : 'rgba(255,255,255,0.4)',
            border: isBreak ? '1px solid rgba(255,140,66,0.3)' : '1px solid transparent'
          }}>
          Pauze
        </button>
      </div>

      {/* Ring */}
      <div className="flex justify-center mb-4">
        <div className="relative" style={{ width: '120px', height: '120px' }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={accent}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="pomodoro-ring"
              style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono" style={{ color: accent, textShadow: `0 0 10px ${accent}` }}>
              {mins}:{secs}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isBreak ? 'pauze' : 'focus'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={reset}
          className="btn-neon flex items-center justify-center"
          style={{ padding: '10px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
          <RotateCcw size={16} />
        </button>
        <button onClick={() => setRunning(!running)}
          className={`btn-neon flex-1 flex items-center justify-center gap-2 ${isBreak ? 'btn-neon-orange' : ''}`}
          style={{ borderColor: `${accent}66`, color: accent, background: `${accent}1a` }}>
          {running ? <><Pause size={16} /> Pauzeer</> : <><Play size={16} /> {seconds === totalSeconds ? 'Start' : 'Hervat'}</>}
        </button>
      </div>
    </div>
  )
}