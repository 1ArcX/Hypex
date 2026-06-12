import { ProgressBar } from '../components/ui/Glass'
import { fmtShort } from '../lib/format'

// Uitgaven per week van de maand (week 1 = dag 1-7, enz.)
export function WeekBars({ weekTotals, weekBudget, maxWeekVal, currentWeekIdx, dayOfMonth }: {
  weekTotals: number[]
  weekBudget: number
  maxWeekVal: number
  currentWeekIdx: number
  dayOfMonth: number
}) {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map(i => {
        const weekStart = [1, 8, 15, 22, 29][i]
        if (weekStart > dayOfMonth && weekTotals[i] === 0) return null
        const pct = (weekTotals[i] / maxWeekVal) * 100
        const barColor = weekTotals[i] > weekBudget * 1.2 ? '#F87171' : weekTotals[i] > weekBudget * 0.8 ? '#FBBF24' : '#5EEAD4'
        const cur = i === currentWeekIdx
        return (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <span className={`text-[11px] ${cur ? 'text-teal-300 font-bold' : 'text-white/35'}`}>
                Week {i + 1}{cur ? ' ●' : ''}
              </span>
              <span className="text-[11px] font-semibold text-white/60 tabular-nums">{fmtShort(weekTotals[i])}</span>
            </div>
            <ProgressBar pct={pct} color={barColor} height={7} />
          </div>
        )
      })}
    </div>
  )
}
