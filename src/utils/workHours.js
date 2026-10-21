// Werkuren per week en per looncyclus (de 25e t/m de 24e van de volgende maand).
// Uren = begin- tot eindtijd van de dienst, zonder pauze-aftrek (pauze is doorbetaald).
import { eventCategory } from './category'

/** Eerste dag van een periode. Loopt de periode anders, dan alleen dit getal aanpassen. */
export const PERIOD_START_DAY = 25
/** Eerste werkdag bij WDK: eerdere diensten (bv. oude Jumbo/PMT-diensten) tellen niet mee. */
export const WORK_SINCE = new Date(2026, 9, 12)

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const DAY = 86400000
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const fmtDay = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`

/** Periode waar `date` in valt: { from, to (laatste dag), label }. */
export function periodOf(date) {
  const d = startOfDay(date)
  const from = d.getDate() >= PERIOD_START_DAY
    ? new Date(d.getFullYear(), d.getMonth(), PERIOD_START_DAY)
    : new Date(d.getFullYear(), d.getMonth() - 1, PERIOD_START_DAY)
  const to = new Date(from.getFullYear(), from.getMonth() + 1, PERIOD_START_DAY - 1)
  return { kind: 'period', from, to, label: `${fmtDay(from)} – ${fmtDay(to)}` }
}
export const shiftPeriod = (p, n) => periodOf(new Date(p.from.getFullYear(), p.from.getMonth() + n, PERIOD_START_DAY))

/** ISO-weeknummer. */
export function isoWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

/** Week (ma t/m zo) waar `date` in valt. */
export function weekOf(date) {
  const d = startOfDay(date)
  const from = addDays(d, -((d.getDay() + 6) % 7))
  const to = addDays(from, 6)
  const range = from.getMonth() === to.getMonth() ? `${from.getDate()}–${fmtDay(to)}` : `${fmtDay(from)} – ${fmtDay(to)}`
  return { kind: 'week', from, to, week: isoWeek(from), label: `Week ${isoWeek(from)} · ${range}` }
}
export const shiftWeek = (w, n) => weekOf(addDays(w.from, 7 * n))

const isAllDay = (ev, s, e) => !!ev.all_day || (s.getHours() === 0 && s.getMinutes() === 0 && ((e.getHours() === 23 && e.getMinutes() === 59) || e - s >= DAY))

/**
 * Diensten uit agenda-items: { start, end, title }.
 * source 'type' = alles van het type Werk; anders een connection_id (alleen die feed).
 */
export function workShifts(events, source = 'type') {
  const out = []
  for (const ev of events || []) {
    if (ev.hidden || !ev.start_time || !ev.end_time) continue
    if (source === 'type' ? eventCategory(ev) !== 'werk' : ev.connection_id !== source) continue
    const start = new Date(ev.start_time), end = new Date(ev.end_time)
    if (Number.isNaN(+start) || end <= start || start < WORK_SINCE || isAllDay(ev, start, end)) continue
    const from = ev.connection?.name || (ev.description?.startsWith('pmt:') ? 'PMT (Jumbo)' : 'Eigen agenda')
    out.push({ start, end, title: ev.title || 'Werk', from })
  }
  return out
}

/**
 * Uren tussen `from` en `to` (dagen, t/m). Een dienst telt mee op zijn begindag, ook als hij na
 * middernacht doorloopt. Dubbele/overlappende diensten (bv. zelfde dienst uit twee bronnen) tellen één keer.
 * → { totalMin, workedMin, plannedMin, count, days: [{ date, min, workedMin, shifts }] }
 */
export function sumHours(shifts, from, to, now = new Date()) {
  const first = startOfDay(from), last = startOfDay(to)
  const days = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push({ date: d, min: 0, workedMin: 0, list: [] })
  const idx = (d) => Math.round((startOfDay(d) - first) / DAY)
  for (const s of shifts) {
    const i = idx(s.start)
    if (i >= 0 && i < days.length && startOfDay(s.start) <= last) days[i].list.push(s)
  }
  let count = 0
  for (const day of days) {
    // Samenvoegen: overlappende diensten op dezelfde dag als één blok
    const merged = []
    for (const s of day.list.sort((a, b) => a.start - b.start)) {
      const top = merged[merged.length - 1]
      if (top && s.start <= top.end) { if (s.end > top.end) top.end = s.end; top.dup = true }
      else merged.push({ start: s.start, end: s.end, title: s.title, from: s.from })
    }
    day.shifts = merged
    count += merged.length
    for (const m of merged) {
      const min = Math.round((m.end - m.start) / 60000)
      day.min += min
      day.workedMin += m.end <= now ? min : m.start >= now ? 0 : Math.round((now - m.start) / 60000)
    }
    delete day.list
  }
  const totalMin = days.reduce((n, d) => n + d.min, 0)
  const workedMin = days.reduce((n, d) => n + d.workedMin, 0)
  return { totalMin, workedMin, plannedMin: totalMin - workedMin, count, days }
}

/** "18u 30m", "8u", "45m". */
export function fmtHours(min) {
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60), r = m % 60
  return h ? (r ? `${h}u ${String(r).padStart(2, '0')}m` : `${h}u`) : `${r}m`
}
