// Pure berekeningen voor de Focus-tab (geen React, geen Supabase).
import type { Course, Session, SessionKind } from '../types'
import { addDays, dayOf, isoDate, parseDay, MONTHS_SHORT, DAYS_SHORT, todayISO } from './format'
import { NO_COURSE } from './meta'

export type Range = '7d' | '30d' | '90d' | '1y' | 'all'
export const RANGE_LABELS: Record<Range, string> = { '7d': '7 dagen', '30d': '30 dagen', '90d': '90 dagen', '1y': '1 jaar', all: 'Altijd' }

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mins = (ss: Session[]) => sum(ss.map(s => s.duration_minutes || 0))
const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
const mondayOf = (iso: string) => addDays(iso, -((parseDay(iso).getDay() + 6) % 7))

export function minutesByDay(sessions: Session[]) {
  const out: Record<string, number> = {}
  for (const s of sessions) { const d = dayOf(s.completed_at); out[d] = (out[d] || 0) + (s.duration_minutes || 0) }
  return out
}

export function avgRating(sessions: Session[]) {
  const r = sessions.filter(s => s.rating)
  return r.length ? sum(r.map(s => s.rating!)) / r.length : null
}

export function inRange(sessions: Session[], range: Range, now = new Date()) {
  if (range === 'all') return sessions
  const n = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[range]
  const from = addDays(isoDate(now), -(n - 1))
  return sessions.filter(s => dayOf(s.completed_at) >= from)
}

// ── Home ────────────────────────────────────────────────────────────────────
export function overview(sessions: Session[], courses: Course[], now = new Date()) {
  const today = isoDate(now)
  const monday = mondayOf(today)
  const todays = sessions.filter(s => dayOf(s.completed_at) === today)
  const week = sessions.filter(s => dayOf(s.completed_at) >= monday)
  return {
    totalMins: mins(sessions),
    count: sessions.length,
    avgRating: avgRating(sessions),
    activeCourses: courses.filter(c => c.status === 'active').length,
    todayMins: mins(todays),
    weekMins: mins(week),
  }
}

export interface VolumePoint { key: string; label: string; mins: number }

/** Studievolume voor de grafiek op Home + totaal en verandering t.o.v. de periode ervoor */
export function volume(sessions: Session[], range: Exclude<Range, 'all'>, now = new Date()) {
  const byDay = minutesByDay(sessions)
  const today = isoDate(now)
  const total = (from: string, to: string) => sum(Object.entries(byDay).filter(([d]) => d >= from && d <= to).map(([, m]) => m))
  let points: VolumePoint[] = []
  let span = 0
  if (range === '7d' || range === '30d') {
    span = range === '7d' ? 7 : 30
    points = Array.from({ length: span }, (_, i) => {
      const d = addDays(today, i - span + 1)
      const day = parseDay(d)
      return { key: d, label: span === 7 ? DAYS_SHORT[day.getDay()] : `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`, mins: byDay[d] || 0 }
    })
  } else if (range === '90d') {
    span = 91
    const start = mondayOf(addDays(today, -90))
    for (let w = start; w <= today; w = addDays(w, 7)) {
      const d = parseDay(w)
      points.push({ key: w, label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, mins: total(w, addDays(w, 6)) })
    }
  } else {
    span = 365
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const from = isoDate(d), to = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      points.push({ key: from, label: MONTHS_SHORT[d.getMonth()], mins: total(from, to) })
    }
  }
  const cur = total(addDays(today, -(span - 1)), today)
  const prev = total(addDays(today, -(2 * span - 1)), addDays(today, -span))
  return { points, total: cur, prevTotal: prev, delta: delta(cur, prev) }
}

// ── Vakken ──────────────────────────────────────────────────────────────────
export function courseTotals(sessions: Session[]) {
  const out: Record<string, number> = {}
  for (const s of sessions) { const k = s.course_id || NO_COURSE.id; out[k] = (out[k] || 0) + (s.duration_minutes || 0) }
  return out
}

export function courseStats(sessions: Session[]) {
  let record: { mins: number; date: string } | null = null
  for (const s of sessions) if (!record || s.duration_minutes > record.mins) record = { mins: s.duration_minutes, date: dayOf(s.completed_at) }
  const total = mins(sessions)
  return { total, count: sessions.length, avgSession: sessions.length ? total / sessions.length : 0, avgRating: avgRating(sessions), record }
}

export function kindBreakdown(sessions: Session[]) {
  const out: Partial<Record<SessionKind | 'other', number>> = {}
  for (const s of sessions) { const k = s.kind || 'other'; out[k] = (out[k] || 0) + (s.duration_minutes || 0) }
  return (Object.entries(out) as [SessionKind | 'other', number][]).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).map(([kind, m]) => ({ kind, mins: m }))
}

export function topicMinutes(sessions: Session[]) {
  const out: Record<string, number> = {}
  for (const s of sessions) if (s.topic_id) out[s.topic_id] = (out[s.topic_id] || 0) + (s.duration_minutes || 0)
  return out
}

// ── Kalender ────────────────────────────────────────────────────────────────
function monthTotals(sessions: Session[], y: number, m: number, now: Date, uptoDay?: number) {
  const lastDay = new Date(y, m + 1, 0).getDate()
  const from = isoDate(new Date(y, m, 1)), to = isoDate(new Date(y, m, uptoDay ? Math.min(uptoDay, lastDay) : lastDay))
  const inMonth = sessions.filter(s => { const d = dayOf(s.completed_at); return d >= from && d <= to })
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const isCurrent = y === now.getFullYear() && m === now.getMonth()
  const elapsed = isCurrent ? now.getDate() : uptoDay ? Math.min(uptoDay, daysInMonth) : daysInMonth
  const total = mins(inMonth)
  return { sessions: inMonth, mins: total, count: inMonth.length, dailyAvg: total / elapsed }
}

export function monthStats(sessions: Session[], y: number, m: number, now = new Date()) {
  const cur = monthTotals(sessions, y, m, now)
  const prevDate = new Date(y, m - 1, 1)
  // Lopende maand: vergelijken met dezelfde dagen van de vorige maand (1 t/m vandaag)
  const isCurrent = y === now.getFullYear() && m === now.getMonth()
  const prev = monthTotals(sessions, prevDate.getFullYear(), prevDate.getMonth(), now, isCurrent ? now.getDate() : undefined)
  const days: Record<string, { mins: number; count: number }> = {}
  for (const s of cur.sessions) {
    const d = dayOf(s.completed_at)
    days[d] = days[d] || { mins: 0, count: 0 }
    days[d].mins += s.duration_minutes || 0
    days[d].count++
  }
  return {
    days, mins: cur.mins, count: cur.count, dailyAvg: cur.dailyAvg,
    deltaMins: delta(cur.mins, prev.mins), deltaCount: delta(cur.count, prev.count), deltaAvg: delta(cur.dailyAvg, prev.dailyAvg),
  }
}

/** Week (ma–zo) rond `anchor`: minuten per dag, totaal en daggemiddelde over de verstreken dagen */
export function weekSummary(sessions: Session[], anchor: string, now = new Date()) {
  const byDay = minutesByDay(sessions)
  const monday = mondayOf(anchor)
  const today = isoDate(now)
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(monday, i); return { date: d, label: DAYS_SHORT[parseDay(d).getDay()], mins: byDay[d] || 0, future: d > today } })
  const total = sum(days.map(d => d.mins))
  const elapsed = Math.max(1, days.filter(d => !d.future).length)
  return { days, total, dailyAvg: total / elapsed }
}

// ── Inzichten ───────────────────────────────────────────────────────────────
export interface StreamSeries { id: string; name: string; color: string; mins: number; share: number }

/** Tijd per vak over de tijd (voor de gestapelde stroomgrafiek) */
export function streamByCourse(sessions: Session[], courses: Course[], range: Range, now = new Date()) {
  const ss = inRange(sessions, range, now)
  const totals = courseTotals(ss)
  const total = sum(Object.values(totals))
  const meta = (id: string) => courses.find(c => c.id === id) || NO_COURSE
  const series: StreamSeries[] = Object.entries(totals).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])
    .map(([id, m]) => ({ id, name: meta(id).name, color: meta(id).color, mins: m, share: total ? m / total : 0 }))

  const today = isoDate(now)
  const first = ss.length ? ss.map(s => dayOf(s.completed_at)).sort()[0] : today
  const start = range === 'all' ? first : addDays(today, -({ '7d': 6, '30d': 29, '90d': 89, '1y': 364 }[range]))
  const spanDays = Math.max(1, Math.round((parseDay(today).getTime() - parseDay(start).getTime()) / 86400000) + 1)
  const step = spanDays <= 14 ? 1 : spanDays <= 120 ? 7 : 30
  const buckets: Record<string, number | string>[] = []
  for (let b = step === 1 ? start : mondayOf(start); b <= today; b = addDays(b, step)) {
    const end = addDays(b, step - 1)
    const d = parseDay(b)
    const row: Record<string, number | string> = { key: b, label: step === 30 ? MONTHS_SHORT[d.getMonth()] : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }
    for (const sr of series) row[sr.id] = 0
    for (const s of ss) {
      const day = dayOf(s.completed_at)
      if (day >= b && day <= end) { const k = s.course_id || NO_COURSE.id; row[k] = (row[k] as number) + s.duration_minutes / 60 }
    }
    buckets.push(row)
  }
  return { series, buckets, total }
}

/** Minuten per uur van de dag; een sessie wordt over de uren verdeeld waarin hij liep */
export function hourDistribution(sessions: Session[]) {
  const hist = new Array(24).fill(0)
  for (const s of sessions) {
    const end = new Date(s.completed_at).getTime()
    const start = s.started_at ? new Date(s.started_at).getTime() : end - s.duration_minutes * 60000
    const total = Math.max(1, (end - start) / 60000)
    const scale = s.duration_minutes / total
    let t = start
    while (t < end) {
      const d = new Date(t)
      const next = Math.min(end, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime())
      hist[d.getHours()] += ((next - t) / 60000) * scale
      t = next
    }
  }
  return hist as number[]
}

export function peakWindow(hist: number[], width = 2) {
  const total = sum(hist)
  let best = 0, start = 0
  for (let h = 0; h < 24; h++) {
    let w = 0
    for (let i = 0; i < width; i++) w += hist[(h + i) % 24]
    if (w > best) { best = w; start = h }
  }
  return { start, end: (start + width) % 24, share: total ? best / total : 0, total }
}

export function dayPart(hist: number[]) {
  const parts = [
    { label: 'Nachten', from: 0, to: 5 }, { label: 'Ochtenden', from: 5, to: 12 },
    { label: 'Middagen', from: 12, to: 17 }, { label: 'Avonden', from: 17, to: 24 },
  ].map(p => ({ ...p, mins: sum(hist.slice(p.from, p.to)) }))
  return parts.sort((a, b) => b.mins - a.mins)[0].label
}

/** Piekdagen/-uren op basis van je eigen ★-beoordelingen (minstens 2 beoordeelde sessies) */
export function ratingInsights(sessions: Session[]) {
  const rated = sessions.filter(s => s.rating)
  const group = (keyOf: (s: Session) => number) => {
    const g: Record<number, { sum: number; n: number; mins: number }> = {}
    for (const s of rated) { const k = keyOf(s); g[k] = g[k] || { sum: 0, n: 0, mins: 0 }; g[k].sum += s.rating!; g[k].n++; g[k].mins += s.duration_minutes }
    return Object.entries(g).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ key: +k, avg: v.sum / v.n, n: v.n, mins: v.mins }))
      .sort((a, b) => b.avg - a.avg || b.mins - a.mins)
  }
  const days = group(s => new Date(s.completed_at).getDay())
  const hours = group(s => { const h = new Date(s.started_at || s.completed_at).getHours(); return h - (h % 2) })
  return { bestDay: days[0] || null, bestHours: hours[0] || null, days, rated: rated.length }
}

export { todayISO }
