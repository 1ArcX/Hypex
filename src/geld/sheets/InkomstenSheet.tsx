import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { Sheet } from '../components/ui/Sheet'
import { glassInput, ProgressBar, EmptyState } from '../components/ui/Glass'
import { TransactionRow } from '../components/TransactionRow'
import { scrollFix } from '../hooks/useIosScroll'
import { useGeldStore } from '../store/geldStore'
import type { BudgetStats } from '../hooks/useBudgetStats'
import type { Expense, RecurringSource } from '../types'
import { fmt, todayStr, parseAmount } from '../lib/format'
import { getNextPayDate, calcRecurringThisMonth, isPayDayToday } from '../lib/recurring'

// Inkomsten & sparen: terugkerende bronnen, openstaande lening,
// spaaroverboekingen, opnames en eenmalige inkomsten
export function InkomstenSheet({ stats, savings, userId, isCurrentMonth, onClose, onManageRecurring, onEarlyIncome, onAddIncome, onEditSavings, onDelete }: {
  stats: BudgetStats
  savings: {
    openLoans: Expense[]
    openLoanPrincipal: number
    openLoanTotal: number
    totalRepaid: number
    remainingLoan: number
    alreadySavedThisMonth: number
    savingsContribs: Expense[]
    loanRepayments: Expense[]
  }
  userId: string
  isCurrentMonth: boolean
  onClose: () => void
  onManageRecurring: () => void
  onEarlyIncome: (src: RecurringSource) => void
  onAddIncome: () => void
  onEditSavings: (exp: Expense) => void
  onDelete: (id: string) => void
}) {
  const refresh = useGeldStore(s => s.refresh)
  const [loanRepayInput, setLoanRepayInput] = useState('')
  const [savingsInput, setSavingsInput] = useState('')

  const { hasRecurring, recurringIncome, recurringExpected, savingsGoal, base, manualIncome, savedWithdrawals, allCategories, savingsWithdrawals } = stats
  const { openLoans, openLoanPrincipal, openLoanTotal, totalRepaid, remainingLoan, alreadySavedThisMonth, savingsContribs, loanRepayments } = savings

  const deleteRow = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    refresh()
  }

  const repayPartial = async () => {
    const partialAmount = parseAmount(loanRepayInput)
    if (!partialAmount || partialAmount <= 0) return
    await supabase.from('expenses').insert({ user_id: userId, amount: partialAmount, category: 'overig', description: '↩ Gedeeltelijke terugbetaling lening', date: todayStr(), is_loan_repayment: true, is_income: false, is_savings_withdrawal: false })
    if (remainingLoan - partialAmount <= 0) {
      await Promise.all(openLoans.map(loan => supabase.from('expenses').update({ repaid: true }).eq('id', loan.id)))
    }
    setLoanRepayInput('')
    refresh()
  }

  const addContribution = async () => {
    const amt = parseAmount(savingsInput)
    if (!amt || amt <= 0) return
    await supabase.from('expenses').insert({ user_id: userId, amount: amt, category: 'overig', description: '🏦 Spaarstorting', date: todayStr(), is_savings_contribution: true, is_income: false, is_savings_withdrawal: false })
    setSavingsInput('')
    refresh()
  }

  return (
    <Sheet onClose={onClose} title="💚 Inkomsten & sparen" accentColor="#34D399">
      {/* Terugkerend inkomen */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-white/35 uppercase tracking-[0.07em] m-0">Terugkerend</p>
        <button onClick={onManageRecurring}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold cursor-pointer border ${
            hasRecurring ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-white/[0.05] border-white/10 text-white/60'
          }`}>
          {hasRecurring ? '✏ Beheren' : '+ Instellen'}
        </button>
      </div>

      {hasRecurring && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-400/[0.04] border border-emerald-400/[0.15]">
          <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wide mb-2.5">
            Verwacht deze maand · {fmt(recurringExpected)}
          </p>
          <div className="flex flex-col gap-2">
            {recurringIncome.map(src => {
              const next = getNextPayDate(src)
              const thisMonth = calcRecurringThisMonth([src])
              const isToday = isPayDayToday(src)
              return (
                <div key={src.id} className="flex items-center gap-2.5">
                  <div className="w-[34px] h-[34px] rounded-xl bg-emerald-400/10 flex items-center justify-center text-lg shrink-0">{src.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white/85 m-0">{src.name}</p>
                    <p className="text-[11px] text-white/30 m-0">
                      {src.type === 'monthly' ? `${src.day}e van de maand` : `Elke ${src.interval_days} dagen`}
                      {next ? ` · volgende: ${next}` : ''}
                    </p>
                  </div>
                  <span className={`text-[14px] font-bold tabular-nums ${thisMonth > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                    {thisMonth > 0 ? fmt(thisMonth) : '–'}
                  </span>
                  {isCurrentMonth && (
                    <button onClick={() => onEarlyIncome(src)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap border ${
                        isToday ? 'bg-emerald-400 border-transparent text-black' : 'bg-emerald-400/10 border-emerald-400/35 text-emerald-400'
                      }`}>
                      {isToday ? '✓ Invullen' : 'Nu invullen'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {savingsGoal > 0 && (
            <>
              <div className="mt-2.5 pt-2.5 border-t border-emerald-400/[0.12] flex justify-between text-[12px]">
                <span className="text-white/35">🏦 Spaardoel</span>
                <span className="text-emerald-400 font-bold tabular-nums">− {fmt(savingsGoal)}</span>
              </div>
              <div className="flex justify-between text-[12px] mt-1">
                <span className="text-white/35">Beschikbaar budget</span>
                <span className="text-white/90 font-bold tabular-nums">{fmt(base)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Openstaande lening */}
      {openLoans.length > 0 && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-400/[0.06] border border-amber-400/30">
          <p className="text-[13px] font-bold text-amber-400 mb-1">🤝 Openstaande lening van mezelf</p>
          <p className="text-[12px] text-white/35 mb-2.5">
            {openLoans.length}× opnames · Totaal {fmt(openLoanPrincipal)} + 10% rente = {fmt(openLoanTotal)}
          </p>
          <ProgressBar pct={openLoanTotal > 0 ? (totalRepaid / openLoanTotal) * 100 : 0} color="#34D399" />
          <div className="flex justify-between text-[11px] text-white/35 mt-1.5 mb-2.5">
            <span>Terugbetaald: {fmt(totalRepaid)}</span>
            <span>Nog open: {fmt(remainingLoan)}</span>
          </div>
          {loanRepayments.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {loanRepayments.map(r => (
                <div key={r.id} className="flex items-center justify-between text-[12px] py-1.5 border-t border-amber-400/10">
                  <span className="text-white/35">{r.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 tabular-nums">{fmt(r.amount)}</span>
                    <button onClick={() => deleteRow(r.id)} className="bg-transparent border-none cursor-pointer text-red-400/50 p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-white/30">€</span>
              <input type="text" inputMode="decimal" placeholder="Bedrag teruggestort"
                value={loanRepayInput} onChange={e => setLoanRepayInput(e.target.value)} onFocus={scrollFix}
                className={`${glassInput} pl-7 pr-2.5 py-2 text-[14px] border-amber-400/30`} />
            </div>
            <button onClick={repayPartial}
              className="px-3.5 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-400 cursor-pointer text-[13px] font-bold whitespace-nowrap">
              Storten
            </button>
          </div>
        </div>
      )}

      {/* Spaaroverboeking deze maand */}
      {savingsGoal > 0 && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/30">
          <p className="text-[13px] font-bold text-emerald-400 mb-1">🏦 Spaaroverboeking deze maand</p>
          <p className="text-[12px] text-white/35 mb-2.5">{fmt(alreadySavedThisMonth)} overgeboekt van {fmt(savingsGoal)} doel</p>
          <ProgressBar pct={savingsGoal > 0 ? (alreadySavedThisMonth / savingsGoal) * 100 : 0} color="#34D399" />
          <div className="flex justify-between text-[11px] text-white/35 mt-1.5 mb-2.5">
            <span>Overgeboekt: {fmt(alreadySavedThisMonth)}</span>
            <span>Nog te gaan: {fmt(Math.max(0, savingsGoal - alreadySavedThisMonth))}</span>
          </div>
          {savingsContribs.length > 0 && (
            <div className="flex flex-col gap-1 mb-3">
              {savingsContribs.map(c => (
                <div key={c.id} className="flex items-center justify-between text-[12px] py-1.5 border-t border-emerald-400/10">
                  <span className="text-white/35">{c.date} · {c.description || 'Spaarstorting'}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 tabular-nums">{fmt(c.amount)}</span>
                    <button onClick={() => deleteRow(c.id)} className="bg-transparent border-none cursor-pointer text-red-400/50 p-0.5">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-white/30">€</span>
              <input type="text" inputMode="decimal" placeholder="Bedrag overgeboekt"
                value={savingsInput} onChange={e => setSavingsInput(e.target.value)} onFocus={scrollFix}
                className={`${glassInput} pr-2.5 py-2 text-[14px] border-emerald-400/30 pl-7`} />
            </div>
            <button onClick={addContribution}
              className="px-3.5 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-400 cursor-pointer text-[13px] font-bold whitespace-nowrap">
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {/* Opnames "echt gespaard" */}
      {savedWithdrawals.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-red-400/70 font-bold uppercase tracking-[0.07em] mb-2.5">💰 Echt gespaard — opnames</p>
          <div className="flex flex-col gap-1.5">
            {savedWithdrawals.map(exp => (
              <div key={exp.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-red-400/[0.05] border border-red-400/[0.15]">
                <div className="w-9 h-9 rounded-xl bg-red-400/10 flex items-center justify-center text-lg shrink-0">💰</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/85 m-0 truncate">{exp.description || 'Spaaropname'}</p>
                  <p className="text-[11px] text-white/30 m-0">{exp.date}</p>
                </div>
                <span className="text-[15px] font-bold text-red-400 shrink-0 tabular-nums">+{fmt(exp.amount)}</span>
                <button onClick={() => onEditSavings(exp)} className="bg-transparent border-none cursor-pointer text-white/25 p-1 shrink-0"><Pencil size={14} /></button>
                <button onClick={() => onDelete(exp.id)} className="bg-transparent border-none cursor-pointer text-red-400/50 p-1 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eenmalige inkomsten */}
      {manualIncome.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-white/35 font-bold uppercase tracking-[0.07em] mb-2.5">Eenmalig / extra</p>
          <div className="flex flex-col gap-1.5">
            {manualIncome.map(exp => (
              <TransactionRow key={exp.id} exp={exp} allCategories={allCategories} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {manualIncome.length === 0 && !hasRecurring && savingsWithdrawals.length === 0 && openLoans.length === 0 && (
        <EmptyState emoji="💚" title="Geen inkomsten" sub="Stel terugkerend inkomen in of voeg een eenmalige toe" />
      )}

      <button onClick={onAddIncome}
        className="w-full mt-2 py-3.5 rounded-2xl bg-emerald-400/10 border border-emerald-400/35 text-emerald-400 cursor-pointer text-[14px] font-bold flex items-center justify-center gap-2">
        <Plus size={16} /> Eenmalige inkomsten toevoegen
      </button>
    </Sheet>
  )
}
