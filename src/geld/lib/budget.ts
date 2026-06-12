import type { BudgetConfig, CategoryConfig, Expense, VacationEntry } from '../types'
import { FIXED_CAT } from './categories'
import { monthStartOf, monthEndOf } from './format'

// Valt de uitgave binnen een eerdere (gearchiveerde) vakantie?
export function isHistVacationExpense(e: Expense, vacHistory: VacationEntry[]): boolean {
  return vacHistory.some(v => e.date >= v.start && e.date <= (v.end || v.start))
}

// Reguliere uitgaven: geen inkomsten, opnames, spaarstortingen of aflossingen
export function filterRegular(expenses: Expense[]): Expense[] {
  return expenses.filter(e =>
    !e.is_savings_withdrawal && !e.is_income && !e.is_savings_contribution && !e.is_loan_repayment
  )
}

export interface BudgetFilterCtx {
  vacationMode: boolean
  vacationStart: string | null
  vacHistory: VacationEntry[]
}

// Uitgaven die tegen het budget tellen: niet van spaargeld betaald, vaste lasten
// buiten beschouwing (behalve in vakantiemodus), geplande items zonder bedrag
// niet meegeteld, en vakantie-uitgaven uit eerdere vakanties uitgesloten
export function filterBudgetExpenses(regular: Expense[], ctx: BudgetFilterCtx): Expense[] {
  return regular.filter(e =>
    !e.paid_from_savings &&
    (ctx.vacationMode || e.category !== FIXED_CAT) &&
    (!e.is_planned || e.amount > 0) &&
    (!ctx.vacationMode || !ctx.vacationStart || e.date >= ctx.vacationStart) &&
    (ctx.vacationMode || !isHistVacationExpense(e, ctx.vacHistory))
  )
}

export function sumAmounts(expenses: Pick<Expense, 'amount'>[]): number {
  return expenses.reduce((s, e) => s + Number(e.amount), 0)
}

export interface CarryoverArgs {
  selYear: number
  selMonth: number
  recoveryMonths: number
  vacationMode: boolean
  prevSpent: number // budget-uitgaven van de vorige maand (aparte query)
  yearExpenses: Expense[]
  variableBase: number
  vacHistory: VacationEntry[]
}

// Overschrijding van vorige maanden gespreid terugbetalen via een rollend
// venster van `recoveryMonths` maanden
export function calcCarryover(args: CarryoverArgs): number {
  const { selYear, selMonth, recoveryMonths, vacationMode, prevSpent, yearExpenses, variableBase, vacHistory } = args
  if (vacationMode) return 0
  let carryover = 0
  for (let i = 1; i <= recoveryMonths; i++) {
    const pY = (selMonth - i) < 0 ? selYear - 1 : selYear
    const pM = ((selMonth - i) % 12 + 12) % 12
    if (pY === 2026 && pM <= 2) continue // Jan/feb/mrt 2026 buiten beschouwing
    let pSpent = 0
    if (i === 1) {
      pSpent = prevSpent
    } else if (pY === selYear) {
      const pStart = monthStartOf(pY, pM), pEnd = monthEndOf(pY, pM)
      const pExps = yearExpenses.filter(e =>
        e.date >= pStart && e.date <= pEnd &&
        !e.is_savings_withdrawal && !e.is_income && !e.paid_from_savings &&
        !e.is_savings_contribution && !e.is_loan_repayment &&
        e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0) &&
        !isHistVacationExpense(e, vacHistory)
      )
      pSpent = sumAmounts(pExps)
    }
    carryover += Math.max(0, pSpent - variableBase) / recoveryMonths
  }
  return carryover
}

// Tekort door carryover proportioneel verdelen over de variabele enveloppen
export function calcEnvelopeScale(carryover: number, adjustedBase: number, variableEnvelopeTotal: number): number {
  return carryover > 0 && variableEnvelopeTotal > 0
    ? Math.max(0, adjustedBase / variableEnvelopeTotal)
    : 1
}

export function effectiveBudget(catId: string, catBudgets: Record<string, number>, envelopeScale: number): number {
  if (catId === FIXED_CAT) return catBudgets[catId] || 0
  return Math.round((catBudgets[catId] || 0) * envelopeScale)
}

export function sumByCategory(expenses: Expense[], categories: CategoryConfig[], paidFromSavings: boolean): Record<string, number> {
  const result: Record<string, number> = {}
  for (const cat of categories) {
    result[cat.id] = sumAmounts(expenses.filter(e => e.category === cat.id && !!e.paid_from_savings === paidFromSavings))
  }
  return result
}

// Actief maandbudget: vakantiebudget in vakantiemodus, anders maandbudget
export function activeMonthlyBudget(config: BudgetConfig | null): number {
  const vacationMode = config?.vacation_mode || false
  return vacationMode && (config?.vacation_budget || 0) > 0
    ? config!.vacation_budget!
    : (config?.monthly_budget || 400)
}
