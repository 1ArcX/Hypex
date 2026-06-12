import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { Expense } from '../types'
import { sumAmounts } from '../lib/budget'
import { useGeldStore } from '../store/geldStore'

// Debounced zoeken over alle maanden heen (alleen uitgaven, max 100 resultaten)
export function useSearch(userId: string) {
  const searchQuery = useGeldStore(s => s.searchQuery)
  const setSearchQuery = useGeldStore(s => s.setSearchQuery)

  const [results, setResults] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults([])
      setTotal(0)
      return
    }
    setLoading(true)
    const query = searchQuery.trim()
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_income', false)
        .eq('is_savings_withdrawal', false)
        .ilike('description', `%${query}%`)
        .order('date', { ascending: false })
        .limit(100)
      const rows = (data as Expense[]) || []
      setResults(rows)
      setTotal(sumAmounts(rows))
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, userId])

  return { searchQuery, setSearchQuery, results, total, loading }
}
