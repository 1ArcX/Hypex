import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { CenterModal } from '../components/ui/Sheet'
import { glassInput } from '../components/ui/Glass'
import { scrollFix } from '../hooks/useIosScroll'
import type { BudgetConfig, RecurringSource } from '../types'
import { REC_EMOJIS } from '../lib/categories'
import { getNextPayDate } from '../lib/recurring'
import { todayStr, parseAmount } from '../lib/format'

// Terugkerend inkomen beheren: maandelijks (dag X) of elke N dagen vanaf
// een referentiedatum. Opslaan gebeurt bij sluiten.
export function RecurringIncomeModal({ config, onClose, onSave }: {
  config: BudgetConfig | null
  onClose: () => void
  onSave: (sources: RecurringSource[]) => void
}) {
  const [sources, setSources] = useState<RecurringSource[]>(config?.recurring_income || [])
  const [adding, setAdding] = useState((config?.recurring_income || []).length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('💼')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'monthly' | 'interval'>('monthly')
  const [day, setDay] = useState<number | string>(1)
  const [intDays, setIntDays] = useState(28)
  const [refDate, setRefDate] = useState(todayStr())

  const resetForm = () => { setName(''); setEmoji('💼'); setAmount(''); setType('monthly'); setDay(1); setIntDays(28); setRefDate(todayStr()) }

  const startEdit = (src: RecurringSource) => {
    setEditingId(src.id)
    setName(src.name); setEmoji(src.emoji); setAmount(String(src.amount))
    setType(src.type); setDay(src.day || 1); setIntDays(src.interval_days || 28); setRefDate(src.ref_date || todayStr())
    setAdding(false)
  }

  const buildFields = () => ({
    name: name.trim(), emoji, amount: parseAmount(amount), type,
    ...(type === 'monthly' ? { day: Number(day) } : { interval_days: Number(intDays), ref_date: refDate }),
  })

  const handleAdd = () => {
    const n = parseAmount(amount)
    if (!name.trim() || !n || n <= 0) return
    setSources(s => [...s, { id: `rec_${Date.now()}`, ...buildFields() }])
    resetForm(); setAdding(false)
  }

  const handleSaveEdit = () => {
    const n = parseAmount(amount)
    if (!name.trim() || !n || n <= 0) return
    setSources(s => s.map(src => src.id === editingId ? { ...src, ...buildFields() } : src))
    resetForm(); setEditingId(null)
  }

  const handleClose = () => { onSave(sources); onClose() }

  const freqFields = (
    <>
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        {([['monthly', 'Maandelijks'], ['interval', 'Elke X weken']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setType(v)}
            className={`py-2 rounded-xl text-[12px] cursor-pointer border ${
              type === v ? 'border-emerald-400 text-emerald-400 bg-emerald-400/[0.08] font-semibold' : 'border-white/10 text-white/35 bg-white/[0.03]'
            }`}>{l}</button>
        ))}
      </div>
      {type === 'monthly' && (
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="text-[13px] text-white/35">Dag van de maand:</span>
          <input type="number" min={1} max={31} value={day} onChange={e => setDay(e.target.value)}
            className={`${glassInput} !w-[60px] px-2.5 py-1.5 text-[15px] font-bold text-center`} />
        </div>
      )}
      {type === 'interval' && (
        <div className="flex flex-col gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-white/35">Elke</span>
            <select value={intDays} onChange={e => setIntDays(+e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white/80 text-[13px] [color-scheme:dark]">
              <option value={7}>1 week</option><option value={14}>2 weken</option>
              <option value={21}>3 weken</option><option value={28}>4 weken</option>
            </select>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-white/35 whitespace-nowrap">Laatste betaling:</span>
            <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
              className={`${glassInput} flex-1 px-2.5 py-1.5 text-[13px]`} />
          </div>
          <p className="text-[11px] text-white/30 m-0">Vul de datum van de meest recente betaling in — de volgende wordt automatisch berekend.</p>
        </div>
      )}
    </>
  )

  const emojiPicker = (active: string) => (
    <div className="flex flex-wrap gap-1.5 mb-2.5">
      {REC_EMOJIS.map(e => (
        <button key={e} onClick={() => setEmoji(e)}
          className={`text-lg w-8 h-8 rounded-lg cursor-pointer border ${active === e ? 'border-emerald-400 border-2 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}>{e}</button>
      ))}
    </div>
  )

  return (
    <CenterModal onClose={handleClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[16px] font-bold text-white/90 m-0">Terugkerend inkomen</h3>
        <button onClick={handleClose} className="bg-transparent border-none cursor-pointer text-white/35"><X size={18} /></button>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-col gap-2 mb-3.5">
          {sources.map(src => {
            const next = getNextPayDate(src)
            if (editingId === src.id) return (
              <div key={src.id} className="p-3.5 rounded-2xl bg-emerald-400/[0.05] border border-emerald-400/30">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide mb-2.5">✏ {src.name} bewerken</p>
                {emojiPicker(emoji)}
                <input placeholder="Naam" value={name} onChange={e => setName(e.target.value)} onFocus={scrollFix}
                  className={`${glassInput} px-3 py-2 text-[14px] mb-2`} />
                <div className="relative mb-2.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-emerald-400">€</span>
                  <input type="text" inputMode="decimal" placeholder="Bedrag" value={amount}
                    onChange={e => setAmount(e.target.value)} onFocus={scrollFix} autoFocus
                    className={`${glassInput} pl-7 pr-3 py-2.5 text-xl font-bold text-emerald-400 border-emerald-400/35`} />
                </div>
                {freqFields}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(null); resetForm() }}
                    className="flex-1 py-2.5 rounded-xl bg-transparent border border-white/10 text-white/35 cursor-pointer text-[13px]">Annuleer</button>
                  <button onClick={handleSaveEdit}
                    className="flex-[2] py-2.5 rounded-xl bg-emerald-400 border-none text-black font-bold text-[14px] cursor-pointer">Opslaan</button>
                </div>
              </div>
            )
            return (
              <div key={src.id} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-emerald-400/[0.05] border border-emerald-400/20">
                <span className="text-[22px]">{src.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/85 m-0">{src.name}</p>
                  <p className="text-[11px] text-white/30 m-0">
                    {src.type === 'monthly' ? `${src.day}e van de maand` : `Elke ${src.interval_days} dagen`}
                    {next ? ` · volgende: ${next}` : ''}
                  </p>
                </div>
                <span className="text-[14px] font-bold text-emerald-400 mr-0.5 tabular-nums">€{Number(src.amount).toFixed(0)}</span>
                <button onClick={() => startEdit(src)} className="bg-transparent border-none cursor-pointer text-emerald-400/60 p-1"><Pencil size={13} /></button>
                <button onClick={() => setSources(s => s.filter(x => x.id !== src.id))}
                  className="bg-transparent border-none cursor-pointer text-red-400/50 p-1"><Trash2 size={13} /></button>
              </div>
            )
          })}
        </div>
      )}

      {adding ? (
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-3">
          {emojiPicker(emoji)}
          <input placeholder="Naam (bijv. Jumbo, Zorgtoeslag)" value={name} onChange={e => setName(e.target.value)}
            onFocus={scrollFix} autoFocus className={`${glassInput} px-3.5 py-2.5 text-[14px] mb-2.5`} />
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-white/30">€</span>
            <input type="text" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={e => setAmount(e.target.value)} onFocus={scrollFix}
              className={`${glassInput} pl-7 pr-3.5 py-2.5 text-xl font-bold`} />
          </div>
          {freqFields}
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); resetForm() }}
              className="flex-1 py-2.5 rounded-xl bg-transparent border border-white/10 text-white/35 cursor-pointer text-[13px]">Annuleer</button>
            <button onClick={handleAdd} disabled={!name.trim() || !amount}
              className={`flex-[2] py-2.5 rounded-xl border-none font-bold text-[14px] ${
                (!name.trim() || !amount) ? 'bg-white/[0.06] text-white/25 cursor-default' : 'bg-emerald-400 text-black cursor-pointer'
              }`}>Toevoegen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full mb-3 py-3 rounded-2xl bg-emerald-400/[0.07] border border-emerald-400/25 text-emerald-400 cursor-pointer text-[14px] font-semibold flex items-center justify-center gap-2">
          <Plus size={15} /> Bron toevoegen
        </button>
      )}

      <button onClick={handleClose}
        className="w-full py-3 rounded-2xl bg-teal-300 border-none text-black text-[15px] font-bold cursor-pointer">
        Opslaan
      </button>
    </CenterModal>
  )
}
