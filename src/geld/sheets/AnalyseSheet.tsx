import { Sheet } from '../components/ui/Sheet'
import { glassCardSm } from '../components/ui/Glass'
import { WeekBars } from '../charts/WeekBars'
import { DayHeatmap } from '../charts/DayHeatmap'
import { CategoryDonut } from '../charts/CategoryDonut'
import { BalanceLine } from '../charts/BalanceLine'
import type { BudgetStats } from '../hooks/useBudgetStats'
import { useGeldStore } from '../store/geldStore'

// Analyse van de maand: weekbalken, dagheatmap, categorie-donut en saldolijn
export function AnalyseSheet({ stats, onClose }: { stats: BudgetStats; onClose: () => void }) {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)

  return (
    <Sheet onClose={onClose} title="📊 Analyse">
      <div className={`${glassCardSm} p-4 mb-2.5`}>
        <p className="text-[12px] font-semibold text-white/60 mb-3">Uitgaven per week</p>
        <WeekBars weekTotals={stats.weekTotals} weekBudget={stats.weekBudget}
          maxWeekVal={stats.maxWeekVal} currentWeekIdx={stats.currentWeekIdx} dayOfMonth={stats.dayOfMonth} />
      </div>

      <div className={`${glassCardSm} p-3.5 pb-2.5 mb-2.5`}>
        <p className="text-[12px] font-semibold text-white/60 mb-2.5">📅 Uitgaven per dag</p>
        <DayHeatmap budgetExpenses={stats.budgetExpenses} selYear={selYear} selMonth={selMonth} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className={`${glassCardSm} p-3.5`}>
          <p className="text-[12px] font-semibold text-white/60 mb-2.5">Categorieën</p>
          <CategoryDonut data={stats.catWithSpend} totalSpent={stats.totalSpent} />
        </div>
        <div className={`${glassCardSm} p-3.5`}>
          <p className="text-[12px] font-semibold text-white/60 mb-2.5">Saldo verloop</p>
          <BalanceLine balanceByDay={stats.balanceByDay} dayOfMonth={stats.dayOfMonth}
            daysInMonth={stats.daysInMonth} adjustedBase={stats.adjustedBase} totalSpent={stats.totalSpent} />
        </div>
      </div>
    </Sheet>
  )
}
