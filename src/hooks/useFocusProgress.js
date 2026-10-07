import { useEffect, useMemo, useReducer } from 'react'
import { supabase } from '../supabaseClient'
import { toISO } from '../utils/recurrence'

// Focusvoortgang (streak, dagdoel, week, records) uit `pomodoro_sessions`, gedeeld door het
// beloningsscherm, de Pomodoro-pagina, het dashboard en Statistieken. Eén module-store zodat
// een afgeronde sessie overal direct zichtbaar is.

const LS_STATS = 'pomodoro_stats'       // { 'YYYY-MM-DD': minuten } — lokaal, door PomodoroTimer
const LS_GOAL  = 'focus_daily_goal'      // minuten per dag
const LS_CACHE = 'focus_days_cache'      // laatste DB-stand, zodat het meteen klopt na openen
export const DEFAULT_GOAL = 120
const HISTORY_DAYS = 400
const STALE_MS = 60_000

const TOTAL_MILESTONES  = [10, 25, 50, 100, 250, 500, 1000]   // uur
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365]        // dagen

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb } catch { return fb } }

let store = {
  userId: null,
  dbDays: readJSON(LS_CACHE, {})?.days || {},
  extra: {},            // optimistisch toegevoegd, tot de DB het bevestigt
  goal: Number(readJSON(LS_GOAL, DEFAULT_GOAL)) || DEFAULT_GOAL,
  at: 0,
  version: 0,
}
const listeners = new Set()
let inflight = null

function set(patch) {
  store = { ...store, ...patch, version: store.version + 1 }
  listeners.forEach(l => l())
}

function mergedDays() {
  const local = readJSON(LS_STATS, {}) || {}
  const out = { ...store.dbDays }
  for (const [d, m] of Object.entries(store.extra)) out[d] = (out[d] || 0) + m
  for (const [d, m] of Object.entries(local)) out[d] = Math.max(out[d] || 0, m || 0)
  return out
}

export async function loadFocusDays(userId, { force = false } = {}) {
  if (!userId) return
  if (!force && store.userId === userId && Date.now() - store.at < STALE_MS) return
  if (inflight) return inflight
  const from = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString()
  inflight = (async () => {
    const days = {}
    for (let page = 0; page < 20; page++) {
      const { data, error } = await supabase.from('pomodoro_sessions')
        .select('completed_at, duration_minutes')
        .eq('user_id', userId).eq('mode', 'work').gte('completed_at', from)
        .order('completed_at', { ascending: true })
        .range(page * 1000, page * 1000 + 999)
      if (error) return
      for (const r of data || []) {
        if (!r.completed_at) continue
        const d = toISO(new Date(r.completed_at))
        days[d] = (days[d] || 0) + (r.duration_minutes || 0)
      }
      if (!data || data.length < 1000) break
    }
    try { localStorage.setItem(LS_CACHE, JSON.stringify({ userId, days })) } catch {}
    set({ userId, dbDays: days, extra: {}, at: Date.now() })
  })().finally(() => { inflight = null })
  return inflight
}

export function setDailyGoal(mins) {
  const goal = Math.max(15, Math.min(720, Math.round(mins / 15) * 15))
  try { localStorage.setItem(LS_GOAL, JSON.stringify(goal)) } catch {}
  set({ goal })
}

// ── Berekeningen ─────────────────────────────────────────────────────────────
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d) }

export function computeProgress(days, goal, now = new Date()) {
  const today = toISO(now)
  const todayMins = days[today] || 0

  // Streak: aaneengesloten dagen met focus, eindigend vandaag (of gisteren als vandaag nog leeg is)
  let streak = 0
  let cur = todayMins > 0 ? today : addDays(today, -1)
  while ((days[cur] || 0) > 0) { streak++; cur = addDays(cur, -1) }
  const atRisk = todayMins === 0 && streak > 0

  let longest = 0, run = 0, prev = null
  for (const d of Object.keys(days).filter(k => days[k] > 0).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = d
  }

  // Deze week (ma t/m vandaag) tegenover dezelfde dagen vorige week
  const dow = (now.getDay() + 6) % 7
  let week = 0, prevWeek = 0
  for (let i = 0; i <= dow; i++) {
    week += days[addDays(today, -dow + i)] || 0
    prevWeek += days[addDays(today, -dow + i - 7)] || 0
  }
  const weekDelta = prevWeek > 0 ? Math.round(((week - prevWeek) / prevWeek) * 100) : null

  let bestBefore = 0, bestBeforeDate = null, total = 0
  for (const [d, m] of Object.entries(days)) {
    total += m
    if (d !== today && m > bestBefore) { bestBefore = m; bestBeforeDate = d }
  }

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { date: d, mins: days[d] || 0 } })

  return { today, todayMins, goal, goalPct: Math.min(1, todayMins / goal), streak, longest, atRisk,
    week, prevWeek, weekDelta, bestBefore, bestBeforeDate, totalMins: total, last7 }
}

// Wat er "gebeurd" is door deze sessie: alleen echte doorbraken
export function sessionHighlights(before, after) {
  const h = []
  if (before.todayMins < before.goal && after.todayMins >= after.goal) h.push({ kind: 'goal' })
  if (after.streak > before.streak && after.streak > 1) {
    const m = STREAK_MILESTONES.find(x => before.streak < x && after.streak >= x)
    if (m) h.push({ kind: 'streakMilestone', value: m })
  }
  if (before.bestBefore > 0 && before.todayMins <= before.bestBefore && after.todayMins > after.bestBefore) {
    h.push({ kind: 'record', value: after.todayMins, prev: before.bestBefore })
  }
  const hb = before.totalMins / 60, ha = after.totalMins / 60
  const tm = TOTAL_MILESTONES.find(x => hb < x && ha >= x)
  if (tm) h.push({ kind: 'totalMilestone', value: tm })
  return h
}

// Aanroepen op het moment dat een focussessie klaar is, vóór `pomodoro_stats` wordt bijgewerkt.
// Geeft { before, after, highlights } terug en telt de sessie meteen optimistisch mee.
export function recordFocusSession(mins, now = new Date()) {
  const days = mergedDays()
  const before = computeProgress(days, store.goal, now)
  const d = toISO(now)
  const after = computeProgress({ ...days, [d]: (days[d] || 0) + mins }, store.goal, now)
  set({ extra: { ...store.extra, [d]: (store.extra[d] || 0) + mins } })
  return { before, after, highlights: sessionHighlights(before, after), mins }
}

export function useFocusProgress(userId) {
  const [tick, bump] = useReducer(x => x + 1, 0)
  useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump) } }, [])
  useEffect(() => { if (userId) loadFocusDays(userId) }, [userId])
  // Ander apparaat of tabblad werkte `pomodoro_stats` bij → opnieuw berekenen
  useEffect(() => {
    const onStorage = (e) => { if (e.key === LS_STATS || e.key === LS_GOAL) bump() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('pomodoroLocalChange', bump)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('pomodoroLocalChange', bump) }
  }, [])
  const day = toISO(new Date())
  return useMemo(() => computeProgress(mergedDays(), store.goal), [store.version, tick, day]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function fmtFocus(mins) {
  mins = Math.round(mins || 0)
  const h = Math.floor(mins / 60), m = mins % 60
  if (!h) return `${m}m`
  return m ? `${h}u ${m}m` : `${h}u`
}
