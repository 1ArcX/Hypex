// Pure berekeningen voor de Recap-tab (geen React, geen Supabase).
import { addDays, parseDay } from '../../focus/lib/format'
import { recapKey } from '../store/recapStore'
import type { Goal, Recap } from '../types'

export const SCORES = [
  { key: 'energy', label: 'Energie', color: 'var(--c-warning)' },
  { key: 'focus', label: 'Focus', color: 'var(--accent)' },
  { key: 'mood', label: 'Stemming', color: 'var(--cat-persoonlijk)' },
] as const
export type ScoreKey = typeof SCORES[number]['key']

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export const mondayOf = (iso: string) => addDays(iso, -((parseDay(iso).getDay() + 6) % 7))
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))
export const isSunday = (iso: string) => parseDay(iso).getDay() === 0

/** ISO-weeknummer */
export function weekNumber(iso: string) {
  const d = parseDay(iso)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

/** Gemiddelde van de ingevulde scores (1–5) van een dag */
export function dayScore(r: Pick<Recap, ScoreKey> | null | undefined) {
  if (!r) return null
  return avg([r.energy, r.focus, r.mood].filter((x): x is number => x != null))
}

export function goalProgress(goals: Goal[] | undefined) {
  const list = (goals || []).filter(g => g.text.trim())
  return { done: list.filter(g => g.done).length, total: list.length }
}

/** Dagen op rij een dagrecap. Vandaag nog niet ingevuld breekt de reeks niet. */
export function recapStreak(byKey: Record<string, Recap>, today: string) {
  let d = byKey[recapKey('day', today)] ? today : addDays(today, -1)
  let n = 0
  while (byKey[recapKey('day', d)]) { n++; d = addDays(d, -1) }
  return n
}

export function bestStreak(recaps: Recap[]) {
  const days = recaps.filter(r => r.kind === 'day').map(r => r.day).sort()
  let best = 0, run = 0, prev = ''
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export interface WeekStats {
  filled: number
  energy: number | null
  focus: number | null
  mood: number | null
  goalsDone: number
  goalsTotal: number
  focusMins: number
  tasksDone: number
  bestDay: string | null
}

/**
 * Weekoverzicht. Doelen van een dag staan op de recap van de dag ervoor,
 * dus voor maandag t/m zondag tellen de recaps van zondag ervoor t/m zaterdag.
 */
export function weekStats(byKey: Record<string, Recap>, monday: string, focusByDay: Record<string, number>, tasksByDay: Record<string, number>): WeekStats {
  const days = weekDays(monday)
  const recs = days.map(d => byKey[recapKey('day', d)]).filter(Boolean)
  const pick = (k: ScoreKey) => avg(recs.map(r => r[k]).filter((x): x is number => x != null))
  let goalsDone = 0, goalsTotal = 0
  for (const d of days) {
    const g = goalProgress(byKey[recapKey('day', addDays(d, -1))]?.goals)
    goalsDone += g.done; goalsTotal += g.total
  }
  let bestDay: string | null = null, bestScore = -1
  for (const r of recs) { const s = dayScore(r); if (s != null && s > bestScore) { bestScore = s; bestDay = r.day } }
  return {
    filled: recs.length,
    energy: pick('energy'), focus: pick('focus'), mood: pick('mood'),
    goalsDone, goalsTotal,
    focusMins: days.reduce((a, d) => a + (focusByDay[d] || 0), 0),
    tasksDone: days.reduce((a, d) => a + (tasksByDay[d] || 0), 0),
    bestDay,
  }
}

export const pctDelta = (cur: number | null, prev: number | null) =>
  cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null

export const fmtScore = (x: number | null) => (x == null ? '–' : x.toFixed(1).replace('.', ','))
