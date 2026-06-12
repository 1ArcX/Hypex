import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { CenterModal } from '../components/ui/Sheet'
import { glassInput } from '../components/ui/Glass'
import { scrollFix } from '../hooks/useIosScroll'
import type { BudgetConfig, BudgetConfigInput, CategoryConfig } from '../types'
import { CATEGORIES, CAT_COLORS, CAT_EMOJIS, DEFAULT_CAT_BUDGETS } from '../lib/categories'
import { fmtShort, parseAmount } from '../lib/format'

const label = 'text-[11px] font-semibold uppercase tracking-[0.07em] block mb-2'

// Budget-instellingen: maandbudget, spaardoel, min. saldo, spreiding,
// vakantiemodus en enveloppen (incl. eigen categorieën)
export function BudgetModal({ config, onClose, onSave }: {
  config: BudgetConfig | null
  onClose: () => void
  onSave: (data: BudgetConfigInput) => void
}) {
  const [monthly, setMonthly] = useState(config?.monthly_budget || 400)
  const [cats, setCats] = useState<Record<string, number>>(config?.category_budgets || DEFAULT_CAT_BUDGETS)
  const [customCats, setCustomCats] = useState<CategoryConfig[]>(config?.custom_categories || [])
  const [savingsGoal, setSavingsGoal] = useState(config?.savings_goal || 0)
  const [minBalance, setMinBalance] = useState(config?.min_balance ?? 300)
  const [recoveryMonths, setRecoveryMonths] = useState(config?.recovery_months || 3)
  const [vacMode, setVacMode] = useState(config?.vacation_mode || false)
  const [vacBudget, setVacBudget] = useState<number | ''>(config?.vacation_budget || '')
  const [vacStart, setVacStart] = useState(config?.vacation_start || '')
  const [vacEnd, setVacEnd] = useState(config?.vacation_end || '')
  const [addingCat, setAddingCat] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🎮')
  const [newColor, setNewColor] = useState(CAT_COLORS[0])
  const [newBudget, setNewBudget] = useState('')

  const resetCatForm = () => { setNewName(''); setNewEmoji('🎮'); setNewColor(CAT_COLORS[0]); setNewBudget('') }

  const addCustomCat = () => {
    if (!newName.trim()) return
    const id = `cat_${Date.now()}`
    setCustomCats(cs => [...cs, { id, label: newName.trim(), emoji: newEmoji, color: newColor }])
    setCats(c => ({ ...c, [id]: parseAmount(newBudget) }))
    resetCatForm(); setAddingCat(false)
  }

  const deleteCustomCat = (id: string) => {
    setCustomCats(cs => cs.filter(c => c.id !== id))
    setCats(c => { const n = { ...c }; delete n[id]; return n })
  }

  const total = Object.values(cats).reduce((a, b) => a + Number(b), 0)
  const vacDays = vacStart && vacEnd && new Date(vacEnd) > new Date(vacStart)
    ? Math.round((new Date(vacEnd).getTime() - new Date(vacStart).getTime()) / 86400000) : 0

  const euroInput = (value: number, onChange: (n: number) => void, colorCls: string) => (
    <div className="relative">
      <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-lg ${colorCls}`}>€</span>
      <input type="number" value={value} onChange={e => onChange(+e.target.value)} onFocus={scrollFix}
        className={`${glassInput} pl-8 pr-3.5 py-3 text-xl font-bold`} />
    </div>
  )

  return (
    <CenterModal onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[16px] font-bold text-white/90 m-0">Budget instellen</h3>
        <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-white/35"><X size={18} /></button>
      </div>

      <div className="mb-4">
        <label className={`${label} text-white/35`}>Maandbudget (fallback)</label>
        {euroInput(monthly, setMonthly, 'text-white/30')}
        <p className="text-[11px] text-white/30 mt-1.5">Wordt gebruikt als je geen terugkerend inkomen hebt ingesteld.</p>
      </div>

      <div className="mb-4 p-4 rounded-2xl bg-emerald-400/[0.05] border border-emerald-400/20">
        <label className={`${label} text-emerald-400`}>🏦 Spaardoel per maand</label>
        {euroInput(savingsGoal, setSavingsGoal, 'text-emerald-400')}
        <p className="text-[11px] text-emerald-400/60 mt-1.5">Dit bedrag wordt automatisch van je inkomen afgetrokken. Beschikbaar = inkomen − spaardoel.</p>
      </div>

      <div className="mb-4 p-4 rounded-2xl bg-blue-400/[0.05] border border-blue-400/20">
        <label className={`${label} text-blue-400`}>💳 Minimum saldo hoofdrekening</label>
        {euroInput(minBalance, setMinBalance, 'text-blue-400')}
        <p className="text-[11px] text-blue-400/60 mt-1.5">Hoeveel je minimaal op je hoofdrekening wil houden na overschrijvingen.</p>
      </div>

      <div className="mb-4 p-4 rounded-2xl bg-red-400/[0.05] border border-red-400/20">
        <label className={`${label} text-red-400`}>↩ Overschrijding spreiden over</label>
        <div className="flex gap-1.5">
          {[2, 3, 4, 6].map(n => (
            <button key={n} onClick={() => setRecoveryMonths(n)}
              className={`flex-1 py-2.5 rounded-xl text-[13px] cursor-pointer border ${
                recoveryMonths === n ? 'bg-red-400/[0.15] border-red-400/50 text-red-400 font-bold' : 'bg-white/[0.04] border-white/10 text-white/60'
              }`}>
              {n} mnd
            </button>
          ))}
        </div>
        <p className="text-[11px] text-red-400/60 mt-2">Bij overschrijding trekt het systeem elke maand een deel af — verdeeld over dit aantal maanden.</p>
      </div>

      {/* Vakantiemodus */}
      <div onClick={() => setVacMode(v => !v)}
        className={`mb-4 p-4 rounded-2xl cursor-pointer border ${vacMode ? 'bg-cyan-400/[0.07] border-cyan-400/40' : 'bg-white/[0.03] border-white/[0.08]'}`}>
        <div className={`flex items-center justify-between ${vacMode ? 'mb-3' : ''}`}>
          <div>
            <p className={`text-[13px] font-bold m-0 ${vacMode ? 'text-cyan-400' : 'text-white/60'}`}>✈️ Vakantiemodus</p>
            <p className="text-[11px] text-white/30 m-0">Tijdelijk apart vakantiebudget instellen</p>
          </div>
          <div className={`w-10 h-[22px] rounded-full relative shrink-0 transition-colors ${vacMode ? 'bg-cyan-400/50' : 'bg-white/10'}`}>
            <div className={`absolute w-[18px] h-[18px] rounded-full top-0.5 transition-all ${vacMode ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/35'}`} />
          </div>
        </div>
        {vacMode && (
          <div onClick={e => e.stopPropagation()}>
            <div className="relative mb-2.5">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-cyan-400">€</span>
              <input type="number" placeholder="Vakantiebudget" value={vacBudget}
                onChange={e => setVacBudget(+e.target.value)} onFocus={scrollFix}
                className={`${glassInput} pl-8 pr-3.5 py-3 text-xl font-bold border-cyan-400/35`} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-1.5">
              <div>
                <label className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-wide block mb-1">Vertrekdatum</label>
                <input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)}
                  className={`${glassInput} px-3 py-2 text-[13px] border-cyan-400/30`} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-wide block mb-1">Thuiskomst</label>
                <input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)}
                  className={`${glassInput} px-3 py-2 text-[13px] border-cyan-400/30`} />
              </div>
            </div>
            {vacDays > 0 && (
              <p className="text-[11px] text-cyan-400/60 mt-1">
                {vacDays} dagen · dagbudget {Number(vacBudget) > 0 ? `€${(Number(vacBudget) / vacDays).toFixed(0)}/dag` : '–'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Enveloppen per categorie */}
      <label className={`${label} text-white/35 mb-2.5`}>Per categorie</label>
      <div className="flex flex-col gap-2.5 mb-5">
        {CATEGORIES.map(c => (
          <CatBudgetRow key={c.id} cat={c} value={cats[c.id] || 0}
            onChange={n => setCats(p => ({ ...p, [c.id]: n }))} />
        ))}
      </div>

      <label className={`${label} text-white/35 mb-2.5`}>Eigen enveloppen</label>
      {customCats.length > 0 && (
        <div className="flex flex-col gap-2 mb-2.5">
          {customCats.map(c => (
            <CatBudgetRow key={c.id} cat={c} value={cats[c.id] || 0}
              onChange={n => setCats(p => ({ ...p, [c.id]: n }))}
              onDelete={() => deleteCustomCat(c.id)} />
          ))}
        </div>
      )}

      {addingCat ? (
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-3">
          <input placeholder="Naam (bijv. Hobby, Huisdier)" value={newName} onChange={e => setNewName(e.target.value)}
            onFocus={scrollFix} autoFocus className={`${glassInput} px-3 py-2 text-[14px] mb-2.5`} />
          <p className="text-[11px] text-white/35 font-semibold mb-1.5">Emoji</p>
          <div className="flex flex-wrap gap-1 mb-2.5">
            {CAT_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewEmoji(e)}
                className={`text-lg w-8 h-8 rounded-lg cursor-pointer border ${newEmoji === e ? 'border-teal-300 border-2 bg-teal-300/[0.08]' : 'border-white/10 bg-white/[0.04]'}`}>{e}</button>
            ))}
          </div>
          <p className="text-[11px] text-white/35 font-semibold mb-1.5">Kleur</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CAT_COLORS.map(col => (
              <button key={col} onClick={() => setNewColor(col)}
                className={`w-6 h-6 rounded-md cursor-pointer border-2 ${newColor === col ? 'border-white' : 'border-transparent'}`}
                style={{ background: col }} />
            ))}
          </div>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-[13px] text-white/35">Budget:</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-white/30">€</span>
              <input type="text" inputMode="decimal" placeholder="0" value={newBudget}
                onChange={e => setNewBudget(e.target.value)} onFocus={scrollFix}
                className={`${glassInput} pl-6 pr-2 py-2 text-[14px] font-semibold`} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAddingCat(false); resetCatForm() }}
              className="flex-1 py-2 rounded-xl bg-transparent border border-white/10 text-white/35 cursor-pointer text-[13px]">Annuleer</button>
            <button onClick={addCustomCat} disabled={!newName.trim()}
              className={`flex-[2] py-2 rounded-xl border-none font-bold text-[13px] ${newName.trim() ? 'bg-teal-300 text-black cursor-pointer' : 'bg-white/[0.06] text-white/25 cursor-default'}`}>
              Aanmaken
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)}
          className="w-full py-2.5 rounded-2xl bg-white/[0.03] border border-dashed border-white/15 text-white/35 cursor-pointer text-[13px] mb-4 flex items-center justify-center gap-1.5">
          <Plus size={14} /> Envelop toevoegen
        </button>
      )}

      <div className={`px-3.5 py-2.5 rounded-2xl mb-4 border ${total > monthly ? 'bg-red-400/[0.07] border-red-400/30' : 'bg-teal-300/[0.05] border-teal-300/20'}`}>
        <span className={`text-[13px] ${total > monthly ? 'text-red-400' : 'text-teal-300'}`}>
          {total > monthly ? `⚠️ Categorieën (${fmtShort(total)}) overschrijden maandbudget` : `✓ Categorieën: ${fmtShort(total)} van ${fmtShort(monthly)}`}
        </span>
      </div>

      <button
        onClick={() => onSave({
          monthly_budget: monthly, category_budgets: cats, custom_categories: customCats,
          savings_goal: savingsGoal, min_balance: minBalance, recovery_months: recoveryMonths,
          vacation_mode: vacMode, vacation_budget: vacMode ? (Number(vacBudget) || 0) : 0,
          vacation_start: vacMode ? vacStart : null, vacation_end: vacMode ? vacEnd : null,
        })}
        className="w-full py-3.5 rounded-2xl bg-teal-300 border-none text-black text-[15px] font-bold cursor-pointer shadow-[0_0_20px_rgba(94,234,212,0.3)]">
        Opslaan
      </button>
    </CenterModal>
  )
}

function CatBudgetRow({ cat, value, onChange, onDelete }: {
  cat: CategoryConfig
  value: number
  onChange: (n: number) => void
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-7">{cat.emoji}</span>
      <span className="flex-1 text-[13px] text-white/60">{cat.label}</span>
      <div className="relative w-[90px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-white/30">€</span>
        <input type="number" value={value} onChange={e => onChange(+e.target.value)} onFocus={scrollFix}
          className="w-full pl-[22px] pr-2 py-2 rounded-xl bg-white/[0.05] text-[14px] font-semibold outline-none [color-scheme:dark] border"
          style={{ borderColor: `${cat.color}40`, color: cat.color }} />
      </div>
      {onDelete && (
        <button onClick={onDelete} className="bg-transparent border-none cursor-pointer text-red-400/50 p-1">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
