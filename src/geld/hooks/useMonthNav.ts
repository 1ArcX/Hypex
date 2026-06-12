import { useGeldStore } from '../store/geldStore'
import { monthLabelOf } from '../lib/format'

// Maandnavigatie (‹ maand ›) gedeeld door alle tabs
export function useMonthNav() {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)
  const goToPrevMonth = useGeldStore(s => s.goToPrevMonth)
  const goToNextMonth = useGeldStore(s => s.goToNextMonth)

  const now = new Date()
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth()

  return {
    selYear,
    selMonth,
    isCurrentMonth,
    monthLabel: monthLabelOf(selYear, selMonth),
    goToPrevMonth,
    goToNextMonth,
  }
}
