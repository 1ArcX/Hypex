import { useEffect, useState } from 'react'
import { todayISO } from '../focus/lib/format'
import { recapKey, useRecapStore } from './store/recapStore'
import { isSunday, mondayOf } from './lib/recapStats'

// Herinnering in de navigatie: na 20:00 en nog geen dagrecap (zondag ook: weekrecap nog open).

const DUE_HOUR = 20

export function useRecapDue(userId: string | undefined) {
  const byKey = useRecapStore(s => s.byKey)
  const needsMigration = useRecapStore(s => s.needsMigration)
  const load = useRecapStore(s => s.load)
  const [, tick] = useState(0)

  useEffect(() => { if (userId) load(userId) }, [userId, load])
  useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  if (!userId || needsMigration || new Date().getHours() < DUE_HOUR) return false
  const today = todayISO()
  if (!byKey[recapKey('day', today)]) return true
  return isSunday(today) && !byKey[recapKey('week', mondayOf(today))]
}
