import { toISO } from '../../utils/recurrence'

// Timerstatus zoals PomodoroTimer die bewaart (localStorage `pomodoro_v3` / `pomodoro_stats`).
// Gedeeld door de dashboard-widget en de banner. Pauzeren/hervatten schrijft hetzelfde formaat
// terug; PomodoroTimer neemt dat over zodra de Pomodoro-pagina opent.

const LS_KEY = 'pomodoro_v3'

export const POMO_MODE = {
  work:      { label: 'Focus',       color: 'var(--accent)' },
  break:     { label: 'Pauze',       color: 'var(--c-warning)' },
  longBreak: { label: 'Lange pauze', color: 'var(--cat-persoonlijk)' },
}

const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null } }

export function readPomodoro() {
  const s = load()
  if (s?.timerKind === 'stopwatch') {
    // Stopwatch (Focus-tab): `remaining` is hier de verstreken tijd, `total` 0
    const elapsed = Math.floor((s.swAccum || 0) + (s.running && s.swStart ? (Date.now() - s.swStart) / 1000 : 0))
    let todayMins = 0
    try { todayMins = (JSON.parse(localStorage.getItem('pomodoro_stats')) || {})[toISO(new Date())] || 0 } catch {}
    const running = !!(s.running && s.swStart)
    return {
      mode: 'work', running, remaining: elapsed, total: 0, todayMins, stopwatch: true,
      task: s.task || '', paused: !running && elapsed > 0,
      sessionsInCycle: s.sessionsInCycle || 0, sessionsPerLong: s.sessionsPerLong || 4,
    }
  }
  const mode = s?.mode || 'work'
  const totalMins = mode === 'work' ? (s?.workMins ?? 25) : mode === 'break' ? (s?.breakMins ?? 5) : (s?.longBreakMins ?? 15)
  const total = totalMins * 60
  let remaining = total
  if (s?.running && s.endTime) remaining = Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000))
  else if (s && typeof s.remainingSeconds === 'number') remaining = s.remainingSeconds
  let todayMins = 0
  try { todayMins = (JSON.parse(localStorage.getItem('pomodoro_stats')) || {})[toISO(new Date())] || 0 } catch {}
  const running = !!s?.running && remaining > 0
  return {
    mode, running, remaining, total, todayMins,
    task: s?.task || '',
    // Gepauzeerd midden in een sessie (niet: nog niet begonnen)
    paused: !running && remaining > 0 && remaining < total,
    sessionsInCycle: s?.sessionsInCycle || 0,
    sessionsPerLong: s?.sessionsPerLong || 4,
  }
}

function write(patch) {
  const s = load()
  if (!s) return
  localStorage.setItem(LS_KEY, JSON.stringify({ ...s, ...patch }))
  window.dispatchEvent(new Event('pomodoroLocalChange'))
}

export function pausePomodoro() {
  const s = load()
  if (s?.timerKind === 'stopwatch') {
    if (!s.running || !s.swStart) return
    write({ running: false, swAccum: (s.swAccum || 0) + (Date.now() - s.swStart) / 1000, swStart: null })
    return
  }
  if (!s?.running || !s.endTime) return
  write({ running: false, endTime: null, remainingSeconds: Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000)) })
}

export function resumePomodoro() {
  const s = load()
  if (s?.timerKind === 'stopwatch') {
    if (s.running) return
    write({ running: true, swStart: Date.now() })
    return
  }
  if (!s || s.running || !s.remainingSeconds) return
  write({ running: true, endTime: Date.now() + s.remainingSeconds * 1000 })
}

export const fmtClock = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
