import { Settings2 } from 'lucide-react'
import { MonthHeader } from '../components/MonthHeader'
import { ProgressBar, EmptyState } from '../components/ui/Glass'
import type { BudgetStats } from '../hooks/useBudgetStats'
import { fmt } from '../lib/format'

// Enveloppen: budget vs. besteed per categorie, met carryover-schaling
// en spaargeld-segment in de balk
export function EnveloppenView({ stats, onOpenBudget }: {
  stats: BudgetStats
  onOpenBudget: () => void
}) {
  const s = stats
  const allEmpty = s.allCategories.every(c => !(s.catBudgets[c.id] || 0) && !(s.spentByCategory[c.id] || 0))

  return (
    <>
      <MonthHeader />

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[22px] font-extrabold text-white/95 m-0">Enveloppen</h2>
        <button onClick={onOpenBudget}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/[0.05] backdrop-blur-lg border border-white/10 text-white/60 cursor-pointer text-[12px] font-semibold">
          <Settings2 size={13} /> Beheren
        </button>
      </div>

      {s.carryover > 0 && (
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-400/[0.07] border border-amber-400/30 mb-3 backdrop-blur-lg">
          <span className="text-base shrink-0">↩</span>
          <div>
            <p className="text-[12px] font-bold text-amber-400 m-0 mb-px">Budgetten aangepast door overschrijding vorige maand</p>
            <p className="text-[11px] text-white/35 m-0">
              {fmt(s.carryover)} tekort verdeeld over alle enveloppen ({Math.round((1 - s.envelopeScale) * 100)}% minder per categorie)
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {s.allCategories.map(cat => {
          const budget = s.catBudgetOf(cat.id)
          const origBudget = s.catBudgets[cat.id] || 0
          const spent = s.spentByCategory[cat.id] || 0
          const fromSav = s.savingsByCategory[cat.id] || 0
          const total = spent + fromSav
          const overAmt = spent > budget && budget > 0 ? spent - budget : 0
          const over = overAmt > 0
          const regPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
          const savPct = budget > 0 ? Math.min(100 - Math.min(100, regPct), (fromSav / budget) * 100) : 0
          const barColor = over ? '#F87171' : regPct > 75 ? '#FBBF24' : (cat.color || '#5EEAD4')
          if (budget === 0 && total === 0) return null
          return (
            <div key={cat.id}
              className={`px-4 py-3 rounded-2xl backdrop-blur-lg border ${
                over ? 'bg-red-400/[0.05] border-red-400/30'
                  : fromSav > 0 ? 'bg-white/[0.04] border-amber-400/20'
                  : 'bg-white/[0.04] border-white/[0.08]'
              }`}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="flex-1 text-[13px] font-semibold text-white/70">{cat.label}</span>
                <div className="text-right">
                  {budget > 0 ? (
                    over ? (
                      <span className="text-[13px] font-bold text-red-400 tabular-nums">−{fmt(overAmt)} over</span>
                    ) : (
                      <span className={`text-[13px] font-bold tabular-nums ${regPct > 75 ? 'text-amber-400' : 'text-white/90'}`}>
                        {fmt(budget - spent)} nog
                      </span>
                    )
                  ) : (
                    <span className="text-[13px] font-bold text-white/90 tabular-nums">{fmt(total)}</span>
                  )}
                  {budget > 0 && origBudget !== budget ? (
                    <span className="text-[11px] text-amber-400 tabular-nums"> / {fmt(budget)} <span className="line-through opacity-50">{fmt(origBudget)}</span></span>
                  ) : budget > 0 ? (
                    <span className="text-[11px] text-white/30 tabular-nums"> / {fmt(budget)}</span>
                  ) : null}
                </div>
              </div>
              {budget > 0 && (
                <div className="mb-1.5">
                  <ProgressBar pct={regPct} color={barColor}
                    segments={fromSav > 0 && savPct > 0 ? [{ pct: savPct, color: 'rgba(251,191,36,0.45)' }] : undefined} />
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex gap-2.5 flex-wrap">
                  {fromSav > 0 && <span className="text-[10px] text-amber-400 font-semibold">🏦 {fmt(fromSav)} spaarrekening</span>}
                  {spent > 0 && fromSav > 0 && <span className="text-[10px] text-white/30">+ {fmt(spent)} budget</span>}
                </div>
                {over && (
                  <span className="text-[11px] font-extrabold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md tabular-nums">
                    +{fmt(overAmt)} over
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {allEmpty && <EmptyState emoji="📁" title="Geen enveloppen" sub="Stel budgetten in via 'Beheren'" />}
      </div>
    </>
  )
}
