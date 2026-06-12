import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { Expense, ExpenseInput } from '../types'
import { monthStartOf, monthEndOf } from '../lib/format'
import { useGeldStore } from '../store/geldStore'

// Uitgaven van de geselecteerde maand + de maand ervoor (voor carryover),
// inclusief CRUD. Mutaties triggeren via refresh() een refetch van alle hooks.
export function useExpenses(userId: string) {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)
  const refreshKey = useGeldStore(s => s.refreshKey)
  const refresh = useGeldStore(s => s.refresh)

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const prevY = selMonth === 0 ? selYear - 1 : selYear
    const prevM = selMonth === 0 ? 11 : selMonth - 1
    const load = async () => {
      const [expRes, prevRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', userId)
          .gte('date', monthStartOf(selYear, selMonth)).lte('date', monthEndOf(selYear, selMonth))
          .order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('expenses')
          .select('amount, is_income, is_savings_withdrawal, paid_from_savings, is_savings_contribution, is_loan_repayment, category, is_planned, date')
          .eq('user_id', userId)
          .gte('date', monthStartOf(prevY, prevM)).lte('date', monthEndOf(prevY, prevM)),
      ])
      if (cancelled) return
      setExpenses((expRes.data as Expense[]) || [])
      setPrevExpenses((prevRes.data as Expense[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, selYear, selMonth, refreshKey])

  const addExpense = useCallback(async (data: ExpenseInput) => {
    await supabase.from('expenses').insert({ ...data, user_id: userId })
    refresh()
  }, [userId, refresh])

  const updateExpense = useCallback(async (id: string, data: ExpenseInput) => {
    await supabase.from('expenses').update(data).eq('id', id)
    refresh()
  }, [refresh])

  const deleteExpense = useCallback(async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    refresh()
  }, [refresh])

  return { expenses, prevExpenses, loading, addExpense, updateExpense, deleteExpense }
}
