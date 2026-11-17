import { useState } from 'react'
import { Pencil, Trash2, Landmark } from 'lucide-react'
import { useGeldStore } from '../store/geldStore'
import { setExpenseCategory } from '../lib/quickCategory'
import { INCOME_CATEGORIES } from '../lib/categories'
import type { CategoryConfig, Expense } from '../types'
import { findCategory, findIncomeCategory } from '../lib/categories'
import { fmt, fmtDay } from '../lib/format'

export function TransactionRow({ exp, allCategories, onEdit, onDelete }: {
  exp: Expense
  allCategories: CategoryConfig[]
  onEdit?: (exp: Expense) => void
  onDelete: (id: string) => void
}) {
  const bankTxs = useGeldStore(s => s.bankByExpense[exp.id])
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const refresh = useGeldStore(s => s.refresh)
  const pickCategory = async (id: string) => {
    if (id === exp.category) { setCatOpen(false); return }
    setSaving(true)
    try { await setExpenseCategory(exp.id, id, bankTxs); refresh() } catch (e) { window.alert(`Categorie wijzigen lukte niet: ${e instanceof Error ? e.message : e}`) }
    setSaving(false); setCatOpen(false)
  }
  const isInc = !!exp.is_income
  const cat = isInc ? findIncomeCategory(exp.category) : findCategory(allCategories, exp.category)
  const color = isInc ? '#34D399' : ((cat as CategoryConfig).color || '#94A3B8')

  return (
    <div className={`rounded-2xl border backdrop-blur-lg ${
      isInc ? 'bg-emerald-400/[0.06] border-emerald-400/15' : 'bg-white/[0.04] border-white/[0.07]'
    }`}>
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      {/* Tik op het icoontje = categorie direct wijzigen */}
      <button type="button" onClick={() => setCatOpen(o => !o)} aria-label={`Categorie wijzigen (nu: ${cat.label})`} title="Categorie wijzigen"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, border: catOpen ? `1px solid color-mix(in srgb, ${color} 50%, transparent)` : '1px solid transparent', cursor: 'pointer', padding: 0, opacity: saving ? 0.5 : 1 }}>
        {cat.emoji}
      </button>
      <div className="flex-1 min-w-0" onClick={bankTxs?.length ? () => setOpen(o => !o) : undefined}
        style={bankTxs?.length ? { cursor: 'pointer' } : undefined}>
        <p className="text-[13px] font-semibold text-white/85 m-0 truncate">{exp.description || cat.label}</p>
        <p className="text-[11px] text-white/30 m-0 flex items-center gap-1">
          {fmtDay(exp.date)}{isInc ? ' · inkomsten' : ''}
          {bankTxs?.length ? <span className="inline-flex items-center gap-0.5" style={{ color: '#FF6200' }} title="Van ING — tik voor details">
            · <Landmark size={10} /> {bankTxs.length > 1 ? `${bankTxs.length} betalingen` : 'ING'}
          </span> : null}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[15px] font-bold tabular-nums" style={{ color }}>{isInc ? '+' : ''}{fmt(exp.amount)}</span>
        {exp.paid_from_savings && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-md px-1.5 py-px">
            GESPAARD
          </span>
        )}
      </div>
      {!isInc && onEdit && (
        <button onClick={() => onEdit(exp)} className="bg-transparent border-none cursor-pointer text-white/25 p-1">
          <Pencil size={12} />
        </button>
      )}
      <button onClick={() => onDelete(exp.id)} className="bg-transparent border-none cursor-pointer text-red-400/40 p-1">
        <Trash2 size={12} />
      </button>
    </div>
    {catOpen && (
      <div className="px-3.5 pb-2.5 flex gap-1.5 flex-wrap">
        {(isInc ? INCOME_CATEGORIES : allCategories).map(c => {
          const active = c.id === exp.category
          return (
            <button key={c.id} type="button" disabled={saving} onClick={() => pickCategory(c.id)}
              className="text-[11px] rounded-full px-2.5 py-1"
              style={{ cursor: 'pointer', border: `1px solid ${active ? 'var(--accent-border)' : 'var(--c-border)'}`, background: active ? 'var(--accent-soft)' : 'var(--c-surface-2)', color: active ? 'var(--accent)' : 'var(--c-text-2)', fontWeight: active ? 700 : 500 }}>
              {c.emoji} {c.label}
            </button>
          )
        })}
      </div>
    )}
    {/* ING-gegevens zoals op je afschrift */}
    {open && bankTxs?.length ? (
      <div className="px-3.5 pb-2.5 flex flex-col gap-1.5">
        {bankTxs.map(t => (
          <div key={t.id} className="rounded-xl px-3 py-2 text-[11px]" style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white/85 flex-1 min-w-0 truncate">{t.counterparty || 'Onbekend'}</span>
              <span className="tabular-nums font-semibold" style={{ color: t.amount > 0 ? '#34D399' : 'var(--c-text)' }}>{t.amount > 0 ? '+' : '−'}{fmt(Math.abs(t.amount))}</span>
            </div>
            {t.description && <p className="m-0 mt-0.5 text-white/55 break-words">{t.description}</p>}
            <p className="m-0 mt-0.5 text-white/35 tabular-nums">
              Boekdatum {fmtDay(t.booking_date)}{t.counterparty_iban ? ` · ${t.counterparty_iban.replace(/(.{4})/g, '$1 ').trim()}` : ''}{t.account_name ? ` · ${t.account_name}` : ''}
            </p>
          </div>
        ))}
      </div>
    ) : null}
    </div>
  )
}
