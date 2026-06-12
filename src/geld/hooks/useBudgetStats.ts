import { useMemo } from 'react'
import type { BudgetConfig, CategoryConfig, Expense } from '../types'
import { CATEGORIES, DEFAULT_CAT_BUDGETS, FIXED_CAT } from '../lib/categories'
import { todayStr } from '../lib/format'
import {
  activeMonthlyBudget, calcCarryover, calcEnvelopeScale, effectiveBudget,
  filterBudgetExpenses, filterRegular, isHistVacationExpense, sumAmounts, sumByCategory,
} from '../lib/budget'
import { calcRecurringThisMonth } from '../lib/recurring'
import { calcWeekBudget, calcWeekTotals, weekIndexOfDay } from '../lib/weekBudget'
import { useGeldStore } from '../store/geldStore'

export interface BudgetStatsInput {
  expenses: Expense[]
  prevExpenses: Expense[]
  yearExpenses: Expense[]
  config: BudgetConfig | null
}

// Alle afgeleide maandstatistieken in één gememoiseerd object.
// Pure berekening — data komt uit de losse fetch-hooks.
export function useBudgetStats({ expenses, prevExpenses, yearExpenses, config }: BudgetStatsInput) {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)

  return useMemo(() => {
    const vacationMode = config?.vacation_mode || false
    const monthlyBudget = activeMonthlyBudget(config)
    const minBalance = config?.min_balance ?? 300
    const catBudgets = config?.category_budgets || DEFAULT_CAT_BUDGETS
    const customCategories = config?.custom_categories || []
    const allCategories: CategoryConfig[] = [...CATEGORIES, ...customCategories]
    const vacHistory = config?.vacation_history || []
    const savingsGoal = config?.savings_goal || 0
    const recoveryMonths = config?.recovery_months || 3

    const manualIncome = expenses.filter(e => e.is_income)
    const totalManualIncome = sumAmounts(manualIncome)
    const plannedExpenses = expenses.filter(e => e.is_planned)
    const regularExpenses = filterRegular(expenses)
    const filterCtx = { vacationMode, vacationStart: config?.vacation_start || null, vacHistory }
    const budgetExpenses = filterBudgetExpenses(regularExpenses, filterCtx)
    const savingsExpenses = regularExpenses.filter(e => e.paid_from_savings)
    const totalSpent = sumAmounts(budgetExpenses)
    const savingsExpTotal = sumAmounts(savingsExpenses)
    const savingsWithdrawals = expenses.filter(e => e.is_savings_withdrawal)
    const savingsTotal = sumAmounts(savingsWithdrawals)
    const savedWithdrawals = savingsWithdrawals.filter(e => e.savings_type !== 'loan')

    const recurringIncome = config?.recurring_income || []
    const recurringExpected = calcRecurringThisMonth(recurringIncome)
    const hasRecurring = recurringIncome.length > 0
    // grossIncome alleen voor weergave — base blijft altijd het ingestelde budget
    const grossIncome = hasRecurring
      ? recurringExpected + totalManualIncome
      : (totalManualIncome > 0 ? totalManualIncome : monthlyBudget)
    const base = monthlyBudget
    const remaining = base - totalSpent
    const remainPct = Math.max(0, Math.min(100, (remaining / base) * 100))

    const todayTotal = sumAmounts(budgetExpenses.filter(e => e.date === todayStr()))

    const spentByCategory = sumByCategory(regularExpenses, allCategories, false)
    const savingsByCategory = sumByCategory(regularExpenses, allCategories, true)

    // Carryover (rollend venster over recovery_months)
    const prevRegular = prevExpenses.filter(e =>
      !e.is_savings_withdrawal && !e.is_income && !e.paid_from_savings &&
      !e.is_savings_contribution && !e.is_loan_repayment &&
      e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0) &&
      !isHistVacationExpense(e, vacHistory)
    )
    const prevSpent = sumAmounts(prevRegular)
    const vasteLastenBudget = catBudgets[FIXED_CAT] || 0
    const variableBase = Math.max(0, base - vasteLastenBudget)
    const carryover = calcCarryover({
      selYear, selMonth, recoveryMonths, vacationMode,
      prevSpent, yearExpenses, variableBase, vacHistory,
    })
    const adjustedBase = vacationMode ? base : Math.max(0, variableBase - carryover)
    const adjustedRemaining = adjustedBase - totalSpent
    const adjustedRemainPct = adjustedBase > 0
      ? Math.max(0, Math.min(100, (adjustedRemaining / adjustedBase) * 100))
      : 0

    // Envelop-schaling bij carryover
    const variableCats = allCategories.filter(c => c.id !== FIXED_CAT)
    const variableEnvelopeTotal = variableCats.reduce((s, c) => s + (catBudgets[c.id] || 0), 0)
    const envelopeScale = calcEnvelopeScale(carryover, adjustedBase, variableEnvelopeTotal)
    const catBudgetOf = (catId: string) => effectiveBudget(catId, catBudgets, envelopeScale)

    const allTransactions = [...regularExpenses, ...manualIncome].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '')
    )

    // Dag- en prognosestatistieken (vakantieperiode telt als "maand" in vakantiemodus)
    const today = new Date()
    const vacStartDate = vacationMode && config?.vacation_start ? new Date(config.vacation_start + 'T00:00:00') : null
    const vacEndDate = vacationMode && config?.vacation_end ? new Date(config.vacation_end + 'T00:00:00') : null
    const daysInMonth = vacStartDate && vacEndDate
      ? Math.max(1, Math.round((vacEndDate.getTime() - vacStartDate.getTime()) / 86400000) + 1)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const dayOfMonth = vacStartDate
      ? Math.max(1, Math.min(daysInMonth, Math.round((today.getTime() - vacStartDate.getTime()) / 86400000) + 1))
      : today.getDate()
    const daysLeft = vacEndDate
      ? Math.max(1, Math.round((vacEndDate.getTime() - today.getTime()) / 86400000) + 1)
      : daysInMonth - dayOfMonth + 1
    const dagBudget = adjustedRemaining > 0 ? adjustedRemaining / daysLeft : 0
    const projectedTotal = dayOfMonth > 1 ? (totalSpent / dayOfMonth) * daysInMonth : null
    const projectedOver = projectedTotal !== null && projectedTotal > adjustedBase

    // Weekbudget (vr→do-cyclus)
    const week = calcWeekBudget(budgetExpenses, adjustedRemaining, daysInMonth, today)

    // Spaarstreak: dagen sinds laatste opname
    let spaarStreak = 0
    for (let i = 0; i < 366; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      if (savingsWithdrawals.some(e => e.date === ds)) break
      spaarStreak++
    }

    // Weekstaafjes voor de maandgrafiek
    const weekBudget = base / 4
    const weekTotals = calcWeekTotals(budgetExpenses)
    const maxWeekVal = Math.max(...weekTotals, weekBudget, 1)
    const currentWeekIdx = weekIndexOfDay(dayOfMonth)

    // Saldolijn per dag (op basis van adjustedBase)
    const balanceByDay: number[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const spent = sumAmounts(budgetExpenses.filter(e => new Date(e.date).getDate() <= d))
      balanceByDay.push(adjustedBase - spent)
    }

    const catWithSpend = allCategories
      .map(c => ({ ...c, spent: spentByCategory[c.id] || 0 }))
      .filter(c => c.spent > 0)

    return {
      vacationMode, monthlyBudget, minBalance, catBudgets, customCategories, allCategories,
      vacHistory, savingsGoal, recoveryMonths,
      manualIncome, totalManualIncome, plannedExpenses, regularExpenses, budgetExpenses,
      savingsExpenses, totalSpent, savingsExpTotal, savingsWithdrawals, savingsTotal, savedWithdrawals,
      recurringIncome, recurringExpected, hasRecurring, grossIncome, base, remaining, remainPct,
      todayTotal, spentByCategory, savingsByCategory,
      prevSpent, vasteLastenBudget, variableBase, carryover,
      adjustedBase, adjustedRemaining, adjustedRemainPct,
      variableEnvelopeTotal, envelopeScale, catBudgetOf,
      allTransactions,
      daysInMonth, dayOfMonth, daysLeft, dagBudget, projectedTotal, projectedOver,
      week, spaarStreak,
      weekBudget, weekTotals, maxWeekVal, currentWeekIdx, balanceByDay, catWithSpend,
    }
  }, [expenses, prevExpenses, yearExpenses, config, selYear, selMonth])
}

export type BudgetStats = ReturnType<typeof useBudgetStats>
