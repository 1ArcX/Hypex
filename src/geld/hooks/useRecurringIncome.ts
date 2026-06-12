import { useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import type { BudgetConfig, RecurringSource } from '../types'
import { calcRecurringThisMonth, getFilledInToday, isPayDayToday, markFilledInToday } from '../lib/recurring'
import { todayStr } from '../lib/format'
import { useGeldStore } from '../store/geldStore'

// Terugkerend inkomen: bronnen uit budget_config, verwacht bedrag deze maand,
// en de betaaldag-prompt (welke bron is vandaag betaaldag en nog niet bevestigd).
export function useRecurringIncome(userId: string, config: BudgetConfig | null, isCurrentMonth: boolean) {
  const refresh = useGeldStore(s => s.refresh)

  const sources = config?.recurring_income || []
  const hasRecurring = sources.length > 0
  const recurringExpected = calcRecurringThisMonth(sources)

  const filledInToday = isCurrentMonth ? getFilledInToday(config) : []
  const pendingIncomeSource: RecurringSource | null = isCurrentMonth
    ? (sources.find(src => isPayDayToday(src) && !filledInToday.includes(src.id)) || null)
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
    await supabase.from('budget_config').upsert(
      { income_confirmed_dates: updated, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    refresh()
  }, [userId, config, refresh])

  return { sources, hasRecurring, recurringExpected, pendingIncomeSource, saveRecurringIncome, confirmIncomeToday }
}
