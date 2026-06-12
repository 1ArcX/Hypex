import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/Glass'
import { TransactionRow } from '../components/TransactionRow'
import type { BudgetStats } from '../hooks/useBudgetStats'
import type { Expense } from '../types'
import { findCategory } from '../lib/categories'
import { fmt } from '../lib/format'
import { isHistVacationExpense, sumAmounts } from '../lib/budget'

// Alle uitgaven van de maand: gepland, regulier en vakantie apart
export function UitgavenSheet({ stats, onClose, onEdit, onDelete, onPlan }: {
  stats: BudgetStats
  onClose: () => void
  onEdit: (exp: Expense) => void
  onDelete: (id: string) => void
  onPlan: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const { plannedExpenses, regularExpenses, allCategories, totalSpent, vacHistory } = stats

  const nonVacExps = regularExpenses.filter(e => !isHistVacationExpense(e, vacHistory))
  const vacExps = regularExpenses.filter(e => isHistVacationExpense(e, vacHistory))
  const vacBudgetForExps = vacExps.length > 0
    ? (vacHistory.find(v => vacExps.some(e => e.date >= v.start && e.date <= (v.end || v.start)))?.budget || 0)
    : 0

  return (
    <Sheet onClose={onClose} title="💸 Uitgaven">
      <div className="flex items-center justify-between mb-4 -mt-1">
        <span className="text-[13px] text-white/35">{fmt(totalSpent)} totaal deze maand</span>
        <button onClick={onPlan}
          className="px-2.5 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 cursor-pointer text-[12px] font-semibold">
          📌 Plannen
        </button>
      </div>

      {/* Geplande uitgaven */}
      {plannedExpenses.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-amber-400 font-bold uppercase tracking-[0.07em] mb-2">📌 Gepland</p>
          <div className="flex flex-col gap-1.5">
            {plannedExpenses.map(exp => {
              const cat = findCategory(allCategories, exp.category)
              return (
                <div key={exp.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-amber-400/[0.05] border border-amber-400/30">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center text-lg shrink-0">{cat.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white/85 m-0 truncate">{exp.description}</p>
                    <p className="text-[11px] text-white/30 m-0">{exp.date}{exp.amount > 0 ? ` · ${fmt(exp.amount)}` : ' · bedrag onbekend'}</p>
                  </div>
                  <button onClick={() => onEdit(exp)}
                    className="bg-amber-400/15 border border-amber-400/35 rounded-lg cursor-pointer text-amber-400 px-2 py-1 text-[11px] font-bold whitespace-nowrap">
                    ✓ Bevestig
                  </button>
                  <button onClick={() => onDelete(exp.id)} className="bg-transparent border-none cursor-pointer text-red-400/50 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reguliere transacties */}
      {nonVacExps.length > 0 ? (
        <>
          <div className="flex flex-col gap-1.5 mb-3">
            {(showAll ? nonVacExps : nonVacExps.slice(0, 12)).map(exp => (
              <TransactionRow key={exp.id} exp={exp} allCategories={allCategories} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
          {nonVacExps.length > 12 && (
            <button onClick={() => setShowAll(v => !v)}
              className="w-full mb-3 py-2.5 rounded-2xl bg-transparent border border-white/10 text-white/35 cursor-pointer text-[13px] flex items-center justify-center gap-1.5">
              {showAll ? <><ChevronUp size={14} /> Minder tonen</> : <><ChevronDown size={14} /> Alle {nonVacExps.length} tonen</>}
            </button>
          )}
        </>
      ) : plannedExpenses.length === 0 && vacExps.length === 0 ? (
        <EmptyState emoji="💰" title="Nog geen uitgaves" sub="Voeg je eerste uitgave toe" />
      ) : null}

      {/* Vakantie-uitgaven (gearchiveerde vakantie) */}
      {vacExps.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-[0.07em] m-0">✈️ Vakantie</p>
            <span className="text-[12px] font-bold text-cyan-400 tabular-nums">
              {fmt(sumAmounts(vacExps))}
              {vacBudgetForExps > 0 && <span className="text-[11px] font-normal text-cyan-400/60 ml-1">/ {fmt(vacBudgetForExps)}</span>}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-cyan-400/[0.04] border border-cyan-400/[0.12]">
            {vacExps.map(exp => (
              <TransactionRow key={exp.id} exp={exp} allCategories={allCategories} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
