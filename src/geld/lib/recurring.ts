import type { BudgetConfig, Expense, FillMark, RecurringSource } from '../types'
import { todayStr, monthStart, monthEnd } from './format'
import { toISODate } from './format'

const DAY_MS = 86400000

// Volgende betaaldatum als korte NL-label ("12 jun"), of null
export function getNextPayDate(src: RecurringSource): string | null {
  const todayISO = todayStr()
  if (src.type === 'monthly') {
    const now = new Date()
    let d = new Date(now.getFullYear(), now.getMonth(), src.day || 1)
    if (toISODate(d) <= todayISO) d = new Date(now.getFullYear(), now.getMonth() + 1, src.day || 1)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  if (src.type === 'interval' && src.ref_date) {
    const ms = (src.interval_days || 28) * DAY_MS
    let d = new Date(src.ref_date + 'T12:00:00')
    while (toISODate(d) <= todayISO) d = new Date(d.getTime() + ms)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  return null
}

// Verwacht inkomen in de huidige (echte) kalendermaand
export function calcRecurringThisMonth(recurringIncome: RecurringSource[] | undefined): number {
  if (!recurringIncome?.length) return 0
  const mStart = new Date(monthStart() + 'T00:00:00')
  const mEnd   = new Date(monthEnd()   + 'T23:59:59')
  return recurringIncome.reduce((sum, src) => {
    if (src.type === 'monthly') return sum + src.amount
    if (src.type === 'interval' && src.ref_date) {
      const ms = (src.interval_days || 28) * DAY_MS
      let d = new Date(src.ref_date + 'T12:00:00')
      while (d < mStart) d = new Date(d.getTime() + ms)
      let count = 0
      while (d <= mEnd) { count++; d = new Date(d.getTime() + ms) }
      return sum + src.amount * count
    }
    return sum
  }, 0)
}

export function isPayDayToday(src: RecurringSource): boolean {
  const today = new Date()
  if (src.type === 'monthly') return today.getDate() === src.day
  if (src.type === 'interval' && src.ref_date) {
    const todayISO = todayStr()
    const ms = (src.interval_days || 28) * DAY_MS
    let d = new Date(src.ref_date + 'T12:00:00')
    while (toISODate(d) < todayISO) d = new Date(d.getTime() + ms)
    return toISODate(d) === todayISO
  }
  return false
}

// Welke bronnen zijn vandaag al bevestigd (Supabase + localStorage fallback)
export function getFilledInToday(config: BudgetConfig | null): string[] {
  const fromSupabase = (config?.income_confirmed_dates || {})[todayStr()] || []
  try {
    const local: string[] = JSON.parse(localStorage.getItem('income_filled_in') || '{}')[todayStr()] || []
    return [...new Set([...fromSupabase, ...local])]
  } catch {
    return fromSupabase
  }
}

export function markFilledInToday(id: string): void {
  try {
    const data: Record<string, string[]> = JSON.parse(localStorage.getItem('income_filled_in') || '{}')
    const today = todayStr()
    data[today] = [...new Set([...(data[today] || []), id])]
    Object.keys(data).forEach(d => { if (d < today) delete data[d] })
    localStorage.setItem('income_filled_in', JSON.stringify(data))
  } catch {}
}

// ── Ingevuld per periode ────────────────────────────────────────────────────
// Zelfde regels als de Claude-connector (netlify/functions/geld-mcp/recurring.js): maandelijks = kalendermaand,
// interval = rond de dichtstbijzijnde betaaldag. "Ingevuld" = markering op de bron (recurring_income[].filled[periode])
// of een inkomensregel met de naam van de bron in die periode (zo werd het altijd al herkend).

export interface IncomePeriod { key: string; from: string; to: string; expected: string }

const isoAdd = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const pad2 = (n: number) => String(n).padStart(2, '0')

export function periodOf(src: RecurringSource, ref: string): IncomePeriod {
  if (src.type === 'interval' && src.ref_date) {
    const n = src.interval_days || 28
    const k = Math.round((Date.parse(`${ref}T00:00:00Z`) - Date.parse(`${src.ref_date}T00:00:00Z`)) / DAY_MS / n)
    const expected = isoAdd(src.ref_date, k * n)
    return { key: expected, from: isoAdd(expected, -Math.floor(n / 2)), to: isoAdd(expected, Math.ceil(n / 2) - 1), expected }
  }
  const [y, m] = ref.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ym = `${y}-${pad2(m)}`
  return { key: ym, from: `${ym}-01`, to: `${ym}-${pad2(last)}`, expected: `${ym}-${pad2(Math.min(src.day || 1, last))}` }
}

export function fillMark(src: RecurringSource, key: string): FillMark | null {
  const v = src.filled?.[key]
  return typeof v === 'string' ? { expense_id: v } : v || null
}

/** Inkomensregel waarmee de bron deze periode is ingevuld. `incomes` = inkomsten van de geladen maand. */
export function fillFor(src: RecurringSource, period: IncomePeriod, incomes: Expense[]): Expense | FillMark | null {
  const mark = fillMark(src, period.key)
  if (mark?.expense_id) {
    const hit = incomes.find(e => e.id === mark.expense_id)
    if (hit) return hit
    // Interval-periode over de maandgrens: de boeking staat dan in een maand die niet geladen is
    if (mark.date && mark.date.slice(0, 7) !== todayStr().slice(0, 7)) return mark
  }
  return incomes.find(e => e.is_income && e.description === src.name && e.date >= period.from && e.date <= period.to) || null
}

/** Is de bron voor de lopende periode al ingevuld? */
export function filledThisPeriod(src: RecurringSource, incomes: Expense[]): boolean {
  return !!fillFor(src, periodOf(src, todayStr()), incomes)
}

/** Volgende betaaldag: deze periode als die nog moet komen en niet is ingevuld, anders de volgende. Kort NL-label. */
export function nextPayLabel(src: RecurringSource, filled: boolean): string | null {
  if (src.type !== 'monthly' && !(src.type === 'interval' && src.ref_date)) return null
  const today = todayStr()
  let p = periodOf(src, today)
  if (p.expected <= today || filled) p = periodOf(src, isoAdd(p.to, 1))
  return new Date(`${p.expected}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
