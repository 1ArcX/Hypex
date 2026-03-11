import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react'

const LS_KEY = 'pomodoro_state'

function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
}

function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

export default function PomodoroTimer({ onModeChange, onPomodoroActive }) {
  const [isBreak,      setIsBreak]      = useState(false)
  const [workMins,     setWorkMins]     = useState(25)
  const [breakMins,    setBreakMins]    = useState(5)
  const [seconds,      setSeconds]      = useState(25 * 60)  // displayed remaining
  const [running,      setRunning]      = useState(false)
  const [sessions,     setSessions]     = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [dragging,     setDragging]     = useState(false)
  const [showTooltip,  setShowTooltip]  = useState(false)

  const endTimeRef   = useRef(null)   // absolute ms when current session ends
  const intervalRef  = useRef(null)
  const svgRef       = useRef(null)

  // ── Restore persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    const s = loadState()
    if (!s) return
    setWorkMins(s.workMins ?? 25)
    setBreakMins(s.breakMins ?? 5)
    setIsBreak(s.isBreak ?? false)
    setSessions(s.sessions ?? 0)

    if (s.running && s.endTime) {
      const remaining = Math.ceil((s.endTime - Date.now()) / 1000)
      if (remaining > 0) {
        endTimeRef.current = s.endTime
        setSeconds(remaining)
        setRunning(true)
      } else {
        // Timer already expired while away — count it and switch mode
        const nextBreak = !s.isBreak
        const newSessions = s.isBreak ? s.sessions : (s.sessions ?? 0) + 1
        setSessions(newSessions)
        setIsBreak(nextBreak)
        const totalSecs = nextBreak ? (s.breakMins ?? 5) * 60 : (s.workMins ?? 25) * 60
        setSeconds(totalSecs)
        saveState({ running: false, isBreak: nextBreak, workMins: s.workMins, breakMins: s.breakMins, sessions: newSessions, remainingSeconds: totalSecs })
        setTimeout(() => onModeChange?.(nextBreak), 0)
      }
    } else if (!s.running && s.remainingSeconds != null) {
      setSeconds(s.remainingSeconds)
    }
  }, [])

  // ── Tick: recompute from endTime every 500 ms ─────────────────────────────
  const tick = useCallback(() => {
    if (!endTimeRef.current) return
    const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000)
    if (remaining <= 0) {
      clearInterval(intervalRef.current)
      endTimeRef.current = null
      setRunning(false)
      setIsBreak(prev => {
        const nextBreak = !prev
        setSessions(n => {
          const newN = prev ? n : n + 1
          setWorkMins(wm => {
            setBreakMins(bm => {
              const totalSecs = nextBreak ? bm * 60 : wm * 60
              setSeconds(totalSecs)
              saveState({ running: false, isBreak: nextBreak, workMins: wm, breakMins: bm, sessions: newN, remainingSeconds: totalSecs })
              return bm
            })
            return wm
          })
          return newN
        })
        setTimeout(() => {
          onModeChange?.(nextBreak)
          onPomodoroActive?.(false)
        }, 0)
        return nextBreak
      })
    } else {
      setSeconds(remaining)
    }
  }, [onModeChange, onPomodoroActive])

  // Start/stop interval
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 500)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, tick])

  // Recalculate on tab becoming visible (iPad, background tabs)
  useEffect(() => {
    const onVisible = () => {
      if (running && endTimeRef.current) tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [running, tick])

  // Notify parent of running state
  useEffect(() => {
    setTimeout(() => onPomodoroActive?.(running), 0)
  }, [running])

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleRunning = () => {
    if (!running) {
      // Start / resume
      const endTime = Date.now() + seconds * 1000
      endTimeRef.current = endTime
      setRunning(true)
      saveState({ running: true, endTime, isBreak, workMins, breakMins, sessions })
    } else {
      // Pause — snapshot remaining
      const remaining = endTimeRef.current
        ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        : seconds
      endTimeRef.current = null
      setRunning(false)
      setSeconds(remaining)
      saveState({ running: false, isBreak, workMins, breakMins, sessions, remainingSeconds: remaining })
    }
  }

  const reset = () => {
    setRunning(false)
    endTimeRef.current = null
    const s = isBreak ? breakMins * 60 : workMins * 60
    setSeconds(s)
    saveState({ running: false, isBreak, workMins, breakMins, sessions, remainingSeconds: s })
  }

  const switchMode = (toBreak) => {
    setRunning(false)
    endTimeRef.current = null
    setIsBreak(toBreak)
    const s = toBreak ? breakMins * 60 : workMins * 60
    setSeconds(s)
    saveState({ running: false, isBreak: toBreak, workMins, breakMins, sessions, remainingSeconds: s })
    setTimeout(() => onModeChange?.(toBreak), 0)
  }

  // Settings sliders
  const changeWorkMins = (m) => {
    setWorkMins(m)
    if (!isBreak && !running) { setSeconds(m * 60); saveState({ running: false, isBreak, workMins: m, breakMins, sessions, remainingSeconds: m * 60 }) }
  }
  const changeBreakMins = (m) => {
    setBreakMins(m)
    if (isBreak && !running) { setSeconds(m * 60); saveState({ running: false, isBreak, workMins, breakMins: m, sessions, remainingSeconds: m * 60 }) }
  }

  // ── Ring drag ─────────────────────────────────────────────────────────────
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

  // ── Display ───────────────────────────────────────────────────────────────
  const totalSeconds = isBreak ? breakMins * 60 : workMins * 60
  const progress = 1 - seconds / totalSeconds
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  const accentColor = isBreak ? '#FF8C42' : 'var(--accent)'

  return (
    <div className="glass-card p-4 transition-all duration-700"
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
            <span className="text-xs px-2 py-0.5 rounded-full animate-pulse" style={{
              background: isBreak ? 'rgba(255,140,66,0.2)' : 'rgba(0,255,209,0.2)',
              color: accentColor,
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
              onChange={e => changeWorkMins(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Pauzetijd: <span style={{ color: '#FF8C42' }}>{breakMins} min</span>
            </label>
            <input type="range" min="1" max="30" value={breakMins}
              onChange={e => changeBreakMins(+e.target.value)}
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
            border: !isBreak ? '1px solid rgba(0,255,209,0.3)' : '1px solid transparent',
            cursor: 'pointer'
          }}>
          Werken ({workMins}m)
        </button>
        <button onClick={() => switchMode(true)}
          className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
          style={{
            background: isBreak ? 'rgba(255,140,66,0.15)' : 'transparent',
            color: isBreak ? '#FF8C42' : 'rgba(255,255,255,0.4)',
            border: isBreak ? '1px solid rgba(255,140,66,0.3)' : '1px solid transparent',
            cursor: 'pointer'
          }}>
          Pauze ({breakMins}m)
        </button>
      </div>

      <div className="flex flex-col items-center mb-4">
        <div className="relative" style={{ width: '130px', height: '130px' }}>
          {showTooltip && !running && (
            <div style={{
              position: 'absolute', top: '-38px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)', color: 'rgba(255,255,255,0.85)',
              fontSize: '11px', padding: '5px 10px', borderRadius: '8px',
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              Sleep ring om tijd aan te passen
              <div style={{
                position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(0,0,0,0.85)'
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
              style={{ color: accentColor, textShadow: `0 0 10px ${accentColor}` }}>
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
        <button onClick={toggleRunning}
          className="btn-neon flex-1 flex items-center justify-center gap-2"
          style={{
            borderColor: isBreak ? 'rgba(255,140,66,0.5)' : 'rgba(0,255,209,0.5)',
            color: accentColor,
            background: isBreak ? 'rgba(255,140,66,0.1)' : 'rgba(0,255,209,0.1)'
          }}>
          {running ? <><Pause size={16} /> Pauzeer</> : <><Play size={16} /> {seconds === totalSeconds ? 'Start' : 'Hervat'}</>}
        </button>
      </div>
    </div>
  )
}
