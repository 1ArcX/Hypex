import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react'

export default function PomodoroTimer({ onModeChange }) {
  const [isBreak, setIsBreak] = useState(false)
  const [workMins, setWorkMins] = useState(25)
  const [breakMins, setBreakMins] = useState(5)
  const [seconds, setSeconds] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [dragging, setDragging] = useState(false)
  const intervalRef = useRef(null)
  const svgRef = useRef(null)

  const totalSeconds = isBreak ? breakMins * 60 : workMins * 60
  const progress = 1 - seconds / totalSeconds
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const accent = isBreak ? '#FF8C42' : '#00FFD1'

  useEffect(() => {
    if (!dragging) setSeconds(isBreak ? breakMins * 60 : workMins * 60)
  }, [workMins, breakMins, isBreak])

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

  const reset = () => {
    setRunning(false)
    setSeconds(isBreak ? breakMins * 60 : workMins * 60)
  }

  const switchMode = (toBreak) => {
    setRunning(false)
    setIsBreak(toBreak)
    setSeconds(toBreak ? breakMins * 60 : workMins * 60)
    onModeChange(toBreak)
  }

  // Sleep op de ring om tijd aan te passen
  const handleRingInteraction = (e) => {
    if (running) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const angle = Math.atan2(clientY - cy, clientX - cx)
    // Converteer naar 0-1 (start bovenaan = -π/2)
    let normalized = (angle + Math.PI / 2) / (2 * Math.PI)
    if (normalized < 0) normalized += 1
    normalized = Math.max(0.01, Math.min(1, normalized))

    if (isBreak) {
      const newMins = Math.max(1, Math.round(normalized * 30)) // max 30 min pauze
      setBreakMins(newMins)
      setSeconds(newMins * 60)
    } else {
      const newMins = Math.max(1, Math.round(normalized * 60)) // max 60 min werk
      setWorkMins(newMins)
      setSeconds(newMins * 60)
    }
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return (
    <div className={`glass-card p-4 ${isBreak ? 'glass-card-orange' : ''}`}
      style={{ transition: 'all 0.5s ease' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isBreak ? <Coffee size={16} style={{ color: accent }} /> : <Brain size={16} style={{ color: accent }} />}
          <h3 className="text-sm font-semibold text-white">Pomodoro</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(sessions, 4) }).map((_, i) => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }} />
            ))}
            {sessions > 4 && <span className="text-xs" style={{ color: accent }}>+{sessions - 4}</span>}
          </div>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            {showSettings ? <X size={15} /> : <Settings size={15} />}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-3 p-3 rounded-2xl space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'slideUp 0.2s ease' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Werktijd: <span style={{ color: accent }}>{workMins} min</span>
            </label>
            <input type="range" min="1" max="60" value={workMins}
              onChange={e => { setWorkMins(+e.target.value); if (!isBreak) { setRunning(false); setSeconds(+e.target.value * 60) } }}
              style={{ width: '100%', accentColor: '#00FFD1' }} />
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

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <button onClick={() => switchMode(false)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: !isBreak ? 'rgba(0,255,209,0.15)' : 'transparent',
            color: !isBreak ? '#00FFD1' : 'rgba(255,255,255,0.4)',
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

      {/* Ring — sleepbaar als timer niet loopt */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative" style={{ width: '130px', height: '130px' }}>
          <svg
            ref={svgRef}
            width="130" height="130"
            style={{
              transform: 'rotate(-90deg)',
              cursor: running ? 'default' : 'grab',
              userSelect: 'none'
            }}
            onMouseDown={() => { if (!running) setDragging(true) }}
            onMouseMove={(e) => { if (dragging) handleRingInteraction(e) }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={() => { if (!running) setDragging(true) }}
            onTouchMove={(e) => { if (dragging) handleRingInteraction(e) }}
            onTouchEnd={() => setDragging(false)}
          >
            {/* Achtergrond ring */}
            <circle cx="65" cy="65" r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            {/* Klikbare zone (dikkere transparante ring) */}
            <circle cx="65" cy="65" r={radius} fill="none"
              stroke="transparent" strokeWidth="20" style={{ cursor: running ? 'default' : 'grab' }} />
            {/* Progress ring */}
            <circle
              cx="65" cy="65" r={radius} fill="none"
              stroke={accent} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="pomodoro-ring"
              style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
            />
          </svg>

          {/* Tekst in het midden */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ pointerEvents: 'none' }}>
            <span className="text-2xl font-bold font-mono"
              style={{ color: accent, textShadow: `0 0 10px ${accent}` }}>
              {mins}:{secs}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isBreak ? 'pauze' : 'focus'}
            </span>
            {!running && (
              <span className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>
                sleep ring om aan te passen
              </span>
            )}
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
          {running
            ? <><Pause size={16} /> Pauzeer</>
            : <><Play size={16} /> {seconds === totalSeconds ? 'Start' : 'Hervat'}</>
          }
        </button>
      </div>
    </div>
  )
}