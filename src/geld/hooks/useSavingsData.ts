import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { Expense } from '../types'
import { monthStartOf, monthEndOf, todayStr } from '../lib/format'
import { sumAmounts } from '../lib/budget'
import { loanTotalWithInterest } from '../lib/savings'
import { useGeldStore } from '../store/geldStore'

// Spaaropnames van het jaar, spaarstortingen van de maand en aflossingen
// van het jaar — plus de leningstand die daaruit volgt.
export function useSavingsData(userId: string) {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)
  const refreshKey = useGeldStore(s => s.refreshKey)
  const refresh = useGeldStore(s => s.refresh)

  const [yearSavings, setYearSavings] = useState<Expense[]>([])
  const [savingsContribs, setSavingsContribs] = useState<Expense[]>([])
  const [loanRepayments, setLoanRepayments] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [yearSavRes, contribRes, repayRes] = await Promise.all([
        supabase.from('expenses').select('id, amount, description, date, savings_type, repaid')
          .eq('user_id', userId).eq('is_savings_withdrawal', true)
          .gte('date', `${selYear}-01-01`),
        supabase.from('expenses').select('id, amount, date, description')
          .eq('user_id', userId).eq('is_savings_contribution', true)
          .gte('date', monthStartOf(selYear, selMonth)).lte('date', monthEndOf(selYear, selMonth))
          .order('date', { ascending: false }),
        supabase.from('expenses').select('id, amount, date')
          .eq('user_id', userId).eq('is_loan_repayment', true)
          .gte('date', `${selYear}-01-01`)
          .order('date', { ascending: false }),
      ])
      if (cancelled) return
      setYearSavings((yearSavRes.data as Expense[]) || [])
      setSavingsContribs((contribRes.data as Expense[]) || [])
      setLoanRepayments((repayRes.data as Expense[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId, selYear, selMonth, refreshKey])

  // Openstaande leningen komen uit de jaarquery zodat afgeloste niet meetellen
  const openLoans = yearSavings.filter(e => e.savings_type === 'loan' && !e.repaid)
  const openLoanPrincipal = sumAmounts(openLoans)
  const openLoanTotal = +(openLoanPrincipal * 1.1).toFixed(2)
  const totalRepaid = sumAmounts(loanRepayments)
  const remainingLoan = Math.max(0, openLoanTotal - totalRepaid)
  const alreadySavedThisMonth = sumAmounts(savingsContribs)

  // Volledige terugstorting van één lening incl. 10% rente
  const repayLoan = useCallback(async (loan: Expense) => {
    const total = loanTotalWithInterest(Number(loan.amount))
    await Promise.all([
      supabase.from('expenses').update({ repaid: true }).eq('id', loan.id),
      supabase.from('expenses').insert({
        user_id: userId, amount: total, category: 'overig',
        description: `↩ Terugstorting lening (incl. 10% rente)`,
        date: todayStr(), is_savings_withdrawal: false, is_income: false,
      }),
    ])
    refresh()
  }, [userId, refresh])

  // Alle open leningen als afgelost markeren (na volledige dekking via inkomen)
  const markAllLoansRepaid = useCallback(async () => {
    const { data } = await supabase.from('expenses').select('id')
      .eq('user_id', userId).eq('savings_type', 'loan').eq('repaid', false)
    if (data?.length) {
      await Promise.all(data.map(l => supabase.from('expenses').update({ repaid: true }).eq('id', l.id)))
    }
  }, [userId])

  return {
    yearSavings, savingsContribs, loanRepayments, loading,
    openLoans, openLoanPrincipal, openLoanTotal, totalRepaid, remainingLoan, alreadySavedThisMonth,
    repayLoan, markAllLoansRepaid,
  }
}
