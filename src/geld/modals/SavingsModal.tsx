import { useState } from 'react'
import { CenterModal } from '../components/ui/Sheet'
import { glassInput } from '../components/ui/Glass'
import { scrollFix } from '../hooks/useIosScroll'
import type { Expense, ExpenseInput } from '../types'
import { todayStr, fmt, parseAmount } from '../lib/format'
import { loanInterest } from '../lib/savings'

// Spaaropname loggen: "echt gespaard" of lening van jezelf (+10% rente)
export function SavingsModal({ onClose, onSave, editing }: {
  onClose: () => void
  onSave: (data: ExpenseInput) => void
  editing?: Expense | null
}) {
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : '')
  const [reason, setReason] = useState(editing?.description || '')
  const [savType, setSavType] = useState<'saved' | 'loan'>(editing?.savings_type === 'loan' ? 'loan' : 'saved')

  const n = parseAmount(amount)
  const canSave = n > 0 && reason.trim().length > 0
  const interest = savType === 'loan' && n > 0 ? loanInterest(n) : 0

  const handleSave = () => {
    if (!canSave) return
    onSave({ amount: n, category: 'overig', description: reason.trim(), date: editing?.date || todayStr(), is_savings_withdrawal: true, savings_type: savType })
  }

  return (
    <CenterModal onClose={onClose} borderClass="border-red-400/30">
      <div className="text-center mb-4">
        <div className="text-4xl mb-1.5">⚠️</div>
        <h3 className="text-[17px] font-bold text-red-400 m-0 mb-1">{editing ? 'Opname bewerken' : 'Spaargeld afhalen'}</h3>
        <p className="text-[12px] text-white/35 m-0">Wat voor soort opname is dit?</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setSavType('saved')}
          className={`px-2 py-3 rounded-2xl cursor-pointer text-center border ${
            savType === 'saved' ? 'border-emerald-400 border-2 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'
          }`}>
          <div className="text-[22px] mb-1">💰</div>
          <p className={`text-[12px] font-bold m-0 mb-0.5 ${savType === 'saved' ? 'text-emerald-400' : 'text-white/60'}`}>Echt gespaard</p>
          <p className="text-[10px] text-white/30 m-0">Geld dat ik had gespaard</p>
        </button>
        <button onClick={() => setSavType('loan')}
          className={`px-2 py-3 rounded-2xl cursor-pointer text-center border ${
            savType === 'loan' ? 'border-amber-400 border-2 bg-amber-400/10' : 'border-white/10 bg-white/[0.04]'
          }`}>
          <div className="text-[22px] mb-1">🤝</div>
          <p className={`text-[12px] font-bold m-0 mb-0.5 ${savType === 'loan' ? 'text-amber-400' : 'text-white/60'}`}>Lening</p>
          <p className="text-[10px] text-white/30 m-0">Leen van mezelf (+10%)</p>
        </button>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-bold text-white/30">€</span>
        <input autoFocus type="text" inputMode="decimal" placeholder="0,00"
          value={amount} onChange={e => setAmount(e.target.value)} onFocus={scrollFix}
          className={`${glassInput} pl-8 pr-3.5 py-3 text-2xl font-bold ${savType === 'loan' ? 'border-amber-400/40' : 'border-red-400/30'}`} />
      </div>

      {savType === 'loan' && n > 0 && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-amber-400/[0.07] border border-amber-400/25 mb-3 flex justify-between text-[12px]">
          <span className="text-white/35">Terug te storten incl. 10% rente</span>
          <span className="font-bold text-amber-400 tabular-nums">{fmt(n + interest)}</span>
        </div>
      )}

      <input placeholder="Waarom haal je dit af? (verplicht)" value={reason} onChange={e => setReason(e.target.value)}
        onFocus={scrollFix} className={`${glassInput} px-3.5 py-2.5 text-[14px] mb-4`} />

      <div className="flex gap-2.5">
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/[0.05] border border-white/10 text-white/60 cursor-pointer text-[14px]">
          Annuleer
        </button>
        <button onClick={handleSave} disabled={!canSave}
          className={`flex-1 py-3 rounded-2xl text-[14px] font-bold border ${
            !canSave ? 'bg-white/[0.04] border-white/10 text-white/25 cursor-default'
              : savType === 'loan' ? 'bg-amber-400/15 border-amber-400/50 text-amber-400 cursor-pointer'
              : 'bg-red-400/15 border-red-400/50 text-red-400 cursor-pointer'
          }`}>
          Loggen
        </button>
      </div>
    </CenterModal>
  )
}
