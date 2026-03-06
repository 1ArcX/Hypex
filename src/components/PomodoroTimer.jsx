import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react'

export default function PomodoroTimer({ onModeChange, onPomodoroActive }) {
  const [isBreak, setIsBreak] = useState(false)
  const [workMins, setWorkMins] = useState(25)
  const [breakMins, setBreakMins] = useState(5)
  const [seconds, setSeconds] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const intervalRef = useRef(null)
  const svgRef = useRef(null)

  const totalSeconds = isBreak ? breakMins * 60 : workMins * 60
  const progress = 1 - seconds / totalSeconds
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const accent = isBreak ? '#FF8C42' : 'var(--accent)'

  useEffect(() => {
    if (!dragging) setSeconds(isBreak ? breakMins * 60 : workMins * 60)
  }, [workMins, breakMins, isBreak])

  useEffect(() => {
    onPomodoroActive?.(running)
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            if (!isBreak) setSessions(n => n + 1)
            const next = !isBreak
            setIsBreak(next)
            onModeChange?.(next)
            return next ? breakMins * 60 : workMins * 60
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, isBreak, workMins, breakMins])

  const reset = () => { setRunning(false); setSeconds(isBreak ? breakMins * 60 : workMins * 60) }

  const switchMode = (toBreak) => {
    setRunning(false); setIsBreak(toBreak)
    setSeconds(toBreak ? breakMins * 60 : workMins * 60)
    onModeChange?.(toBreak)
  }

  const handleRingInteraction = (e) => {
    if (running) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    let normalized = (Math.atan2(clientY - cy, clientX - cx) + Math.PI / 2) / (2 * Math.PI)
    if (normalized < 0) normalized += 1
    normalized = Math.max(0.01, Math.min(1, normalized))
    if (isBreak) {
      const m = Math.max(1, Math.round(normalized * 30))
      setBreakMins(m); setSeconds(m * 60)
    } else {
      const m = Math.max(1, Math.round(normalized * 60))
      setWorkMins(m); setSeconds(m * 60)
    }
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <div className={`glass-card p-4 transition-all duration-700 ${running ? 'pomodoro-active' : ''}`}
      style={running ? {
        boxShadow: isBreak
          ? '0 0 40px rgba(255,140,66,0.25), inset 0 0 40px rgba(255,140,66,0.05)'
          : '0 0 40px rgba(0,255,209,0.25), inset 0 0 40px rgba(0,255,209,0.05)',
        borderColor: isBreak ? 'rgba(255,140,66,0.4)' : 'rgba(0,255,209,0.4)'
      } : {}}>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isBreak ? <Coffee size={16} style={{ color: '#FF8C42' }} /> : <Brain size={16} style={{ color: 'var(--accent)' }} />}
          <h3 className="text-sm font-semibold text-white">Pomodoro</h3>
          {running && (
            <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
              style={{
                background: isBreak ? 'rgba(255,140,66,0.2)' : 'rgba(0,255,209,0.2)',
                color: isBreak ? '#FF8C42' : 'var(--accent)',
                border: `1px solid ${isBreak ? 'rgba(255,140,66,0.4)' : 'rgba(0,255,209,0.4)'}`
              }}>
              {isBreak ? 'Pauze' : 'Focus'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(sessions, 4) }).map((_, i) => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
            ))}
            {sessions > 4 && <span className="text-xs" style={{ color: 'var(--accent)' }}>+{sessions - 4}</span>}
          </div>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            {showSettings ? <X size={15} /> : <Settings size={15} />}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 p-3 rounded-2xl space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Werktijd: <span style={{ color: 'var(--accent)' }}>{workMins} min</span>
            </label>
            <input type="range" min="1" max="60" value={workMins}
              onChange={e => { setWorkMins(+e.target.value); if (!isBreak) { setRunning(false); setSeconds(+e.target.value * 60) } }}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Pauzetijd: <span style={{ color: '#FF8C42' }}>{breakMins} min</span>
            </label>
            <input type="range" min="1" max="30" value={breakMins}
              onChange={e => { setBreakMins(+e.target.value); if (isBreak) { setRunning(false); setSeconds(+e.target.value * 60) } }}
              style={{ width: '100%', accentColor: '#FF8C42' }} />
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <button onClick={() => switchMode(false)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: !isBreak ? 'rgba(0,255,209,0.15)' : 'transparent',
            color: !isBreak ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
            border: !isBreak ? '1px solid rgba(0,255,209,0.3)' : '1px solid transparent'
          }}>
          Werken ({workMins}m)
        </button>
        <button onClick={() => switchMode(true)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: isBreak ? 'rgba(255,140,66,0.15)' : 'transparent',
            color: isBreak ? '#FF8C42' : 'rgba(255,255,255,0.4)',
            border: isBreak ? '1px solid rgba(255,140,66,0.3)' : '1px solid transparent'
          }}>
          Pauze ({breakMins}m)
        </button>
      </div>

      {/* Ring met tooltip */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative" style={{ width: '130px', height: '130px' }}>
          {/* Tooltip */}
          {showTooltip && !running && (
            <div style={{
              position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.8)', color: 'rgba(255,255,255,0.8)',
              fontSize: '11px', padding: '4px 10px', borderRadius: '8px',
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              Sleep om tijd aan te passen
              <div style={{
                position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(0,0,0,0.8)'
              }} />
            </div>
          )}

          <svg ref={svgRef} width="130" height="130"
            style={{ transform: 'rotate(-90deg)', cursor: running ? 'default' : 'grab', userSelect: 'none' }}
            onMouseEnter={() => !running && setShowTooltip(true)}
            onMouseLeave={() => { setShowTooltip(false); setDragging(false) }}
            onMouseDown={() => { if (!running) setDragging(true) }}
            onMouseMove={(e) => { if (dragging) handleRingInteraction(e) }}
            onMouseUp={() => setDragging(false)}
            onTouchStart={(e) => { if (!running) { setDragging(true); handleRingInteraction(e) } }}
            onTouchMove={(e) => { if (dragging) handleRingInteraction(e) }}
            onTouchEnd={() => setDragging(false)}
          >
            <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="65" cy="65" r={radius} fill="none" stroke="transparent" strokeWidth="20"
              style={{ cursor: running ? 'default' : 'grab' }} />
            <circle cx="65" cy="65" r={radius} fill="none"
              stroke={isBreak ? '#FF8C42' : 'var(--accent)'} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ filter: `drop-shadow(0 0 6px ${isBreak ? '#FF8C42' : 'var(--accent)'})`, transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ pointerEvents: 'none' }}>
            <span className="text-2xl font-bold font-mono"
              style={{ color: isBreak ? '#FF8C42' : 'var(--accent)', textShadow: `0 0 10px ${isBreak ? '#FF8C42' : 'var(--accent)'}` }}>
              {mins}:{secs}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isBreak ? 'pauze' : 'focus'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="btn-neon flex items-center justify-center"
          style={{ padding: '10px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
          <RotateCcw size={16} />
        </button>
        <button onClick={() => setRunning(!running)}
          className="btn-neon flex-1 flex items-center justify-center gap-2"
          style={{
            borderColor: isBreak ? 'rgba(255,140,66,0.5)' : 'rgba(0,255,209,0.5)',
            color: isBreak ? '#FF8C42' : 'var(--accent)',
            background: isBreak ? 'rgba(255,140,66,0.1)' : 'rgba(0,255,209,0.1)'
          }}>
          {running ? <><Pause size={16} /> Pauzeer</> : <><Play size={16} /> {seconds === totalSeconds ? 'Start' : 'Hervat'}</>}
        </button>
      </div>
    </div>
  )
}