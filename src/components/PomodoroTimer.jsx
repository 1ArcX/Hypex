import React, { useEffect, useRef, useCallback, useReducer, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, RotateCcw, SkipForward, Settings, X, Bell, BellOff, Volume2, VolumeX, Coffee, Zap, Maximize2, Timer } from 'lucide-react'
import { supabase } from '../supabaseClient'
import FocusMode from './FocusMode'
import useAmbientSound from '../hooks/useAmbientSound'
import { awardXP } from '../utils/xp'

const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function registerPushSubscription(userId) {
  if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready

    // subscribe() is idempotent: geeft bestaande subscription terug als die nog geldig is,
    // of maakt een nieuwe als die verlopen/verwijderd is (iOS ruimt deze op na inactiviteit).
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
    const { data: rows } = await supabase.from('push_subscriptions').select('id, vracht_enabled, vracht_notify_stops').eq('user_id', userId)
    if (rows && rows.length > 0) {
      const existing = rows[0]
      const update = { subscription: sub.toJSON() }
      if (existing.vracht_notify_stops?.length) update.vracht_enabled = true
      await supabase.from('push_subscriptions').update(update).eq('id', existing.id)
      if (rows.length > 1) {
        await supabase.from('push_subscriptions').delete().in('id', rows.slice(1).map(r => r.id))
      }
    } else {
      await supabase.from('push_subscriptions').insert({ user_id: userId, subscription: sub.toJSON() })
    }
  } catch (e) {
    console.error('Push subscribe failed:', e)
  }
}

async function sendPushNotif(userId, title, body, tag = 'pomodoro') {
  if (!userId) return
  try {
    await fetch('/.netlify/functions/pomodoro-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, tag }),
    })
  } catch (e) {
    console.error('Push notify failed:', e)
  }
}

async function saveTimerSession(userId, endTime, state) {
  if (!userId) return
  await supabase.from('timer_sessions').upsert({
    user_id: userId,
    end_time: new Date(endTime).toISOString(),
    mode: state.mode,
    sessions_in_cycle: state.sessionsInCycle,
    sessions_per_long: state.sessionsPerLong,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

async function clearTimerSession(userId) {
  if (!userId) return
  await supabase.from('timer_sessions').delete().eq('user_id', userId)
}

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

const SOUND_TYPES = [
  { id: 'off',   emoji: '🔇', label: 'Uit'    },
  { id: 'focus', emoji: '🧠', label: 'Focus'  },
  { id: 'brown', emoji: '🌫️', label: 'Brown'  },
  { id: 'rain',  emoji: '🌧️', label: 'Regen'  },
  { id: 'ocean', emoji: '🌊', label: 'Oceaan' },
]


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

// ── Audio ─────────────────────────────────────────────────────────────────────
let _audioCtx = null
function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

function playBeep(isWorkDone) {
  try {
    const ctx   = getAudioCtx()
    const notes = isWorkDone ? [523, 659, 784, 784] : [784, 659, 523, 523]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type            = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t)
      osc.stop(t + 0.45)
    })
  } catch {}
}

// ── Notifications ─────────────────────────────────────────────────────────────
function sendNotif(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.ico' }) } catch {}
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
      const newSIC = state.mode === 'longBreak' ? 0 : state.sessionsInCycle
      return { ...state, mode: next, seconds: mins * 60, running: false, sessionsInCycle: newSIC }
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

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
}

// ── Completion Popup ──────────────────────────────────────────────────────────
function CompletionPopup({ prevMode, nextMode, onStart, onSkip }) {
  const isWorkDone = prevMode === 'work'
  const modeColor  = MODES[nextMode].color
  const modeRgb    = MODES[nextMode].rgb

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 340, width: '100%',
        padding: 40, borderRadius: 24,
        background: `rgba(${modeRgb}, 0.06)`,
        border: `1px solid rgba(${modeRgb}, 0.25)`,
        boxShadow: `0 0 80px rgba(${modeRgb}, 0.2)`,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
          background: `rgba(${modeRgb}, 0.15)`,
          border: `2px solid rgba(${modeRgb}, 0.4)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px rgba(${modeRgb}, 0.3)`,
        }}>
          {isWorkDone ? <Coffee size={36} color={modeColor} /> : <Zap size={36} color={modeColor} />}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
          {isWorkDone ? 'Focus sessie klaar! 🎯' : 'Pauze voorbij!'}
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: '0 0 28px', lineHeight: 1.5 }}>
          {nextMode === 'longBreak'
            ? 'Je hebt het verdiend — neem een lange pauze.'
            : nextMode === 'break'
            ? 'Neem even een korte pauze.'
            : 'Klaar voor de volgende focus sessie?'}
        </p>

        {/* Start button — dismisses AND starts timer */}
        <button onClick={onStart} style={{
          width: '100%', padding: '14px', borderRadius: 14,
          background: `rgba(${modeRgb}, 0.2)`,
          border: `1px solid rgba(${modeRgb}, 0.4)`,
          color: modeColor, cursor: 'pointer',
          fontSize: 15, fontWeight: 700,
          boxShadow: `0 0 20px rgba(${modeRgb}, 0.15)`,
          transition: 'all 0.2s',
        }}>
          {nextMode === 'work' ? '▶ Start Focus' : nextMode === 'break' ? '☕ Start Pauze' : '🌙 Start Lange Pauze'}
        </button>

        {/* Skip — just dismisses, timer stays paused */}
        <button onClick={onSkip} style={{
          marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '6px',
        }}>
          Sla over
        </button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PomodoroTimer({ onModeChange, onPomodoroActive, onFocusModeChange, userId, noFocusOverlay = false, fullPage = false, onSessionComplete, onXPEarned }) {
  const [state, dispatch] = useReducer(reducer, INIT)
  const stateRef           = useRef(state)
  const endTimeRef         = useRef(null)
  const startTimeRef       = useRef(null)
  const intervalRef        = useRef(null)
  const channelRef         = useRef(null)
  const localControlUntil  = useRef(0)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Call this whenever the user takes a local action — blocks remote sync for 30s
  const claimLocalControl = () => { localControlUntil.current = Date.now() + 30_000 }

  // Popup state
  const [popup, setPopup] = useState(null)   // { prevMode, nextMode } | null

  // Focus mode + ambient sound state
  const [focusMode, setFocusMode]   = useState(false)
  const [soundType, setSoundType]   = useState('off')
  const [volume, setVolume]         = useState(60)

  useAmbientSound(soundType, volume / 100, state.running)

  useEffect(() => { stateRef.current = state }, [state])

  // ── Re-register push subscription on mount + periodically ────────────────
  useEffect(() => {
    if (!userId || !state.notifEnabled) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    // Registreer bij elke app-open (mount) en elke keer dat de app naar de voorgrond komt.
    // Op iOS/Android PWA wordt de push subscription door het OS gewist na inactiviteit —
    // dit zorgt dat die automatisch opnieuw aangemaakt wordt zonder dat de gebruiker
    // meldingen hoeft uit en aan te zetten.
    registerPushSubscription(userId)

    const onVisible = () => {
      if (document.visibilityState === 'visible') registerPushSubscription(userId)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, state.notifEnabled])

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
    const remainingMs = endTimeRef.current - Date.now()

    if (remainingMs <= 0) {
      clearInterval(intervalRef.current)
      endTimeRef.current = null
      const s = stateRef.current

      if (s.soundEnabled) playBeep(s.mode === 'work')

      const todayMins = s.mode === 'work' ? addFocusMins(s.workMins) : getTodayMins()
      const nextMode  = calcNextMode(s.mode, s.sessionsInCycle, s.sessionsPerLong)
      const newTotal  = s.mode === 'work' ? s.totalSessions + 1 : s.totalSessions
      // Remove session so the background cron doesn't double-fire a push
      clearTimerSession(userIdRef.current)
      onSessionComplete?.({
        mode: s.mode, durationMins: getMins(s), tag: s.task,
        startedAt: startTimeRef.current, completedAt: Date.now(),
        date: new Date().toISOString().slice(0, 10),
      })
      if (s.mode === 'work' && userIdRef.current) {
        supabase.from('pomodoro_sessions').insert({
          user_id: userIdRef.current,
          completed_at: new Date().toISOString(),
          duration_minutes: getMins(s),
          mode: 'work',
        }).then(() => {})
        const xpEarned = getMins(s)
        awardXP(userIdRef.current, xpEarned)
        onXPEarned?.(xpEarned)
      }
      startTimeRef.current = null

      if (s.notifEnabled) {
        const title = s.mode === 'work' ? 'Focus sessie klaar! 🎯' : 'Pauze voorbij!'
        const body  = nextMode === 'longBreak' ? 'Tijd voor een lange pauze.'
                    : nextMode === 'break'     ? 'Neem een pauze.'
                                               : 'Tijd om te focussen!'
        sendNotif(title, body)
      }

      // Compute next state values for broadcast (reducer hasn't run yet)
      let newSIC = s.sessionsInCycle
      if (s.mode === 'work')      newSIC = s.sessionsInCycle + 1
      else if (s.mode === 'longBreak') newSIC = 0
      const nextMins = nextMode === 'work' ? s.workMins : nextMode === 'break' ? s.breakMins : s.longBreakMins

      // Force-broadcast the completed transition so all devices advance together
      broadcastStateRef.current?.({
        ...s,
        mode: nextMode, seconds: nextMins * 60, running: false,
        sessionsInCycle: newSIC, totalSessions: newTotal,
      }, null, true)

      // Close focus mode and show popup before advancing
      setFocusMode(false); onFocusModeChange?.(false)
      setPopup({ prevMode: s.mode, nextMode })

      dispatch({ type: 'COMPLETE', prevMode: s.mode, todayMins })
      setTimeout(() => {
        onModeChange?.(nextMode !== 'work')
        onPomodoroActive?.(false)
      }, 0)
    } else {
      dispatch({ type: 'TICK', seconds: Math.ceil(remainingMs / 1000) })
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

  // Recalculate on tab focus
  useEffect(() => {
    const onVisible = () => { if (stateRef.current.running && endTimeRef.current) tick() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [tick])

  useEffect(() => {
    setTimeout(() => onPomodoroActive?.(state.running), 0)
  }, [state.running])

  useEffect(() => {
    persist(state, state.running ? endTimeRef.current : null)
  }, [
    state.running, state.mode, state.seconds, state.workMins, state.breakMins, state.longBreakMins,
    state.sessionsPerLong, state.sessionsInCycle, state.totalSessions,
    state.task, state.soundEnabled, state.notifEnabled,
  ])

  // ── Cross-device sync via Supabase Realtime ───────────────────────────────
  // Keep a ref so tick (and other stable callbacks) can always call the latest version
  const broadcastStateRef = useRef(null)

  const broadcastState = useCallback((s, endTime, forced = false) => {
    if (!channelRef.current || !userId) return
    channelRef.current.send({
      type: 'broadcast', event: 'state',
      payload: {
        mode: s.mode, workMins: s.workMins, breakMins: s.breakMins,
        longBreakMins: s.longBreakMins, sessionsPerLong: s.sessionsPerLong,
        sessionsInCycle: s.sessionsInCycle, totalSessions: s.totalSessions,
        seconds: s.seconds, running: s.running, task: s.task, endTime,
        forced,
      }
    })
  }, [userId])

  // Always keep ref in sync with latest broadcastState
  useEffect(() => { broadcastStateRef.current = broadcastState }, [broadcastState])

  function applyRemoteState(remote) {
    if (!remote) return
    const local = stateRef.current

    if (remote.forced) {
      // Forced update (user pressed start/pause/skip/reset on another device) —
      // always apply regardless of localControlUntil
      endTimeRef.current = remote.endTime || null
      dispatch({ type: 'RESTORE', payload: {
        mode: remote.mode,
        workMins: remote.workMins, breakMins: remote.breakMins,
        longBreakMins: remote.longBreakMins, sessionsPerLong: remote.sessionsPerLong,
        sessionsInCycle: remote.sessionsInCycle, totalSessions: remote.totalSessions,
        seconds: remote.running && remote.endTime
          ? Math.max(0, Math.ceil((remote.endTime - Date.now()) / 1000))
          : remote.seconds,
        running: remote.running,
        task: remote.task,
        soundEnabled: local.soundEnabled, notifEnabled: local.notifEnabled,
      }})
      return
    }

    // Non-forced (periodic tick broadcast) — respect local control window
    if (Date.now() < localControlUntil.current) return
    if (!remote.running && local.running) return

    // Fast path: both running same mode → just sync endTime, local tick handles display
    if (remote.running && local.running && remote.mode === local.mode && remote.endTime) {
      endTimeRef.current = remote.endTime
      return
    }

    // Full sync for start/pause/skip/mode-switch events
    endTimeRef.current = remote.endTime || null
    dispatch({ type: 'RESTORE', payload: {
      mode: remote.mode,
      workMins: remote.workMins, breakMins: remote.breakMins,
      longBreakMins: remote.longBreakMins, sessionsPerLong: remote.sessionsPerLong,
      sessionsInCycle: remote.sessionsInCycle, totalSessions: remote.totalSessions,
      seconds: remote.running && remote.endTime
        ? Math.max(0, Math.ceil((remote.endTime - Date.now()) / 1000))
        : remote.seconds,
      running: remote.running,
      task: remote.task,
      soundEnabled: local.soundEnabled, notifEnabled: local.notifEnabled,
    }})
  }

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`pomodoro:${userId}`, {
      config: { broadcast: { self: false } }
    })

    channel
      // Receive state from another device
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        applyRemoteState(payload)
      })
      // Another device just connected and is requesting current state
      .on('broadcast', { event: 'request_state' }, () => {
        const s = stateRef.current
        broadcastState(s, s.running ? endTimeRef.current : null)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Ask other devices for their current state
          channel.send({ type: 'broadcast', event: 'request_state', payload: {} })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [userId, broadcastState])

  // Broadcast every second while running so other devices stay frame-accurate
  useEffect(() => {
    if (!state.running || !userId) return
    const iv = setInterval(() => {
      broadcastState(stateRef.current, endTimeRef.current)
    }, 1000)
    return () => clearInterval(iv)
  }, [state.running, userId, broadcastState])

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleRunning = () => {
    claimLocalControl()
    // Warm up audio context on user gesture
    try { getAudioCtx().resume() } catch {}

    if (!state.running) {
      const endTime = Date.now() + state.seconds * 1000
      endTimeRef.current = endTime
      startTimeRef.current = Date.now()
      dispatch({ type: 'SET_RUN', value: true })
      onModeChange?.(state.mode !== 'work')
      broadcastState({ ...state, running: true }, endTime, true)
      if (!noFocusOverlay) { setFocusMode(true); onFocusModeChange?.(true) }
      if (state.notifEnabled) saveTimerSession(userIdRef.current, endTime, state)
    } else {
      const remaining = endTimeRef.current
        ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        : state.seconds
      endTimeRef.current = null
      dispatch({ type: 'PAUSE', seconds: remaining })
      broadcastState({ ...state, running: false, seconds: remaining }, null, true)
      clearTimerSession(userIdRef.current)
    }
  }

  const reset = () => {
    claimLocalControl()
    endTimeRef.current = null
    dispatch({ type: 'RESET' })
    broadcastState({ ...state, running: false, seconds: getMins(state) * 60 }, null, true)
    clearTimerSession(userIdRef.current)
  }

  const skip = () => {
    claimLocalControl()
    endTimeRef.current = null
    const next = calcNextMode(state.mode, state.sessionsInCycle, state.sessionsPerLong)
    const newSIC = state.mode === 'longBreak' ? 0 : state.sessionsInCycle
    dispatch({ type: 'SKIP' })
    setTimeout(() => onModeChange?.(next !== 'work'), 0)
    broadcastState({ ...state, running: false, sessionsInCycle: newSIC }, null, true)
    clearTimerSession(userIdRef.current)
  }

  const switchMode = (mode) => {
    if (state.running) {
      const ok = window.confirm(`Timer loopt nog. Stoppen en wisselen naar ${MODES[mode].label}?`)
      if (!ok) return
    }
    claimLocalControl()
    endTimeRef.current = null
    dispatch({ type: 'SWITCH', mode })
    setTimeout(() => onModeChange?.(mode !== 'work'), 0)
    const mins = mode === 'work' ? state.workMins : mode === 'break' ? state.breakMins : state.longBreakMins
    broadcastState({ ...state, mode, seconds: mins * 60, running: false }, null, true)
  }

  const toggleNotif = async () => {
    if (!state.notifEnabled) {
      // Enabling — request permission + register push subscription
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') return
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        alert('Meldingen zijn geblokkeerd. Sta ze toe via de browser-instellingen.')
        return
      }
      dispatch({ type: 'TOGGLE_NOTIF' })
      await registerPushSubscription(userId)
      await sendPushNotif(userId, 'Meldingen ingeschakeld 🔔', 'Je ontvangt een melding als je timer afloopt.')
    } else {
      dispatch({ type: 'TOGGLE_NOTIF' })
    }
  }

  const skipPopup = () => setPopup(null)

  const closeFocusMode = () => { setFocusMode(false); onFocusModeChange?.(false) }

  const startAfterPopup = () => {
    claimLocalControl()
    setPopup(null)
    // Start the timer for the next mode (state already advanced by COMPLETE)
    const s = stateRef.current
    const endTime = Date.now() + s.seconds * 1000
    endTimeRef.current = endTime
    dispatch({ type: 'SET_RUN', value: true })
    onModeChange?.(s.mode !== 'work')
    broadcastState({ ...s, running: true }, endTime, true)
    if (s.notifEnabled) saveTimerSession(userIdRef.current, endTime, s)
  }

  // ── Display ───────────────────────────────────────────────────────────────
  const {
    mode, seconds, running, sessionsInCycle, sessionsPerLong, totalSessions,
    task, soundEnabled, notifEnabled, showSettings, todayMins,
    workMins, breakMins, longBreakMins,
  } = state

  const currentMins   = getMins(state)
  const totalSecs     = currentMins * 60
  const progress      = seconds / totalSecs
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

  // ── Full-page render ──────────────────────────────────────────────────────
  if (fullPage) {
    const bigR    = 100
    const bigCirc = 2 * Math.PI * bigR
    const bigDash = bigCirc * (1 - progress)

    return (
      <>
        {popup && createPortal(
          <CompletionPopup prevMode={popup.prevMode} nextMode={popup.nextMode} onStart={startAfterPopup} onSkip={skipPopup} />,
          document.body
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 32px', gap: 18, boxSizing: 'border-box' }}>

          {/* Sound + notif row */}
          <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end' }}>
            <button onClick={() => dispatch({ type: 'TOGGLE_SOUND' })} style={iconBtn} title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}>
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button onClick={toggleNotif} style={iconBtn} title={notifEnabled ? 'Meldingen uit' : 'Meldingen aan'}>
              {notifEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
            {notifEnabled && (
              <button
                onClick={() => sendPushNotif(userId, 'Test melding 🔔', 'Push meldingen werken correct!')}
                style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Test
              </button>
            )}
          </div>

          {/* Mode selector — hidden when running, label shown instead */}
          {!running ? (
            <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, border: '1px solid rgba(255,255,255,0.07)' }}>
              {Object.entries(MODES).map(([key, { label, color, rgb }]) => (
                <button key={key} onClick={() => switchMode(key)} style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: mode === key ? `rgba(${rgb},0.15)` : 'transparent',
                  color: mode === key ? color : 'rgba(255,255,255,0.3)',
                }}>
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
              {MODES[mode].label}
            </span>
          )}

          {/* Large ring */}
          <div style={{ position: 'relative', width: 240, height: 240 }}>
            <svg width="240" height="240" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="120" cy="120" r={bigR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <circle cx="120" cy="120" r={bigR} fill="none" stroke={modeColor} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={bigCirc} strokeDashoffset={bigDash}
                style={{ filter: `drop-shadow(0 0 14px ${modeColor}60)`, transition: 'stroke-dashoffset 0.5s ease, stroke 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 54, fontWeight: 700, fontFamily: 'monospace', color: modeColor, lineHeight: 1, letterSpacing: -2, textShadow: `0 0 30px ${modeColor}50`, transition: 'color 0.6s' }}>
                {mm}:{ss}
              </span>
            </div>
          </div>

          {/* Cycle dots */}
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: sessionsPerLong }, (_, i) => {
              const done = i < sessionsInCycle
              return (
                <div key={i} style={{
                  width: done ? 10 : 7, height: done ? 10 : 7,
                  borderRadius: '50%', marginTop: done ? 0 : 1.5,
                  background: done ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  boxShadow: done ? '0 0 8px rgba(0,255,209,0.5)' : 'none',
                  transition: 'all 0.3s',
                }} />
              )
            })}
          </div>

          {/* Tag input */}
          <input
            type="text"
            placeholder="Waar werk je aan? (optioneel)"
            value={task}
            onChange={e => dispatch({ type: 'SET_TASK', v: e.target.value })}
            style={{
              width: '100%', maxWidth: 380, boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '11px 16px',
              color: 'rgba(255,255,255,0.8)', fontSize: 14, outline: 'none', textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = `rgba(${modeRgb},0.35)` }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
          />

          {/* Setup pills — visible only when not running */}
          {!running && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', width: 46, textAlign: 'right', flexShrink: 0 }}>Focus</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {[15, 20, 25, 30, 45, 60].map(n => (
                    <button key={n} onClick={() => dispatch({ type: 'SET_WORK_MINS', v: n })} style={{
                      padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: workMins === n ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.06)',
                      color: workMins === n ? '#00FFD1' : 'rgba(255,255,255,0.4)',
                    }}>{n}m</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', width: 46, textAlign: 'right', flexShrink: 0 }}>Pauze</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[5, 10, 15, 20].map(n => (
                    <button key={n} onClick={() => dispatch({ type: 'SET_BREAK_MINS', v: n })} style={{
                      padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: breakMins === n ? 'rgba(255,140,66,0.15)' : 'rgba(255,255,255,0.06)',
                      color: breakMins === n ? '#FF8C42' : 'rgba(255,255,255,0.4)',
                    }}>{n}m</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', width: 46, textAlign: 'right', flexShrink: 0 }}>Lang</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[10, 15, 20, 30].map(n => (
                    <button key={n} onClick={() => dispatch({ type: 'SET_LBRK_MINS', v: n })} style={{
                      padding: '5px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: longBreakMins === n ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)',
                      color: longBreakMins === n ? '#A78BFA' : 'rgba(255,255,255,0.4)',
                    }}>{n}m</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Ambient sound picker */}
          <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {SOUND_TYPES.map(({ id, emoji, label: lbl }) => (
                <button key={id} onClick={() => setSoundType(id)} style={{
                  padding: '5px 11px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  background: soundType === id ? `rgba(${modeRgb},0.15)` : 'rgba(255,255,255,0.06)',
                  color: soundType === id ? modeColor : 'rgba(255,255,255,0.4)',
                  borderColor: soundType === id ? `rgba(${modeRgb},0.4)` : 'rgba(255,255,255,0.08)',
                }}>{emoji} {lbl}</button>
              ))}
            </div>
            {soundType !== 'off' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <VolumeX size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(+e.target.value)}
                  style={{ flex: 1, accentColor: modeColor }} />
                <Volume2 size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {!running && (
              <button onClick={reset} title="Reset" style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={16} />
              </button>
            )}
            <button onClick={toggleRunning} style={{
              height: 52, padding: '0 44px', borderRadius: 16,
              border: `1px solid rgba(${modeRgb},0.45)`,
              background: `rgba(${modeRgb},0.12)`,
              color: modeColor, cursor: 'pointer', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: running ? `0 0 40px rgba(${modeRgb},0.2)` : 'none',
              transition: 'all 0.2s',
            }}>
              {running ? <><Pause size={18} /> Pauzeer</> : <><Play size={18} /> {seconds === totalSecs ? 'Start' : 'Hervat'}</>}
            </button>
            {running && (
              <button onClick={skip} title="Sla over" style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SkipForward size={16} />
              </button>
            )}
          </div>

          {/* Today stats */}
          {(todayMins > 0 || totalSessions > 0) && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>
              {todayMins > 0 ? `Vandaag ${todayStr} gefocust` : ''}
              {totalSessions > 0 ? `${todayMins > 0 ? ' · ' : ''}${totalSessions} sessie${totalSessions !== 1 ? 's' : ''}` : ''}
            </span>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {/* Completion popup — via portal zodat het boven alle widgets staat */}
      {popup && createPortal(
        <CompletionPopup
          prevMode={popup.prevMode}
          nextMode={popup.nextMode}
          onStart={startAfterPopup}
          onSkip={skipPopup}
        />,
        document.body
      )}

      {/* Focus mode overlay */}
      {focusMode && !popup && !noFocusOverlay && (
        <FocusMode
          mode={mode}
          seconds={seconds}
          totalSecs={totalSecs}
          running={running}
          task={task}
          sessionsInCycle={sessionsInCycle}
          sessionsPerLong={sessionsPerLong}
          onToggleRunning={toggleRunning}
          onReset={reset}
          onSkip={skip}
          onClose={closeFocusMode}
          soundType={soundType}
          onSoundType={setSoundType}
          volume={volume}
          onVolume={setVolume}
        />
      )}

      <div
        className="glass-card transition-all duration-700"
        style={{
          padding: '18px',
          borderLeft: `3px solid rgba(${modeRgb},0.45)`,
          background: `linear-gradient(135deg, rgba(${modeRgb},0.06) 0%, transparent 60%)`,
          boxShadow: running
            ? `0 0 40px rgba(${modeRgb},0.18), inset 0 0 30px rgba(${modeRgb},0.04)`
            : undefined,
          borderColor: running ? `rgba(${modeRgb},0.3)` : undefined,
          transition: 'border-color 0.6s, background 0.6s, box-shadow 0.6s',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `rgba(${modeRgb},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.6s' }}>
              <Timer size={12} style={{ color: modeColor }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: modeColor, transition: 'color 0.6s' }}>
              POMODORO
            </span>
            {/* Compact time display always visible in header */}
            {running && (
              <span style={{
                fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                color: modeColor, letterSpacing: 1,
                textShadow: `0 0 12px ${modeColor}60`,
              }}>
                {mm}:{ss}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => dispatch({ type: 'TOGGLE_SOUND' })} style={iconBtn} title={soundEnabled ? 'Geluid uit' : 'Geluid aan'}>
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button onClick={toggleNotif} style={iconBtn} title={notifEnabled ? 'Meldingen uit' : 'Meldingen aan'}>
              {notifEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            </button>
            {notifEnabled && (
              <button
                onClick={() => sendPushNotif(userId, 'Test melding 🔔', 'Push meldingen werken correct!')}
                style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Test
              </button>
            )}
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
              <circle cx="82" cy="82" r={radius} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
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
          <button onClick={reset} style={iconBtn} title="Reset">
            <RotateCcw size={15} />
          </button>

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

          <button onClick={skip} style={iconBtn} title="Sla over">
            <SkipForward size={15} />
          </button>

          {!noFocusOverlay && (
            <button
              onClick={() => { setFocusMode(true); onFocusModeChange?.(true) }}
              title="Focusmodus"
              style={{
                ...iconBtn,
                display: 'flex', alignItems: 'center', gap: 4,
                width: 'auto', padding: '0 10px', fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <Maximize2 size={13} /> Focus
            </button>
          )}
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
    </>
  )
}
