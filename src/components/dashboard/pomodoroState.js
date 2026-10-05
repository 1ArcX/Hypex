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
  if (!s?.running || !s.endTime) return
  write({ running: false, endTime: null, remainingSeconds: Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000)) })
}

export function resumePomodoro() {
  const s = load()
  if (!s || s.running || !s.remainingSeconds) return
  write({ running: true, endTime: Date.now() + s.remainingSeconds * 1000 })
}

export const fmtClock = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
