import { GlassCard, ProgressBar } from '../components/ui/Glass'
import { useGeldStore } from '../store/geldStore'
import type { BudgetStats } from '../hooks/useBudgetStats'
import type { Expense } from '../types'
import { buildYearMonthly } from '../lib/year'
import { fmt } from '../lib/format'

const MONTHS_NL = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

// Jaaroverzicht: totalen + maandlijst; tik op een maand om die te openen
export function JaarView({ stats, yearExpenses, config }: {
  stats: BudgetStats
  yearExpenses: Expense[]
  config: Parameters<typeof buildYearMonthly>[1]
}) {
  const selYear = useGeldStore(s => s.selYear)
  const selMonth = useGeldStore(s => s.selMonth)
  const setActiveTab = useGeldStore(s => s.setActiveTab)
  const store = useGeldStore

  const nowY = new Date().getFullYear()
  const yearMonthly = buildYearMonthly(yearExpenses, config, selYear)
  const totalYearSpent = yearMonthly.reduce((s, m) => s + m.spent, 0)
  const totalYearVac = yearMonthly.reduce((s, m) => s + m.vacSpent, 0)
  const totalYearIncome = yearMonthly.reduce((s, m) => s + m.income, 0)
  const maxSpent = Math.max(...yearMonthly.map(m => m.spent), 1)

  const setYear = (y: number) => store.setState({ selYear: y })
  const openMonth = (m: number) => {
    store.setState({ selMonth: m })
    setActiveTab('home')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[22px] font-extrabold text-white/95 m-0">Jaar {selYear}</h2>
        <div className="flex gap-1.5">
          <button onClick={() => setYear(selYear - 1)}
            className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] backdrop-blur-lg border border-white/10 text-white/60 cursor-pointer text-[13px]">
            ‹ {selYear - 1}
          </button>
          {selYear < nowY && (
            <button onClick={() => setYear(selYear + 1)}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] backdrop-blur-lg border border-white/10 text-white/60 cursor-pointer text-[13px]">
              {selYear + 1} ›
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-2.5 ${totalYearVac > 0 ? 'mb-2' : 'mb-4'}`}>
        <GlassCard className="px-4 py-3 !rounded-2xl">
          <p className="text-[10px] text-red-400/70 uppercase font-bold mb-1">Totaal uitgegeven</p>
          <p className="text-[22px] font-extrabold text-red-400 m-0 tabular-nums">{fmt(totalYearSpent)}</p>
        </GlassCard>
        <GlassCard className="px-4 py-3 !rounded-2xl">
          <p className="text-[10px] text-emerald-400/70 uppercase font-bold mb-1">Totaal inkomen</p>
          <p className="text-[22px] font-extrabold text-emerald-400 m-0 tabular-nums">{fmt(totalYearIncome)}</p>
        </GlassCard>
      </div>

      {totalYearVac > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-cyan-400/[0.06] border border-cyan-400/20 mb-4 backdrop-blur-lg">
          <span className="text-[15px]">✈️</span>
          <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wide flex-1">Vakantie uitgaven</span>
          <span className="text-lg font-extrabold text-cyan-400 tabular-nums">{fmt(totalYearVac)}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {yearMonthly.map(({ m, spent, income, hasDat, vacSpent, vacOvY }) => {
          const isSelMonth = m === selMonth
          const barW = maxSpent > 0 ? (spent / maxSpent) * 100 : 0
          return (
            <button key={m} onClick={() => openMonth(m)}
              className={`px-3.5 py-3 rounded-2xl cursor-pointer text-left backdrop-blur-lg border ${
                isSelMonth ? 'bg-teal-300/[0.06] border-teal-300/60'
                  : hasDat ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.05]'
              }`}>
              <div className={`flex items-center gap-2.5 ${hasDat && vacOvY && vacSpent > 0 ? 'mb-1.5' : ''}`}>
                <span className={`text-[12px] font-bold w-7 shrink-0 ${isSelMonth ? 'text-teal-300' : 'text-white/60'}`}>{MONTHS_NL[m]}</span>
                <div className="flex-1">
                  {hasDat ? (
                    <ProgressBar pct={barW} color={spent > (income || stats.base) ? '#F87171' : '#5EEAD4'} />
                  ) : (
                    <span className="text-[11px] text-white/25">Geen data</span>
                  )}
                </div>
                {hasDat && (
                  <div className="text-right shrink-0">
                    <span className="text-[13px] font-bold text-red-400 tabular-nums">{fmt(spent)}</span>
                    {income > 0 && <span className="text-[11px] text-emerald-400 ml-1.5 tabular-nums">+{fmt(income)}</span>}
                  </div>
                )}
              </div>
              {vacOvY && vacSpent > 0 && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-cyan-400/[0.12]">
                  <span className="text-[11px]">✈️</span>
                  <span className="text-[11px] text-cyan-400 flex-1">Vakantie</span>
                  <span className="text-[12px] font-semibold text-cyan-400 tabular-nums">{fmt(vacSpent)}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
