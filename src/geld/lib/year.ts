import type { BudgetConfig, Expense, VacationEntry } from '../types'
import { monthStartOf, monthEndOf } from './format'
import { sumAmounts } from './budget'

export interface YearMonth {
  m: number // 0-based maand
  spent: number
  income: number
  hasDat: boolean
  vacSpent: number
  vacOvY: VacationEntry | undefined // vakantie die deze maand overlapt
}

// Jaaroverzicht per maand, met vakantie-uitgaven apart van het normale budget
export function buildYearMonthly(yearExpenses: Expense[], config: BudgetConfig | null, selYear: number): YearMonth[] {
  const vacationMode = config?.vacation_mode || false
  const allVacs: VacationEntry[] = [
    ...(config?.vacation_history || []),
    ...(vacationMode && config?.vacation_start
      ? [{ start: config.vacation_start, end: config.vacation_end || config.vacation_start }]
      : []),
  ]
  return Array.from({ length: 12 }, (_, m) => {
    const mStart = monthStartOf(selYear, m), mEnd = monthEndOf(selYear, m)
    const mExps = yearExpenses.filter(e => e.date >= mStart && e.date <= mEnd)
    const vacOvY = allVacs.find(v => v.start <= mEnd && (v.end || v.start) >= mStart)
    const isVacExp = (e: Expense) => !!vacOvY && e.date >= vacOvY.start && e.date <= (vacOvY.end || vacOvY.start)
    const baseExp = (e: Expense) => !e.is_income && !e.is_savings_withdrawal && !e.is_savings_contribution && !e.is_loan_repayment
    const spent = sumAmounts(mExps.filter(e => baseExp(e) && !isVacExp(e)))
    const vacSpent = vacOvY ? sumAmounts(mExps.filter(e => baseExp(e) && isVacExp(e))) : 0
    const income = sumAmounts(mExps.filter(e => e.is_income))
    return { m, spent, income, hasDat: mExps.length > 0, vacSpent, vacOvY }
  })
}
