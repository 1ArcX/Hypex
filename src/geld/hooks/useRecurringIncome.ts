import { useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import type { BudgetConfig, Expense, RecurringSource } from '../types'
import { calcRecurringThisMonth, filledThisPeriod, getFilledInToday, isPayDayToday, markFilledInToday, periodOf } from '../lib/recurring'
import { todayStr } from '../lib/format'
import { useGeldStore } from '../store/geldStore'

// Terugkerend inkomen: bronnen uit budget_config, verwacht bedrag deze maand,
// en de betaaldag-prompt (welke bron is vandaag betaaldag en nog niet bevestigd).
export function useRecurringIncome(userId: string, config: BudgetConfig | null, isCurrentMonth: boolean, expenses: Expense[] = []) {
  const refresh = useGeldStore(s => s.refresh)

  const sources = config?.recurring_income || []
  const hasRecurring = sources.length > 0
  const recurringExpected = calcRecurringThisMonth(sources)

  // Bevestigd = vlag in budget_config/localStorage óf er staat vandaag al een
  // inkomstenregel met de bronnaam (werkt ook als het op een ander apparaat is ingevuld)
  const today = todayStr()
  const filledInToday = isCurrentMonth ? getFilledInToday(config) : []
  const incomes = expenses.filter(e => e.is_income)
  const loggedToday = (src: RecurringSource) =>
    incomes.some(e => e.date === today && e.description === src.name) || filledThisPeriod(src, incomes)
  const pendingIncomeSource: RecurringSource | null = isCurrentMonth
    ? (sources.find(src => isPayDayToday(src) && !filledInToday.includes(src.id) && !loggedToday(src)) || null)
    : null

  const saveRecurringIncome = useCallback(async (next: RecurringSource[]) => {
    await supabase.from('budget_config').upsert(
      { recurring_income: next, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    refresh()
  }, [userId, refresh])

  // Bron als bevestigd markeren voor vandaag (localStorage + Supabase)
  const confirmIncomeToday = useCallback(async (sourceId: string) => {
    markFilledInToday(sourceId)
    const today = todayStr()
    const existing = config?.income_confirmed_dates || {}
    const updated: Record<string, string[]> = {
      ...existing,
      [today]: [...new Set([...(existing[today] || []), sourceId])],
    }
    Object.keys(updated).forEach(d => { if (d < today) delete updated[d] })
    const { error } = await supabase.from('budget_config').upsert(
      { income_confirmed_dates: updated, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) console.warn('[geld] betaaldag-bevestiging niet opgeslagen:', error.message)
    refresh()
  }, [userId, config, refresh])

  return { sources, hasRecurring, recurringExpected, pendingIncomeSource, saveRecurringIncome, confirmIncomeToday }
}

/**
 * Bron markeren als ingevuld voor de periode van de inkomensregel (zelfde markering als de Claude-connector
 * fill_recurring_income): recurring_income[].filled[periode] = { expense_id, date, amount }. Leest de config vers,
 * zodat een wijziging op een ander apparaat niet wordt overschreven.
 */
export async function markRecurringFilled(userId: string, sourceId: string, expense: { id: string; date: string; amount: number }) {
  const { data: cfg } = await supabase.from('budget_config').select('recurring_income').eq('user_id', userId).maybeSingle()
  const list: RecurringSource[] = cfg?.recurring_income || []
  const src = list.find(s => s.id === sourceId)
  if (!src) return
  const key = periodOf(src, expense.date).key
  const filled = { ...(src.filled || {}), [key]: { expense_id: expense.id, date: expense.date, amount: expense.amount } }
  for (const k of Object.keys(filled).sort().slice(0, -24)) delete filled[k]
  const { error } = await supabase.from('budget_config')
    .update({ recurring_income: list.map(s => (s.id === sourceId ? { ...s, filled } : s)), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) console.warn('[geld] invulling niet gemarkeerd:', error.message)
}
