import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { BudgetConfig, BudgetConfigInput, VacationEntry } from '../types'
import { DEFAULT_CAT_BUDGETS } from '../lib/categories'
import { useGeldStore } from '../store/geldStore'

// budget_config laden en opslaan. Bij het uitschakelen van vakantiemodus
// wordt de vakantie gearchiveerd in vacation_history.
export function useBudgetConfig(userId: string) {
  const refreshKey = useGeldStore(s => s.refreshKey)
  const refresh = useGeldStore(s => s.refresh)

  const [config, setConfig] = useState<BudgetConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('budget_config').select('*').eq('user_id', userId).single()
      if (cancelled) return
      setConfig((data as BudgetConfig) || { monthly_budget: 400, category_budgets: DEFAULT_CAT_BUDGETS })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, refreshKey])

  const saveBudget = useCallback(async (data: BudgetConfigInput) => {
    const existing = config?.vacation_history || []
    let vacHistory = existing
    if (!data.vacation_mode && config?.vacation_mode && config?.vacation_start) {
      const newVac: VacationEntry = {
        start: config.vacation_start,
        end: config.vacation_end || config.vacation_start,
        budget: config.vacation_budget || 0,
      }
      if (!existing.some(v => v.start === newVac.start)) vacHistory = [...existing, newVac]
    }
    await supabase.from('budget_config').upsert(
      { ...data, vacation_history: vacHistory, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    refresh()
  }, [userId, config, refresh])

  return { config, loading, saveBudget }
}
