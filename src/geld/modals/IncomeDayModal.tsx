import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { CenterModal } from '../components/ui/Sheet'
import { glassInput } from '../components/ui/Glass'
import { scrollFix } from '../hooks/useIosScroll'
import type { RecurringSource } from '../types'
import { INCOME_CATEGORIES } from '../lib/categories'
import { fmt, todayStr, parseAmount } from '../lib/format'
import { calcSavingsAdvice } from '../lib/savings'

// Betaaldag-modal (en handmatige eenmalige inkomsten via source=null):
// inkomen loggen + adviesverdeling naar spaarrekening en leningaflossing.
// Schrijft zelf naar Supabase (meerdere inserts in één actie).
export function IncomeDayModal({ source, defaultDate, adjustedBase, savingsGoal, alreadySavedThisMonth, totalLoanRemaining, userId, onLater, onDone }: {
  source: RecurringSource | null
  defaultDate?: string
  adjustedBase: number // min. saldo dat op de hoofdrekening blijft
  savingsGoal: number
  alreadySavedThisMonth: number
  totalLoanRemaining: number
  userId: string
  onLater: () => void
  onDone: () => void
}) {
  const [received, setReceived] = useState('')
  const [balance, setBalance] = useState('')
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState('salaris')
  const [date, setDate] = useState(defaultDate || todayStr())
  const [saving, setSaving] = useState(false)
  const isManual = !source

  const rec = parseAmount(received)
  const bal = parseAmount(balance)
  const hasBal = balance.trim().length > 0
  const { savNeeded, toSavings, toLoan, balAfter } = calcSavingsAdvice({
    balance: bal, hasBalance: hasBal, adjustedBase, savingsGoal, alreadySavedThisMonth, totalLoanRemaining,
  })

  const canSave = rec > 0 && (!isManual || desc.trim().length > 0)

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const incomeDesc = isManual ? desc.trim() : source!.name
      const incomeCat = isManual ? catId : (source!.category || 'salaris')
      const inserts = [
        supabase.from('expenses').insert({ user_id: userId, amount: rec, category: incomeCat, description: incomeDesc, date, is_income: true, is_savings_withdrawal: false }),
      ]
      if (toSavings > 0) inserts.push(supabase.from('expenses').insert({ user_id: userId, amount: toSavings, category: 'overig', description: '🏦 Spaarstorting', date, is_savings_contribution: true, is_income: false, is_savings_withdrawal: false }))
      if (toLoan > 0) inserts.push(supabase.from('expenses').insert({ user_id: userId, amount: toLoan, category: 'overig', description: '↩ Gedeeltelijke terugbetaling lening', date, is_loan_repayment: true, is_income: false, is_savings_withdrawal: false }))
      await Promise.all(inserts)
      // Markeer leningen als afgelost als het totaal nu gedekt is
      if (toLoan > 0 && toLoan >= totalLoanRemaining) {
        const { data: openLoanRows } = await supabase.from('expenses').select('id').eq('user_id', userId).eq('savings_type', 'loan').eq('repaid', false)
        if (openLoanRows?.length) await Promise.all(openLoanRows.map(l => supabase.from('expenses').update({ repaid: true }).eq('id', l.id)))
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CenterModal onClose={isManual ? onLater : undefined} borderClass="border-emerald-400/30">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[28px] mb-1">{isManual ? '💚' : source!.emoji}</div>
          <h3 className="text-[17px] font-bold text-emerald-400 m-0 mb-0.5">
            {isManual ? 'Eenmalige inkomsten' : `Betaaldag: ${source!.name}`}
          </h3>
          <p className="text-[12px] text-white/35 m-0">Vul in wat je hebt ontvangen</p>
        </div>
        {isManual && (
          <button onClick={onLater} className="bg-transparent border-none cursor-pointer text-white/30 p-1"><X size={18} /></button>
        )}
      </div>

      {isManual && (
        <div className="mb-3">
          <input type="text" placeholder="Beschrijving (bijv. Bijbaan)" value={desc} onChange={e => setDesc(e.target.value)}
            onFocus={scrollFix} className={`${glassInput} px-3.5 py-2.5 text-[14px] mb-2`} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className={`${glassInput} px-3.5 py-2.5 text-[13px] text-white/50 mb-2`} />
          <div className="flex gap-1.5 flex-wrap">
            {INCOME_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCatId(c.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border ${
                  catId === c.id ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-400' : 'bg-white/[0.04] border-white/10 text-white/35'
                }`}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-bold text-emerald-400">€</span>
        <input autoFocus={!isManual} type="text" inputMode="decimal" placeholder="0,00"
          value={received} onChange={e => setReceived(e.target.value)} onFocus={scrollFix}
          className={`${glassInput} pl-8 pr-3.5 py-3 text-2xl font-bold border-emerald-400/40`} />
      </div>

      <div className="mb-3.5">
        <label className="text-[11px] font-semibold text-white/35 block mb-1.5">Huidig saldo hoofdrekening (optioneel)</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-white/30">€</span>
          <input type="text" inputMode="decimal" placeholder="0,00" value={balance}
            onChange={e => setBalance(e.target.value)} onFocus={scrollFix}
            className={`${glassInput} pl-8 pr-3.5 py-2.5 text-[16px]`} />
        </div>
      </div>

      {(rec > 0 || hasBal) && (toSavings > 0 || toLoan > 0 || hasBal) && (
        <div className="px-3.5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-3.5 flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-white/35 uppercase tracking-wide m-0 mb-1">Advies verdeling</p>
          {toSavings > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-white/35">💰 Naar spaarrekening {savNeeded > toSavings ? `(${fmt(savNeeded - toSavings)} resterend doel)` : '✓'}</span>
              <span className="font-bold text-emerald-400 tabular-nums">{fmt(toSavings)}</span>
            </div>
          )}
          {toLoan > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-white/35">↩ Lening aflossen</span>
              <span className="font-bold text-amber-400 tabular-nums">{fmt(toLoan)}</span>
            </div>
          )}
          {hasBal && balAfter !== null && (
            <div className="flex justify-between text-[12px] border-t border-white/[0.08] pt-1.5 mt-0.5">
              <span className="text-white/35">Hoofdrekening na overschrijvingen</span>
              <span className={`font-bold tabular-nums ${balAfter >= adjustedBase ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(balAfter)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2.5">
        {!isManual && (
          <button onClick={onLater} className="flex-1 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white/60 cursor-pointer text-[14px]">
            Later
          </button>
        )}
        <button onClick={handleSave} disabled={!canSave || saving}
          className={`flex-[2] py-3 rounded-2xl border-none text-[14px] font-bold ${
            canSave ? 'bg-emerald-400 text-black cursor-pointer' : 'bg-white/[0.04] text-white/25 cursor-default'
          }`}>
          {saving ? '...' : 'Invullen'}
        </button>
      </div>
    </CenterModal>
  )
}
