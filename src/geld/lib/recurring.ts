import type { BudgetConfig, RecurringSource } from '../types'
import { todayStr, monthStart, monthEnd } from './format'

const DAY_MS = 86400000

// Volgende betaaldatum als korte NL-label ("12 jun"), of null
export function getNextPayDate(src: RecurringSource): string | null {
  const todayISO = todayStr()
  if (src.type === 'monthly') {
    const now = new Date()
    let d = new Date(now.getFullYear(), now.getMonth(), src.day || 1)
    if (d.toISOString().slice(0, 10) <= todayISO) d = new Date(now.getFullYear(), now.getMonth() + 1, src.day || 1)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  if (src.type === 'interval' && src.ref_date) {
    const ms = (src.interval_days || 28) * DAY_MS
    let d = new Date(src.ref_date + 'T12:00:00')
    while (d.toISOString().slice(0, 10) <= todayISO) d = new Date(d.getTime() + ms)
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
    while (d.toISOString().slice(0, 10) < todayISO) d = new Date(d.getTime() + ms)
    return d.toISOString().slice(0, 10) === todayISO
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
