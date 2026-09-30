import { Plus, Settings2, Trash2 } from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { ProgressBar, EmptyState, glassCardSm } from '../components/ui/Glass'
import { TransactionRow } from '../components/TransactionRow'
import type { BudgetStats } from '../hooks/useBudgetStats'
import type { Expense } from '../types'
import { findCategory } from '../lib/categories'
import { fmt, fmtDay } from '../lib/format'
import { envelopeProgress, filterRegular, sumAmounts } from '../lib/budget'

// Detail van één envelop: budgetstatus, kerncijfers, vergelijking met vorige
// maand en alle uitgaven in deze categorie
export function EnvelopeSheet({ catId, stats, prevExpenses, onClose, onEdit, onDelete, onAdd, onOpenBudget }: {
  catId: string
  stats: BudgetStats
  prevExpenses: Expense[]
  onClose: () => void
  onEdit: (exp: Expense) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onOpenBudget: () => void
}) {
  const cat = findCategory(stats.allCategories, catId)
  const budget = stats.catBudgetOf(catId)
  const origBudget = stats.catBudgets[catId] || 0
  const spent = stats.spentByCategory[catId] || 0
  const fromSav = stats.savingsByCategory[catId] || 0
  const { overAmt, over, regPct, savPct } = envelopeProgress(budget, spent, fromSav)
  const barColor = over ? '#F87171' : regPct > 75 ? '#FBBF24' : (cat.color || 'var(--accent)')

  const inCat = stats.regularExpenses.filter(e => e.category === catId)
  const planned = inCat.filter(e => e.is_planned)
  const txs = inCat.filter(e => !e.is_planned)
  const txTotal = sumAmounts(txs)
  const avg = txs.length > 0 ? txTotal / txs.length : 0
  const biggest = txs.reduce<Expense | null>((m, e) => (!m || Number(e.amount) > Number(m.amount) ? e : m), null)

  const prevSpent = sumAmounts(filterRegular(prevExpenses)
    .filter(e => e.category === catId && !e.paid_from_savings && (!e.is_planned || e.amount > 0)))
  const diff = spent - prevSpent

  return (
    <Sheet onClose={onClose} title={`${cat.emoji} ${cat.label}`}>
      {/* Status */}
      <div className={`${glassCardSm} p-4 mb-2.5`}>
        {budget > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-2">
              {over ? (
                <span className="text-[24px] font-extrabold text-red-400 tabular-nums">−{fmt(overAmt)} <span className="text-[13px] font-semibold">over</span></span>
              ) : (
                <span className={`text-[24px] font-extrabold tabular-nums ${regPct > 75 ? 'text-amber-400' : 'text-white/95'}`}>
                  {fmt(budget - spent)} <span className="text-[13px] font-semibold text-white/40">nog</span>
                </span>
              )}
              <span className="text-[12px] text-white/35 tabular-nums">
                {fmt(spent)} / {fmt(budget)}
                {origBudget !== budget && <span className="line-through opacity-50 ml-1">{fmt(origBudget)}</span>}
              </span>
            </div>
            <ProgressBar pct={regPct} color={barColor} height={8}
              segments={fromSav > 0 && savPct > 0 ? [{ pct: savPct, color: 'rgba(251,191,36,0.45)' }] : undefined} />
            {origBudget !== budget && (
              <p className="text-[11px] text-amber-400/80 m-0 mt-2">↩ Budget verlaagd door tekort vorige maand</p>
            )}
          </>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-[24px] font-extrabold text-white/95 tabular-nums">{fmt(spent + fromSav)}</span>
            <span className="text-[12px] text-white/35">geen budget ingesteld</span>
          </div>
        )}
      </div>

      {/* Kerncijfers */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <Kpi label="Uitgaven" value={String(txs.length)} />
        <Kpi label="Gemiddeld" value={txs.length ? fmt(avg) : '—'} />
        <Kpi label="Vorige maand" value={fmt(prevSpent)}
          sub={prevSpent > 0 || spent > 0
            ? (diff === 0 ? 'gelijk' : `${diff > 0 ? '↑' : '↓'} ${fmt(Math.abs(diff))}`)
            : undefined}
          subClass={diff > 0 ? 'text-red-400/80' : 'text-emerald-400/80'} />
      </div>
      {(fromSav > 0 || biggest) && (
        <div className="flex gap-3 flex-wrap mb-3 px-1">
          {biggest && (
            <span className="text-[11px] text-white/35">
              Grootste: <span className="text-white/60 font-semibold">{biggest.description || cat.label}</span> · {fmt(Number(biggest.amount))} ({fmtDay(biggest.date)})
            </span>
          )}
          {fromSav > 0 && <span className="text-[11px] text-amber-400 font-semibold">🏦 {fmt(fromSav)} van spaarrekening</span>}
        </div>
      )}

      {/* Acties */}
      <div className="flex gap-2 mb-4">
        <button onClick={onAdd}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-accent text-black border-none cursor-pointer text-[13px] font-bold">
          <Plus size={14} /> Uitgave
        </button>
        <button onClick={onOpenBudget}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-white/[0.05] border border-white/10 text-white/60 cursor-pointer text-[13px] font-semibold">
          <Settings2 size={13} /> Budget aanpassen
        </button>
      </div>

      {/* Gepland */}
      {planned.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-amber-400 font-bold uppercase tracking-[0.07em] mb-2">📌 Gepland</p>
          <div className="flex flex-col gap-1.5">
            {planned.map(exp => (
              <div key={exp.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-amber-400/[0.05] border border-amber-400/30">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/85 m-0 truncate">{exp.description}</p>
                  <p className="text-[11px] text-white/30 m-0">{fmtDay(exp.date)}{exp.amount > 0 ? ` · ${fmt(exp.amount)}` : ' · bedrag onbekend'}</p>
                </div>
                <button onClick={() => onEdit(exp)}
                  className="bg-amber-400/15 border border-amber-400/35 rounded-lg cursor-pointer text-amber-400 px-2 py-1 text-[11px] font-bold whitespace-nowrap">
                  ✓ Bevestig
                </button>
                <button aria-label="Verwijderen" onClick={() => onDelete(exp.id)} className="bg-transparent border-none cursor-pointer text-red-400/50 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transacties */}
      <p className="text-[11px] text-white/35 font-bold uppercase tracking-[0.07em] mb-2">Uitgaven deze maand</p>
      {txs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {txs.map(exp => (
            <TransactionRow key={exp.id} exp={exp} allCategories={stats.allCategories} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <EmptyState emoji={cat.emoji} title="Nog niets uitgegeven" sub="Deze envelop is nog onaangeroerd" />
      )}
    </Sheet>
  )
}

function Kpi({ label, value, sub, subClass = '' }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <div className={`${glassCardSm} px-3 py-2.5`}>
      <p className="text-[10px] text-white/35 m-0 mb-0.5">{label}</p>
      <p className="text-[15px] font-bold text-white/90 m-0 tabular-nums truncate">{value}</p>
      {sub && <p className={`text-[10px] font-semibold m-0 tabular-nums ${subClass}`}>{sub}</p>}
    </div>
  )
}
