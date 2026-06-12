import { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { glassInput } from '../components/ui/Glass'
import { scrollFix } from '../hooks/useIosScroll'
import type { CategoryConfig, Expense, ExpenseInput } from '../types'
import { todayStr, parseAmount } from '../lib/format'

// Uitgave loggen/bewerken — ook geplande uitgaven (plannedMode) en het
// bevestigen van een geplande uitgave als echte uitgave
export function ExpenseModal({ onClose, onSave, editing, categories, defaultDate, plannedMode }: {
  onClose: () => void
  onSave: (data: ExpenseInput) => void
  editing?: Expense | null
  categories: CategoryConfig[]
  defaultDate?: string
  plannedMode?: boolean
}) {
  const isPlanned = plannedMode || editing?.is_planned
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : '')
  const [cat, setCat] = useState(editing?.category || 'eten')
  const [desc, setDesc] = useState(editing?.description || '')
  const [date, setDate] = useState(editing?.date || defaultDate || todayStr())
  const [paidFromSavings, setPFS] = useState(editing?.paid_from_savings || false)

  const handleSave = () => {
    const n = parseAmount(amount)
    if (isPlanned) {
      if (!desc.trim()) return
      onSave({ amount: n || 0, category: cat, description: desc.trim(), date, is_savings_withdrawal: false, paid_from_savings: false, is_planned: !editing?.is_planned ? true : false })
      return
    }
    if (!n || n <= 0) return
    onSave({ amount: n, category: cat, description: desc.trim(), date, is_savings_withdrawal: false, paid_from_savings: paidFromSavings, is_planned: false })
  }

  return (
    <Sheet onClose={onClose}
      title={isPlanned ? '📌 Geplande uitgave' : editing ? 'Bewerken' : 'Uitgave toevoegen'}
      accentColor={isPlanned ? '#FBBF24' : undefined}>

      {/* Bedrag — optioneel bij gepland */}
      <div className="relative mb-4">
        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold ${isPlanned ? 'text-amber-400/50' : 'text-white/30'}`}>€</span>
        <input
          autoFocus={!isPlanned} type="text" inputMode="decimal"
          placeholder={isPlanned ? '0,00 (optioneel)' : '0,00'}
          value={amount} onChange={e => setAmount(e.target.value)}
          onFocus={scrollFix}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={`${glassInput} pl-9 pr-4 py-3.5 text-[28px] font-bold ${isPlanned ? 'border-amber-400/30' : ''}`}
        />
      </div>

      {/* Categorie */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {categories.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className="px-1 py-2.5 rounded-xl cursor-pointer flex flex-col items-center gap-1 border transition-colors"
            style={cat === c.id
              ? { borderColor: c.color, background: `${c.color}15` }
              : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xl">{c.emoji}</span>
            <span className={`text-[9px] ${cat === c.id ? 'font-semibold' : ''}`}
              style={{ color: cat === c.id ? c.color : 'rgba(255,255,255,0.35)' }}>{c.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Omschrijving — verplicht bij gepland */}
      <input
        autoFocus={isPlanned}
        placeholder={isPlanned ? 'Omschrijving (verplicht)' : 'Omschrijving (optioneel)'}
        value={desc} onChange={e => setDesc(e.target.value)}
        onFocus={scrollFix}
        className={`${glassInput} px-3.5 py-2.5 text-[14px] mb-3 ${isPlanned && !desc.trim() ? 'border-amber-400/40' : ''}`}
      />

      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className={`${glassInput} px-3.5 py-2.5 text-[13px] text-white/50 mb-4`} />

      {/* Betaald van spaarrekening — niet bij gepland */}
      {!isPlanned && (
        <div onClick={() => setPFS(p => !p)}
          className={`flex items-center justify-between px-3.5 py-3 rounded-2xl border mb-4 cursor-pointer ${
            paidFromSavings ? 'bg-amber-400/[0.07] border-amber-400/35' : 'bg-white/[0.03] border-white/[0.08]'
          }`}>
          <div>
            <p className={`text-[13px] font-semibold m-0 ${paidFromSavings ? 'text-amber-400' : 'text-white/40'}`}>🏦 Betaald van spaarrekening</p>
            <p className="text-[11px] text-white/30 m-0">Voor noodzakelijke uitgaven buiten budget</p>
          </div>
          <div className={`w-10 h-[22px] rounded-full relative shrink-0 transition-colors ${paidFromSavings ? 'bg-amber-400/50' : 'bg-white/10'}`}>
            <div className={`absolute w-[18px] h-[18px] rounded-full top-0.5 transition-all ${paidFromSavings ? 'left-5 bg-amber-400' : 'left-0.5 bg-white/35'}`} />
          </div>
        </div>
      )}

      <button onClick={handleSave}
        disabled={!!isPlanned && !desc.trim()}
        className={`w-full py-3.5 rounded-2xl border-none text-[15px] font-bold cursor-pointer ${
          isPlanned
            ? desc.trim() ? 'bg-amber-400 text-black' : 'bg-amber-400/20 text-black/50 cursor-default'
            : 'bg-teal-300 text-black shadow-[0_0_20px_rgba(94,234,212,0.3)]'
        }`}>
        {editing?.is_planned ? '✓ Bevestig als echte uitgave' : isPlanned ? '📌 Vastpinnen' : editing ? 'Opslaan' : '+ Toevoegen'}
      </button>
    </Sheet>
  )
}
