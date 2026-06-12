import type { Expense } from '../types'
import { toISODate, todayStr } from './format'
import { sumAmounts } from './budget'

// Begin van de huidige week (vr→do-cyclus), zoals op de geld-pagina
export function getWeekStartDate(today: Date = new Date()): Date {
  const d = new Date(today)
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 5 ? 0 : dow === 6 ? 1 : dow + 2))
  d.setHours(0, 0, 0, 0)
  return d
}

export interface WeekBudgetStats {
  weekStartStr: string
  weekSpentSoFar: number
  remainingWeeks: number
  weekAllowance: number
  weekRemaining: number
}

// Resterend maandbudget gelijk verdelen over de resterende weken
export function calcWeekBudget(
  budgetExpenses: Expense[],
  adjustedRemaining: number,
  daysInMonth: number,
  today: Date = new Date(),
): WeekBudgetStats {
  const weekStartDate = getWeekStartDate(today)
  const weekStartStr = toISODate(weekStartDate)
  const weekSpentSoFar = sumAmounts(
    budgetExpenses.filter(e => e.date >= weekStartStr && e.date <= todayStr())
  )

  const monthEndDate = new Date(today.getFullYear(), today.getMonth(), daysInMonth)
  let weeksLeft = 0
  const ws = new Date(weekStartDate)
  while (ws <= monthEndDate) { weeksLeft++; ws.setDate(ws.getDate() + 7) }
  const remainingWeeks = Math.max(1, weeksLeft)

  const weekAllowance = Math.round((Math.max(0, adjustedRemaining) / remainingWeeks) * 100) / 100
  const weekRemaining = Math.round((weekAllowance - weekSpentSoFar) * 100) / 100

  return { weekStartStr, weekSpentSoFar, remainingWeeks, weekAllowance, weekRemaining }
}

// Weekstaafjes (1-7, 8-14, 15-21, 22-28, 29+) voor de maandgrafiek
export function calcWeekTotals(budgetExpenses: Expense[]): number[] {
  const weekTotals = [0, 0, 0, 0, 0]
  budgetExpenses.forEach(e => {
    const day = new Date(e.date).getDate()
    const wi = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weekTotals[wi] += Number(e.amount)
  })
  return weekTotals
}

export function weekIndexOfDay(dayOfMonth: number): number {
  return dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : dayOfMonth <= 28 ? 3 : 4
}
