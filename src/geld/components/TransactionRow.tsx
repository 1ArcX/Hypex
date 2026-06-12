import { Pencil, Trash2 } from 'lucide-react'
import type { CategoryConfig, Expense } from '../types'
import { findCategory, findIncomeCategory } from '../lib/categories'
import { fmt } from '../lib/format'

export function TransactionRow({ exp, allCategories, onEdit, onDelete }: {
  exp: Expense
  allCategories: CategoryConfig[]
  onEdit?: (exp: Expense) => void
  onDelete: (id: string) => void
}) {
  const isInc = !!exp.is_income
  const cat = isInc ? findIncomeCategory(exp.category) : findCategory(allCategories, exp.category)
  const color = isInc ? '#34D399' : ((cat as CategoryConfig).color || '#94A3B8')

  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border backdrop-blur-lg ${
      isInc ? 'bg-emerald-400/[0.06] border-emerald-400/15' : 'bg-white/[0.04] border-white/[0.07]'
    }`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: `${color}15` }}>{cat.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white/85 m-0 truncate">{exp.description || cat.label}</p>
        <p className="text-[11px] text-white/30 m-0">{exp.date}{isInc ? ' · inkomsten' : ''}</p>
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
  )
}
