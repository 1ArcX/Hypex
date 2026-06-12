import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { Expense } from '../types'
import { useGeldStore } from '../store/geldStore'

// Alle uitgaven van het geselecteerde jaar — voor het jaaroverzicht én de
// carryover-berekening (maanden verder terug dan de vorige maand).
export function useYearExpenses(userId: string) {
  const selYear = useGeldStore(s => s.selYear)
  const refreshKey = useGeldStore(s => s.refreshKey)

  const [yearExpenses, setYearExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('expenses')
        .select('amount, date, is_income, is_savings_withdrawal, is_savings_contribution, is_loan_repayment, category, paid_from_savings, is_planned')
        .eq('user_id', userId)
        .gte('date', `${selYear}-01-01`).lte('date', `${selYear}-12-31`)
      if (cancelled) return
      setYearExpenses((data as Expense[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, selYear, refreshKey])

  return { yearExpenses, loading }
}
