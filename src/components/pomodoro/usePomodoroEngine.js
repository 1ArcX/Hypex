import { useEffect, useRef, useCallback, useReducer, useState } from 'react'
import { supabase } from '../../supabaseClient'
import useAmbientSound from '../../hooks/useAmbientSound'
import { recordFocusSession, loadFocusDays } from '../../hooks/useFocusProgress'
import { awardXP } from '../../utils/xp'
import { toISO } from '../../utils/recurrence'
import { useFocusStore } from '../../focus/store/focusStore'

// Timer-engine (focus/pauze-cycli, stopwatch, sync tussen apparaten, push, `pomodoro_v3`).
// Gedeeld door de Focus-tab en de (verborgen) Pomodoro-pagina; UI zit in de componenten.

const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registerPushSubscription(userId) {
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
const LS_AMBIENT = 'pomodoro_ambient'

function loadAmbient() {
  try { return JSON.parse(localStorage.getItem(LS_AMBIENT)) || {} } catch { return {} }
}

function getTodayKey() { return toISO(new Date()) }

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

export const SOUND_TYPES = [
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
    goal: s.goal, checklist: s.checklist,
    running: s.running, remainingSeconds: s.seconds, endTime,
    timerKind: s.timerKind, swAccum: s.swAccum, swStart: s.swStart, swFirstStart: s.swFirstStart, meta: s.meta,
  }))
}

// Stopwatch: verstreken seconden = opgebouwd + lopend stuk
export const swElapsed = (s, now = Date.now()) => Math.max(0, Math.floor((s.swAccum || 0) + (s.swStart ? (now - s.swStart) / 1000 : 0)))

// Sessie opslaan met de Focus-velden; zonder migratie terugvallen op de basiskolommen
const SESSION_COLS = 'id, completed_at, started_at, duration_minutes, course_id, topic_id, kind, rating, note, timer_kind, task_id'
async function insertSession(row) {
  const { data, error } = await supabase.from('pomodoro_sessions').insert(row).select(SESSION_COLS).single()
  if (!error) return data
  const { user_id, completed_at, duration_minutes, mode } = row
  const res = await supabase.from('pomodoro_sessions').insert({ user_id, completed_at, duration_minutes, mode }).select('id, completed_at, duration_minutes').single()
  return res.data ? { started_at: null, course_id: null, topic_id: null, kind: null, rating: null, note: null, timer_kind: null, task_id: null, ...res.data } : null
}

export const EMPTY_META = { courseId: null, topicId: null, kind: null, note: '', taskId: null }

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
export const MODES = {
  work:      { label: 'Focus',       color: 'var(--accent)',   maxMins: 180 },
  break:     { label: 'Pauze',       color: '#FF8C42',  maxMins: 60 },
  longBreak: { label: 'Lang',        color: '#A78BFA', maxMins: 90 },
}

const clampMins = (v, max) => Math.max(1, Math.min(max, Math.round(v) || 1))

function calcNextMode(mode, sessionsInCycle, sessionsPerLong) {
  if (mode !== 'work') return 'work'
  return (sessionsInCycle + 1) >= sessionsPerLong ? 'longBreak' : 'break'
}

export function getMins(s) {
  return s.mode === 'work' ? s.workMins : s.mode === 'break' ? s.breakMins : s.longBreakMins
}

// ── Reducer ───────────────────────────────────────────────────────────────────
const INIT = {
  mode: 'work', workMins: 25, breakMins: 5, longBreakMins: 15, sessionsPerLong: 4,
  sessionsInCycle: 0, totalSessions: 0, seconds: 25 * 60, running: false,
  task: '', soundEnabled: true, notifEnabled: false, showSettings: false,
  goal: null,       // { kind: 'preset'|'task', value, taskId? }
  checklist: [],    // [{ id, label, taskId?, done }]
  todayMins: getTodayMins(),
  // Stopwatch (Focus-tab): telt op; `seconds` = verstreken tijd
  timerKind: 'pomodoro', // 'pomodoro' | 'stopwatch'
  swAccum: 0, swStart: null, swFirstStart: null,
  // Waar de sessie over gaat (Focus-tab)
  meta: EMPTY_META,
}

function reducer(state, action) {
  switch (action.type) {
    case 'RESTORE':   return { ...state, ...action.payload, todayMins: getTodayMins() }
    case 'TICK':      return { ...state, seconds: action.seconds }
    case 'SET_RUN':   return { ...state, running: action.value }
    case 'PAUSE':     return { ...state, running: false, seconds: action.seconds }
    case 'RESET':     return state.timerKind === 'stopwatch'
      ? { ...state, running: false, seconds: 0, swAccum: 0, swStart: null, swFirstStart: null }
      : { ...state, running: false, seconds: getMins(state) * 60 }
    case 'SET_TIMER_KIND':
      if (state.running || state.timerKind === action.v) return state
      return action.v === 'stopwatch'
        ? { ...state, timerKind: 'stopwatch', mode: 'work', seconds: 0, swAccum: 0, swStart: null, swFirstStart: null }
        : { ...state, timerKind: 'pomodoro', mode: 'work', seconds: state.workMins * 60 }
    case 'SW_START':  return { ...state, running: true, swStart: action.at, swFirstStart: state.swFirstStart || action.at }
    case 'SW_PAUSE': {
      const swAccum = (state.swAccum || 0) + (state.swStart ? (action.at - state.swStart) / 1000 : 0)
      return { ...state, running: false, swAccum, swStart: null, seconds: Math.floor(swAccum) }
    }
    case 'SET_META':  return { ...state, meta: { ...state.meta, ...action.patch } }
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
    case 'SET_WORK_MINS':  { const v = clampMins(action.v, MODES.work.maxMins);      return { ...state, workMins: v,      seconds: state.mode === 'work'      && !state.running && state.timerKind !== 'stopwatch' ? v * 60 : state.seconds } }
    case 'SET_BREAK_MINS': { const v = clampMins(action.v, MODES.break.maxMins);     return { ...state, breakMins: v,     seconds: state.mode === 'break'     && !state.running && state.timerKind !== 'stopwatch' ? v * 60 : state.seconds } }
    case 'SET_LBRK_MINS':  { const v = clampMins(action.v, MODES.longBreak.maxMins); return { ...state, longBreakMins: v, seconds: state.mode === 'longBreak' && !state.running && state.timerKind !== 'stopwatch' ? v * 60 : state.seconds } }
    case 'SET_SPL':        return { ...state, sessionsPerLong: Math.max(1, Math.min(12, Math.round(action.v) || 1)) }
    case 'SET_TASK':       return { ...state, task: action.v }
    case 'TOGGLE_SOUND':   return { ...state, soundEnabled: !state.soundEnabled }
    case 'TOGGLE_NOTIF':   return { ...state, notifEnabled: !state.notifEnabled }
    case 'TOGGLE_SETTINGS':return { ...state, showSettings: !state.showSettings }
    // Sessie doel + checklist
    case 'SET_GOAL':       return { ...state, goal: action.v }
    case 'SET_GOALS':      return { ...state, goal: action.goal ?? null, checklist: action.checklist ?? [] }
    case 'ADD_CHECK':
      if (action.item.taskId && state.checklist.some(c => c.taskId === action.item.taskId)) return state
      return { ...state, checklist: [...state.checklist, action.item] }
    case 'SET_CHECK':      return { ...state, checklist: state.checklist.map(c => c.id === action.id ? { ...c, done: action.done } : c) }
    case 'REMOVE_CHECK':   return { ...state, checklist: state.checklist.filter(c => c.id !== action.id) }
    case 'CLEAR_DONE_CHECK': return { ...state, checklist: state.checklist.filter(c => !action.ids.includes(c.id)) }
    default: return state
  }
}


// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePomodoroEngine({ onModeChange, onPomodoroActive, onFocusModeChange, userId, noFocusOverlay = false, onSessionComplete, seedTask, onSeedConsumed } = {}) {
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
  const [soundType, setSoundType]   = useState(() => loadAmbient().soundType || 'off')
  const [volume, setVolume]         = useState(() => loadAmbient().volume ?? 60)
  const [scene, setScene]           = useState(() => loadAmbient().scene || 'auto') // achtergrond: 'auto' = volgt focusgeluid

  useAmbientSound(soundType, volume / 100, state.running)

  // Ambient keuze is per apparaat
  useEffect(() => {
    try { localStorage.setItem(LS_AMBIENT, JSON.stringify({ soundType, volume, scene })) } catch {}
  }, [soundType, volume, scene])

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
            task = '', soundEnabled = true, notifEnabled = false,
            goal = null, checklist = [] } = s
    const sw = { timerKind: s.timerKind || 'pomodoro', swAccum: s.swAccum || 0, swStart: s.swStart || null, swFirstStart: s.swFirstStart || null, meta: { ...EMPTY_META, ...(s.meta || {}) } }
    if (sw.timerKind === 'stopwatch') {
      dispatch({ type: 'RESTORE', payload: {
        mode: 'work', workMins, breakMins, longBreakMins, sessionsPerLong, sessionsInCycle, totalSessions,
        task, soundEnabled, notifEnabled, goal, checklist, ...sw,
        running: !!(s.running && sw.swStart), seconds: swElapsed(sw),
      }})
      return
    }

    if (s.running && s.endTime) {
      const remaining = Math.ceil((s.endTime - Date.now()) / 1000)
      if (remaining > 0) {
        endTimeRef.current = s.endTime
        dispatch({ type: 'RESTORE', payload: {
          mode, workMins, breakMins, longBreakMins, sessionsPerLong,
          sessionsInCycle, totalSessions, seconds: remaining, running: true,
          task, soundEnabled, notifEnabled, goal, checklist, meta: sw.meta,
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
          seconds: nextMins * 60, running: false, task, soundEnabled, notifEnabled, goal, checklist, meta: sw.meta,
        }})
        setTimeout(() => onModeChange?.(nextMode !== 'work'), 0)
      }
    } else {
      dispatch({ type: 'RESTORE', payload: {
        mode, workMins, breakMins, longBreakMins, sessionsPerLong,
        sessionsInCycle, totalSessions,
        seconds: s.remainingSeconds ?? workMins * 60,
        running: false, task, soundEnabled, notifEnabled, goal, checklist, meta: sw.meta,
      }})
    }
  }, [])

  // ── Sessie afronden (pomodoro-focus en stopwatch) ─────────────────────────
  // Beloning eerst berekenen: vóór `pomodoro_stats` deze sessie al meetelt.
  function finishFocusSession(s, mins, startedAtMs, timerKind) {
    const reward = recordFocusSession(mins)
    const todayMins = addFocusMins(mins)
    const uid = userIdRef.current
    let sessionPromise = Promise.resolve(null)
    if (uid) {
      const m = s.meta || EMPTY_META
      sessionPromise = insertSession({
        user_id: uid, mode: 'work', duration_minutes: mins,
        completed_at: new Date().toISOString(), started_at: new Date(startedAtMs).toISOString(),
        course_id: m.courseId, topic_id: m.topicId, kind: m.kind, note: m.note?.trim() || null,
        task_id: m.taskId, timer_kind: timerKind,
      }).then(row => {
        if (row) useFocusStore.getState().pushSession(row)
        loadFocusDays(uid, { force: true })
        return row
      })
      // XP staat op het beloningsscherm, dus geen los toastje
      reward.xp = Math.round(Math.pow(mins, 1.4) / 8)
      awardXP(uid, reward.xp)
    }
    // Notitie hoort bij deze sessie; vak/onderwerp blijven staan voor de volgende
    if (s.meta?.note) dispatch({ type: 'SET_META', patch: { note: '' } })
    return { reward, todayMins, sessionPromise }
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const cur = stateRef.current
    if (cur.timerKind === 'stopwatch') {
      if (cur.running && cur.swStart) dispatch({ type: 'TICK', seconds: swElapsed(cur) })
      return
    }
    if (!endTimeRef.current) return
    const remainingMs = endTimeRef.current - Date.now()

    if (remainingMs <= 0) {
      clearInterval(intervalRef.current)
      endTimeRef.current = null
      const s = stateRef.current

      if (s.soundEnabled) playBeep(s.mode === 'work')

      const done = s.mode === 'work'
        ? finishFocusSession(s, getMins(s), startTimeRef.current || Date.now() - getMins(s) * 60000, 'pomodoro')
        : null
      const reward = done?.reward || null
      const todayMins = done ? done.todayMins : getTodayMins()
      const nextMode  = calcNextMode(s.mode, s.sessionsInCycle, s.sessionsPerLong)
      const newTotal  = s.mode === 'work' ? s.totalSessions + 1 : s.totalSessions
      // Remove session so the background cron doesn't double-fire a push
      clearTimerSession(userIdRef.current)
      const checkDone = s.checklist.filter(c => c.done)
      onSessionComplete?.({
        mode: s.mode, durationMins: getMins(s), tag: s.task,
        goal: s.mode === 'work' ? (s.goal?.value || null) : null,
        checkDone: s.mode === 'work' ? checkDone.length : 0,
        checkTotal: s.mode === 'work' ? s.checklist.length : 0,
        startedAt: startTimeRef.current, completedAt: Date.now(),
        date: toISO(new Date()),
      })
      // Afgeronde checklist-items vallen weg na een focussessie; open items gaan mee
      if (s.mode === 'work' && checkDone.length) {
        const ids = checkDone.map(c => c.id)
        dispatch({ type: 'CLEAR_DONE_CHECK', ids })
        broadcastGoalsRef.current?.(s.goal, s.checklist.filter(c => !ids.includes(c.id)))
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
      setPopup({ prevMode: s.mode, nextMode, reward, tag: s.task, sessionPromise: done?.sessionPromise, meta: s.meta })

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
    state.task, state.soundEnabled, state.notifEnabled, state.goal, state.checklist,
    state.timerKind, state.swAccum, state.swStart, state.meta,
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
        timerKind: s.timerKind, swAccum: s.swAccum, swStart: s.swStart, swFirstStart: s.swFirstStart, meta: s.meta,
        forced,
      }
    })
  }, [userId])

  // Always keep ref in sync with latest broadcastState
  useEffect(() => { broadcastStateRef.current = broadcastState }, [broadcastState])

  // Sessie doel + checklist: eigen event, altijd toegepast (los van de timer-sync)
  const broadcastGoalsRef = useRef(null)
  const broadcastGoals = useCallback((goal, checklist) => {
    if (!channelRef.current || !userId) return
    channelRef.current.send({ type: 'broadcast', event: 'goals', payload: { goal, checklist } })
  }, [userId])
  useEffect(() => { broadcastGoalsRef.current = broadcastGoals }, [broadcastGoals])

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
        ...remoteSw(remote, local),
      }})
      return
    }

    // Non-forced (periodic tick broadcast) — respect local control window
    if (Date.now() < localControlUntil.current) return
    if (!remote.running && local.running) return

    // Fast path: both running same mode → just sync endTime, local tick handles display
    if (remote.running && local.running && remote.mode === local.mode && remote.endTime && remote.timerKind !== 'stopwatch') {
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
      ...remoteSw(remote, local),
    }})
  }

  // Stopwatch-velden van een ander apparaat (oudere versies sturen ze niet mee)
  function remoteSw(remote, local) {
    if (!remote.timerKind) return {}
    const sw = { timerKind: remote.timerKind, swAccum: remote.swAccum || 0, swStart: remote.swStart || null, swFirstStart: remote.swFirstStart || null, meta: { ...EMPTY_META, ...(remote.meta || local.meta) } }
    return remote.timerKind === 'stopwatch' ? { ...sw, seconds: swElapsed(sw) } : sw
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
      .on('broadcast', { event: 'goals' }, ({ payload }) => {
        dispatch({ type: 'SET_GOALS', goal: payload?.goal, checklist: payload?.checklist })
      })
      // Another device just connected and is requesting current state
      .on('broadcast', { event: 'request_state' }, () => {
        const s = stateRef.current
        broadcastState(s, s.running ? endTimeRef.current : null)
        if (s.goal || s.checklist.length) broadcastGoals(s.goal, s.checklist)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Ask other devices for their current state
          channel.send({ type: 'broadcast', event: 'request_state', payload: {} })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [userId, broadcastState, broadcastGoals])

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

    if (state.timerKind === 'stopwatch') {
      const at = Date.now()
      if (!state.running) {
        dispatch({ type: 'SW_START', at })
        broadcastState({ ...state, running: true, swStart: at, swFirstStart: state.swFirstStart || at }, null, true)
      } else {
        const swAccum = (state.swAccum || 0) + (state.swStart ? (at - state.swStart) / 1000 : 0)
        dispatch({ type: 'SW_PAUSE', at })
        broadcastState({ ...state, running: false, swAccum, swStart: null, seconds: Math.floor(swAccum) }, null, true)
      }
      return
    }

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
    broadcastState(state.timerKind === 'stopwatch'
      ? { ...state, running: false, seconds: 0, swAccum: 0, swStart: null, swFirstStart: null }
      : { ...state, running: false, seconds: getMins(state) * 60 }, null, true)
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

  // Stopwatch stoppen = sessie afronden. Onder 1 minuut: niets opslaan, gewoon terugzetten.
  const stopStopwatch = () => {
    claimLocalControl()
    const s = stateRef.current
    const elapsed = swElapsed(s)
    const mins = Math.floor(elapsed / 60)
    dispatch({ type: 'RESET' })
    broadcastState({ ...s, running: false, seconds: 0, swAccum: 0, swStart: null, swFirstStart: null }, null, true)
    if (mins < 1) return { saved: false }
    if (s.soundEnabled) playBeep(true)
    const done = finishFocusSession(s, mins, s.swFirstStart || Date.now() - elapsed * 1000, 'stopwatch')
    onSessionComplete?.({
      mode: 'work', durationMins: mins, tag: s.task, goal: s.goal?.value || null, checkDone: 0, checkTotal: 0,
      startedAt: s.swFirstStart, completedAt: Date.now(), date: toISO(new Date()),
    })
    setPopup({ prevMode: 'work', nextMode: 'work', reward: done.reward, tag: s.task, sessionPromise: done.sessionPromise, meta: s.meta, stopwatch: true })
    return { saved: true }
  }

  const setTimerKind = (v) => {
    if (stateRef.current.running) return
    claimLocalControl()
    dispatch({ type: 'SET_TIMER_KIND', v })
    const s = stateRef.current
    broadcastState(v === 'stopwatch'
      ? { ...s, timerKind: v, mode: 'work', seconds: 0, swAccum: 0, swStart: null, swFirstStart: null }
      : { ...s, timerKind: v, mode: 'work', seconds: s.workMins * 60 }, null, true)
  }

  // Vak/onderwerp/soort/notitie van de lopende sessie; gesynchroniseerd met andere apparaten
  const setMeta = (patch) => {
    dispatch({ type: 'SET_META', patch })
    const s = stateRef.current
    broadcastState({ ...s, meta: { ...s.meta, ...patch } }, s.running ? endTimeRef.current : null, true)
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

  // ── Sessie doel API (voor de kaart op de Pomodoro-pagina) ─────────────────
  // Past lokaal toe en broadcast de nieuwe goal/checklist naar andere apparaten.
  const commitGoals = (goal, checklist) => {
    dispatch({ type: 'SET_GOALS', goal, checklist })
    broadcastGoals(goal, checklist)
  }
  const goalApi = {
    setGoal: (goal) => commitGoals(goal, stateRef.current.checklist),
    addCheck: (item) => {
      const cur = stateRef.current.checklist
      if (item.taskId && cur.some(c => c.taskId === item.taskId)) return
      commitGoals(stateRef.current.goal, [...cur, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, done: false, ...item }])
    },
    setCheck: (id, done) => commitGoals(stateRef.current.goal, stateRef.current.checklist.map(c => c.id === id ? { ...c, done } : c)),
    removeCheck: (id) => commitGoals(stateRef.current.goal, stateRef.current.checklist.filter(c => c.id !== id)),
    setTask: (v) => dispatch({ type: 'SET_TASK', v }),
  }

  // Taak meegegeven via "Start pomodoro" in het taakdetail → wordt het sessiedoel
  useEffect(() => {
    if (!seedTask) return
    const t = setTimeout(() => {
      commitGoals({ kind: 'task', value: seedTask.title, taskId: seedTask.id }, stateRef.current.checklist)
      dispatch({ type: 'SET_TASK', v: seedTask.title })
      dispatch({ type: 'SET_META', patch: { taskId: seedTask.id } })
      onSeedConsumed?.()
    }, 0)
    return () => clearTimeout(t)
  }, [seedTask])

  return {
    state, dispatch, popup, setPopup, focusMode, setFocusMode,
    soundType, setSoundType, volume, setVolume, scene, setScene,
    toggleRunning, reset, skip, switchMode, toggleNotif, skipPopup, closeFocusMode, startAfterPopup,
    stopStopwatch, setTimerKind, setMeta,
    goalApi, sendTestNotif: () => sendPushNotif(userId, 'Test melding 🔔', 'Push meldingen werken correct!'),
  }
}
