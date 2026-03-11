import React, { useEffect, useRef, useCallback, useReducer } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Settings, X, Bell, BellOff, Volume2, VolumeX } from 'lucide-react'

// ── Persistence ───────────────────────────────────────────────────────────────
const LS_KEY   = 'pomodoro_v3'
const LS_STATS = 'pomodoro_stats'

function getTodayKey() { return new Date().toISOString().slice(0, 10) }

function getTodayMins() {
  try { return (JSON.parse(localStorage.getItem(LS_STATS)) || {})[getTodayKey()] || 0 }
  catch { return 0 }
}

function addFocusMins(mins) {
  try {
    const stats = JSON.parse(localStorage.getItem(LS_STATS)) || {}
    const key   = getTodayKey()
    stats[key]  = (stats[key] || 0) + mins
    localStorage.setItem(LS_STATS, JSON.stringify(stats))
    return stats[key]
  } catch { return 0 }
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
}

function persist(s, endTime) {
  localStorage.setItem(LS_KEY, JSON.stringify({
    mode: s.mode, workMins: s.workMins, breakMins: s.breakMins,
    longBreakMins: s.longBreakMins, sessionsPerLong: s.sessionsPerLong,
    sessionsInCycle: s.sessionsInCycle, totalSessions: s.totalSessions,
    task: s.task, soundEnabled: s.soundEnabled, notifEnabled: s.notifEnabled,
    running: s.running, remainingSeconds: s.seconds, endTime,
  }))
}

// ── Audio ────────────────────────────────────────────────────────────────────
function playBeep(isWorkDone) {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)()
    const notes = isWorkDone ? [523, 659, 784] : [784, 659, 523]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type            = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.start(t)
      osc.stop(t + 0.32)
    })
  } catch {}
}

// ── Notifications ─────────────────────────────────────────────────────────────
function sendNotif(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }) } catch {}
  }
}

// ── Modes ─────────────────────────────────────────────────────────────────────
const MODES = {
  work:      { label: 'Focus',       color: '#00FFD1', rgb: '0,255,209',   maxMins: 60 },
  break:     { label: 'Pauze',       color: '#FF8C42', rgb: '255,140,66',  maxMins: 30 },
  longBreak: { label: 'Lang',        color: '#A78BFA', rgb: '167,139,250', maxMins: 60 },
}

function calcNextMode(mode, sessionsInCycle, sessionsPerLong) {
  if (mode !== 'work') return 'work'
  return (sessionsInCycle + 1) >= sessionsPerLong ? 'longBreak' : 'break'
}

function getMins(s) {
  return s.mode === 'work' ? s.workMins : s.mode === 'break' ? s.breakMins : s.longBreakMins
}

// ── Reducer ───────────────────────────────────────────────────────────────────
const INIT = {
  mode: 'work', workMins: 25, breakMins: 5, longBreakMins: 15, sessionsPerLong: 4,
  sessionsInCycle: 0, totalSessions: 0, seconds: 25 * 60, running: false,
  task: '', soundEnabled: true, notifEnabled: false, showSettings: false,
  todayMins: getTodayMins(),
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESTORE':   return { ...state, ...action.payload, todayMins: getTodayMins() }
    case 'TICK':      return { ...state, seconds: action.seconds }
    case 'SET_RUN':   return { ...state, running: action.value }
    case 'PAUSE':     return { ...state, running: false, seconds: action.seconds }
    case 'RESET':     return { ...state, running: false, seconds: getMins(state) * 60 }
    case 'SWITCH': {
      const mins = action.mode === 'work' ? state.workMins : action.mode === 'break' ? state.breakMins : state.longBreakMins
      return { ...state, mode: action.mode, seconds: mins * 60, running: false }
    }
    case 'SKIP': {
      const next = calcNextMode(state.mode, state.sessionsInCycle, state.sessionsPerLong)
      const mins = next === 'work' ? state.workMins : next === 'break' ? state.breakMins : state.longBreakMins
      return { ...state, mode: next, seconds: mins * 60, running: false }
    }
    case 'COMPLETE': {
      const { prevMode, todayMins } = action
      let newSIC   = state.sessionsInCycle
      let newTotal = state.totalSessions
      let nextMode

      if (prevMode === 'work') {
        newSIC   = state.sessionsInCycle + 1
        newTotal = state.totalSessions + 1
        nextMode = newSIC >= state.sessionsPerLong ? 'longBreak' : 'break'
      } else if (prevMode === 'longBreak') {
        newSIC   = 0
        nextMode = 'work'
      } else {
        nextMode = 'work'
      }

      const nextMins = nextMode === 'work' ? state.workMins : nextMode === 'break' ? state.breakMins : state.longBreakMins
      return {
        ...state, mode: nextMode, seconds: nextMins * 60, running: false,
        sessionsInCycle: newSIC, totalSessions: newTotal, todayMins,
      }
    }
    case 'SET_WORK_MINS':  return { ...state, workMins:       action.v, seconds: state.mode === 'work'      && !state.running ? action.v * 60 : state.seconds }
    case 'SET_BREAK_MINS': return { ...state, breakMins:      action.v, seconds: state.mode === 'break'     && !state.running ? action.v * 60 : state.seconds }
    case 'SET_LBRK_MINS':  return { ...state, longBreakMins:  action.v, seconds: state.mode === 'longBreak' && !state.running ? action.v * 60 : state.seconds }
    case 'SET_SPL':        return { ...state, sessionsPerLong: action.v }
    case 'SET_TASK':       return { ...state, task: action.v }
    case 'TOGGLE_SOUND':   return { ...state, soundEnabled: !state.soundEnabled }
    case 'TOGGLE_NOTIF':   return { ...state, notifEnabled: !state.notifEnabled }
    case 'TOGGLE_SETTINGS':return { ...state, showSettings: !state.showSettings }
    default: return state
  }
}

// ── Shared button style ───────────────────────────────────────────────────────
const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PomodoroTimer({ onModeChange, onPomodoroActive }) {
  const [state, dispatch] = useReducer(reducer, INIT)
  const stateRef   = useRef(state)
  const endTimeRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => { stateRef.current = state }, [state])

  // ── Restore saved state ──────────────────────────────────────────────────
  useEffect(() => {
    const s = loadSaved()
    if (!s) return

    const { mode = 'work', workMins = 25, breakMins = 5, longBreakMins = 15,
            sessionsPerLong = 4, sessionsInCycle = 0, totalSessions = 0,
            task = '', soundEnabled = true, notifEnabled = false } = s

    if (s.running && s.endTime) {
      const remaining = Math.ceil((s.endTime - Date.now()) / 1000)
      if (remaining > 0) {
        endTimeRef.current = s.endTime
        dispatch({ type: 'RESTORE', payload: {
          mode, workMins, breakMins, longBreakMins, sessionsPerLong,
          sessionsInCycle, totalSessions, seconds: remaining, running: true,
          task, soundEnabled, notifEnabled,
        }})
      } else {
        // Expired while away — advance mode silently
        let nextMode, newSIC = sessionsInCycle, newTotal = totalSessions
        if (mode === 'work') {
          newSIC   = sessionsInCycle + 1
          newTotal = totalSessions + 1
          nextMode = newSIC >= sessionsPerLong ? 'longBreak' : 'break'
          addFocusMins(workMins)
        } else if (mode === 'longBreak') {
          newSIC = 0; nextMode = 'work'
        } else {
          nextMode = 'work'
        }
        const nextMins = nextMode === 'work' ? workMins : nextMode === 'break' ? breakMins : longBreakMins
        dispatch({ type: 'RESTORE', payload: {
          mode: nextMode, workMins, breakMins, longBreakMins, sessionsPerLong,
          sessionsInCycle: newSIC, totalSessions: newTotal,
          seconds: nextMins * 60, running: false, task, soundEnabled, notifEnabled,
        }})
        setTimeout(() => onModeChange?.(nextMode !== 'work'), 0)
      }
    } else {
      dispatch({ type: 'RESTORE', payload: {
        mode, workMins, breakMins, longBreakMins, sessionsPerLong,
        sessionsInCycle, totalSessions,
        seconds: s.remainingSeconds ?? workMins * 60,
        running: false, task, soundEnabled, notifEnabled,
      }})
    }
  }, [])

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (!endTimeRef.current) return
    const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000)

    if (remaining <= 0) {
      clearInterval(intervalRef.current)
      endTimeRef.current = null
      const s = stateRef.current

      if (s.soundEnabled) playBeep(s.mode === 'work')

      const todayMins = s.mode === 'work' ? addFocusMins(s.workMins) : getTodayMins()

      const nextMode = calcNextMode(s.mode, s.sessionsInCycle, s.sessionsPerLong)
      if (s.notifEnabled) {
        const title = s.mode === 'work' ? 'Focus sessie klaar! 🎯' : 'Pauze voorbij!'
        const body  = nextMode === 'longBreak' ? 'Tijd voor een lange pauze.'
                    : nextMode === 'break'     ? 'Neem een pauze.'
                                               : 'Tijd om te focussen!'
        sendNotif(title, body)
      }

      dispatch({ type: 'COMPLETE', prevMode: s.mode, todayMins })
      setTimeout(() => {
        onModeChange?.(nextMode !== 'work')
        onPomodoroActive?.(false)
      }, 0)
    } else {
      dispatch({ type: 'TICK', seconds: remaining })
    }
  }, [onModeChange, onPomodoroActive])

  // Start/stop interval
  useEffect(() => {
    if (state.running) {
      intervalRef.current = setInterval(tick, 500)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [state.running, tick])

  // Recalculate on tab focus / visibility change
  useEffect(() => {
    const onVisible = () => { if (stateRef.current.running && endTimeRef.current) tick() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [tick])

  // Notify parent of running state
  useEffect(() => {
    setTimeout(() => onPomodoroActive?.(state.running), 0)
  }, [state.running])

  // Persist on key state changes (not on every tick)
  useEffect(() => {
    persist(state, state.running ? endTimeRef.current : null)
  }, [
    state.running, state.mode, state.workMins, state.breakMins, state.longBreakMins,
    state.sessionsPerLong, state.sessionsInCycle, state.totalSessions,
    state.task, state.soundEnabled, state.notifEnabled,
  ])

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleRunning = () => {
    if (!state.running) {
      const endTime = Date.now() + state.seconds * 1000
      endTimeRef.current = endTime
      dispatch({ type: 'SET_RUN', value: true })
      onModeChange?.(state.mode !== 'work')
    } else {
      const remaining = endTimeRef.current
        ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        : state.seconds
      endTimeRef.current = null
      dispatch({ type: 'PAUSE', seconds: remaining })
    }
  }

  const reset = () => {
    endTimeRef.current = null
    dispatch({ type: 'RESET' })
  }

  const skip = () => {
    endTimeRef.current = null
    const next = calcNextMode(state.mode, state.sessionsInCycle, state.sessionsPerLong)
    dispatch({ type: 'SKIP' })
    setTimeout(() => onModeChange?.(next !== 'work'), 0)
  }

  const switchMode = (mode) => {
    endTimeRef.current = null
    dispatch({ type: 'SWITCH', mode })
    setTimeout(() => onModeChange?.(mode !== 'work'), 0)
  }

  const toggleNotif = async () => {
    if (!state.notifEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    dispatch({ type: 'TOGGLE_NOTIF' })
  }

  // ── Display ───────────────────────────────────────────────────────────────
  const {
    mode, seconds, running, sessionsInCycle, sessionsPerLong, totalSessions,
    task, soundEnabled, notifEnabled, showSettings, todayMins,
    workMins, breakMins, longBreakMins,
  } = state

  const currentMins   = getMins(state)
  const totalSecs     = currentMins * 60
  const progress      = seconds / totalSecs            // 1 = full, 0 = empty
  const modeColor     = MODES[mode].color
  const modeRgb       = MODES[mode].rgb
  const radius        = 68
  const circ          = 2 * Math.PI * radius
  const dashOffset    = circ * (1 - progress)
  const mm            = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss            = String(seconds % 60).padStart(2, '0')
  const todayH        = Math.floor(todayMins / 60)
  const todayM        = todayMins % 60
  const todayStr      = todayH > 0 ? `${todayH}u ${todayM}m` : `${todayMins}m`

  return (
    <div
      className="glass-card transition-all duration-700"
      style={{
        padding: '18px',
        boxShadow: running
          ? `0 0 40px rgba(${modeRgb},0.18), inset 0 0 30px rgba(${modeRgb},0.04)`
          : undefined,
        borderColor: running ? `rgba(${modeRgb},0.3)` : undefined,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>
          POMODORO
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => dispatch({ type: 'TOGGLE_SOUND' })} style={iconBtn} title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}>
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <button onClick={toggleNotif} style={iconBtn} title={notifEnabled ? 'Meldingen uit' : 'Meldingen aan'}>
            {notifEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          </button>
          <button onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} style={iconBtn}>
            {showSettings ? <X size={13} /> : <Settings size={13} />}
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div style={{
          marginBottom: '14px', padding: '14px', borderRadius: '14px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {[
            { label: 'Focus',       color: MODES.work.color,      val: workMins,      max: 60, action: v => dispatch({ type: 'SET_WORK_MINS',  v }) },
            { label: 'Pauze',       color: MODES.break.color,     val: breakMins,     max: 30, action: v => dispatch({ type: 'SET_BREAK_MINS', v }) },
            { label: 'Lange pauze', color: MODES.longBreak.color, val: longBreakMins, max: 60, action: v => dispatch({ type: 'SET_LBRK_MINS',  v }) },
          ].map(({ label, color, val, max, action }) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color }}>{val} min</span>
              </div>
              <input type="range" min="1" max={max} value={val}
                onChange={e => action(+e.target.value)}
                style={{ width: '100%', accentColor: color }} />
            </div>
          ))}
          <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Sessies per cyclus</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => dispatch({ type: 'SET_SPL', v: n })}
                  style={{
                    width: '26px', height: '26px', borderRadius: '7px', border: 'none',
                    cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                    background: sessionsPerLong === n ? 'rgba(0,255,209,0.18)' : 'rgba(255,255,255,0.05)',
                    color: sessionsPerLong === n ? '#00FFD1' : 'rgba(255,255,255,0.35)',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div style={{
        display: 'flex', gap: '3px', marginBottom: '14px',
        padding: '3px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)',
      }}>
        {Object.entries(MODES).map(([key, { label, color, rgb }]) => (
          <button key={key} onClick={() => switchMode(key)}
            style={{
              flex: 1, padding: '6px 2px', borderRadius: '9px', border: 'none',
              cursor: 'pointer', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.02em', transition: 'all 0.2s',
              background: mode === key ? `rgba(${rgb},0.15)` : 'transparent',
              color: mode === key ? color : 'rgba(255,255,255,0.3)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Cycle progress dots ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '7px', marginBottom: '10px' }}>
        {Array.from({ length: sessionsPerLong }, (_, i) => {
          const done = i < sessionsInCycle
          return (
            <div key={i} style={{
              width:  done ? '8px' : '6px',
              height: done ? '8px' : '6px',
              borderRadius: '50%',
              background: done ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
              boxShadow: done ? '0 0 6px rgba(0,255,209,0.5)' : 'none',
              transition: 'all 0.3s',
            }} />
          )
        })}
      </div>

      {/* ── Timer ring ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', width: '164px', height: '164px' }}>
          <svg width="164" height="164" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background track */}
            <circle cx="82" cy="82" r={radius} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
            {/* Progress arc */}
            <circle cx="82" cy="82" r={radius} fill="none"
              stroke={modeColor} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              style={{
                filter: `drop-shadow(0 0 8px ${modeColor}70)`,
                transition: 'stroke-dashoffset 0.5s ease, stroke 0.6s ease',
              }}
            />
          </svg>

          {/* Center display */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '34px', fontWeight: 700, fontFamily: 'monospace',
              color: modeColor, lineHeight: 1, letterSpacing: '-1px',
              textShadow: `0 0 20px ${modeColor}50`,
              transition: 'color 0.6s ease',
            }}>
              {mm}:{ss}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.3)', marginTop: '5px',
              textTransform: 'uppercase',
            }}>
              {MODES[mode].label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Task input ── */}
      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder="Waar werk je aan?"
          value={task}
          onChange={e => dispatch({ type: 'SET_TASK', v: e.target.value })}
          onFocus={e => { e.target.style.borderColor = `rgba(${modeRgb},0.35)` }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '9px 12px',
            color: 'rgba(255,255,255,0.65)', fontSize: '12px',
            outline: 'none', transition: 'border-color 0.2s',
          }}
        />
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {/* Reset */}
        <button onClick={reset} style={iconBtn} title="Reset">
          <RotateCcw size={15} />
        </button>

        {/* Play / Pause */}
        <button onClick={toggleRunning}
          style={{
            flex: 1, height: '40px', borderRadius: '12px',
            border: `1px solid rgba(${modeRgb},0.4)`,
            background: `rgba(${modeRgb},0.1)`,
            color: modeColor, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
          }}>
          {running
            ? <><Pause size={15} /> Pauzeer</>
            : <><Play  size={15} /> {seconds === totalSecs ? 'Start' : 'Hervat'}</>
          }
        </button>

        {/* Skip */}
        <button onClick={skip} style={iconBtn} title="Sla over">
          <SkipForward size={15} />
        </button>
      </div>

      {/* ── Daily stats ── */}
      <div style={{
        paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>
          Vandaag gefocust
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          {todayMins > 0 ? todayStr : '—'}
          {totalSessions > 0 && (
            <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>
              · {totalSessions} sessie{totalSessions !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
