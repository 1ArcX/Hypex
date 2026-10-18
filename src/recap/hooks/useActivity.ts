import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useCompletions } from '../../utils/taskCompletions'
import { addDays, dayOf, todayISO } from '../../focus/lib/format'

// Wat je per dag gedaan hebt, voor de automatische samenvatting in Recap:
// afgeronde taken (task_completions), focusminuten (pomodoro_sessions) en uitgaven (expenses, alleen admin).

export interface CompletionRow { id: string; day: string; title: string; recurring: boolean }

export interface Activity {
  completions: CompletionRow[]
  tasksByDay: Record<string, number>
  focusByDay: Record<string, number>
  /** null = geen toegang tot Geld */
  spendByDay: Record<string, number> | null
  loading: boolean
}

export function useActivity(userId: string, isAdmin: boolean, days = 21): Activity {
  const { rows, loading } = useCompletions(userId, days) as { rows: CompletionRow[]; loading: boolean }
  const [focusByDay, setFocus] = useState<Record<string, number>>({})
  const [spendByDay, setSpend] = useState<Record<string, number> | null>(null)
  const from = addDays(todayISO(), -(days - 1))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('pomodoro_sessions').select('completed_at, duration_minutes')
        .eq('user_id', userId).eq('mode', 'work').gte('completed_at', new Date(from + 'T00:00:00').toISOString()).limit(5000)
      if (cancelled) return
      const out: Record<string, number> = {}
      for (const r of (data || []) as { completed_at: string | null; duration_minutes: number | null }[]) {
        if (!r.completed_at) continue
        const d = dayOf(r.completed_at)
        out[d] = (out[d] || 0) + (r.duration_minutes || 0)
      }
      setFocus(out)
    }
    load()
    window.addEventListener('pomodoroLocalChange', load)
    return () => { cancelled = true; window.removeEventListener('pomodoroLocalChange', load) }
  }, [userId, from])

  useEffect(() => {
    if (!isAdmin) { setSpend(null); return }
    let cancelled = false
    supabase.from('expenses')
      .select('date, amount, is_income, is_savings_contribution, is_savings_withdrawal, is_loan_repayment, is_planned')
      .eq('user_id', userId).gte('date', from).lte('date', todayISO())
      .then(({ data, error }) => {
        if (cancelled || error) return
        const out: Record<string, number> = {}
        for (const e of (data || []) as { date: string; amount: number; is_income?: boolean; is_savings_contribution?: boolean; is_savings_withdrawal?: boolean; is_loan_repayment?: boolean; is_planned?: boolean }[]) {
          if (e.is_income || e.is_savings_contribution || e.is_savings_withdrawal || e.is_loan_repayment || e.is_planned) continue
          out[e.date] = (out[e.date] || 0) + Number(e.amount || 0)
        }
        setSpend(out)
      })
    return () => { cancelled = true }
  }, [userId, isAdmin, from])

  const tasksByDay = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of rows) out[r.day] = (out[r.day] || 0) + 1
    return out
  }, [rows])

  return { completions: rows, tasksByDay, focusByDay, spendByDay, loading }
}
