import { useState } from 'react'
import { Check, X, Undo2 } from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { fmt, fmtDay } from '../lib/format'
import { INCOME_CATEGORIES } from '../lib/categories'
import type { CategoryConfig } from '../types'
import type { BankState, BankTx } from '../hooks/useBank'

// Inbox met nieuwe banktransacties (ING): per transactie het voorstel (soort + categorie), aanpasbaar,
// dan Toevoegen (wordt een uitgave/inkomen/spaaractie) of Negeren. Een andere categorie kiezen = onthouden
// voor die tegenpartij. "Al ingevoerd" = dezelfde uitgave stond er al (zelfde bedrag, ±2 dagen).

const KINDS = [
  { id: 'uitgave', label: 'Uitgave' }, { id: 'inkomen', label: 'Inkomen' },
  { id: 'spaarstorting', label: 'Naar spaar' }, { id: 'spaaropname', label: 'Van spaar' },
]

export function BankInboxSheet({ bank, categories, onClose }: { bank: BankState; categories: CategoryConfig[]; onClose: () => void }) {
  const [choice, setChoice] = useState<Record<string, { kind?: string; category?: string }>>({})
  const pick = (tx: BankTx) => ({ kind: choice[tx.id]?.kind || tx.suggested_kind || (tx.amount > 0 ? 'inkomen' : 'uitgave'), category: choice[tx.id]?.category || tx.suggested_category || 'overig' })
  const set = (id: string, patch: { kind?: string; category?: string }) => setChoice(c => ({ ...c, [id]: { ...c[id], ...patch } }))

  const addAll = async () => {
    for (const tx of bank.inbox) {
      const p = pick(tx)
      await bank.add(tx, choice[tx.id]?.category ? p.category : undefined, p.kind)
    }
  }

  return (
    <Sheet onClose={onClose} title={`Banktransacties${bank.inbox.length ? ` (${bank.inbox.length})` : ''}`}>
      {bank.inbox.length === 0 && <p className="text-[13px] text-white/50 m-0 mb-4">Alles verwerkt. Nieuwe transacties verschijnen hier na het bijwerken.</p>}

      {bank.inbox.length > 1 && (
        <button type="button" onClick={addAll} disabled={bank.busy} className="btn-ghost w-full mb-3" style={{ padding: '8px 12px', fontSize: 12 }}>
          Alles met voorstel toevoegen
        </button>
      )}

      <div className="flex flex-col gap-2.5">
        {bank.inbox.map(tx => {
          const p = pick(tx)
          const cats = p.kind === 'inkomen' ? INCOME_CATEGORIES.map(c => ({ id: c.id, label: c.label, emoji: c.emoji })) : categories
          const showCats = p.kind === 'uitgave' || p.kind === 'inkomen'
          return (
            <div key={tx.id} className="rounded-2xl p-3" style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-white/90 truncate">{tx.counterparty || tx.description || 'Onbekend'}</p>
                  <p className="m-0 text-[11px] text-white/40 truncate">{fmtDay(tx.booking_date)}{tx.description && tx.counterparty ? ` · ${tx.description}` : ''}</p>
                </div>
                <span className="text-[14px] font-bold tnum shrink-0" style={{ color: tx.amount > 0 ? 'var(--c-success)' : 'var(--c-text)' }}>
                  {tx.amount > 0 ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                </span>
              </div>

              <div className="flex gap-1 mt-2 flex-wrap">
                {KINDS.map(k => (
                  <button key={k.id} type="button" onClick={() => set(tx.id, { kind: k.id })}
                    className="text-[11px] rounded-full px-2.5 py-1"
                    style={{ cursor: 'pointer', border: `1px solid ${p.kind === k.id ? 'var(--accent-border)' : 'var(--c-border)'}`, background: p.kind === k.id ? 'var(--accent-soft)' : 'transparent', color: p.kind === k.id ? 'var(--accent)' : 'var(--c-text-3)', fontWeight: p.kind === k.id ? 700 : 500 }}>
                    {k.label}
                  </button>
                ))}
              </div>
              {showCats && (
                <div className="flex gap-1 mt-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                  {cats.map(c => (
                    <button key={c.id} type="button" onClick={() => set(tx.id, { category: c.id })}
                      className="text-[11px] rounded-full px-2.5 py-1 shrink-0"
                      style={{ cursor: 'pointer', border: `1px solid ${p.category === c.id ? 'var(--c-border-strong)' : 'var(--c-border)'}`, background: p.category === c.id ? 'var(--c-surface-3)' : 'transparent', color: p.category === c.id ? 'var(--c-text)' : 'var(--c-text-3)' }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-2.5">
                <button type="button" onClick={() => bank.ignore(tx)} disabled={bank.busy} className="btn-ghost flex-1" style={{ padding: '7px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <X size={13} /> Negeren
                </button>
                <button type="button" onClick={() => bank.add(tx, choice[tx.id]?.category ? p.category : undefined, p.kind)} disabled={bank.busy}
                  className="btn-primary flex-1" style={{ padding: '7px 10px', fontSize: 12 }}>
                  <Check size={13} /> Toevoegen
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {bank.matched.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider m-0 mb-2">Al ingevoerd</p>
          <div className="flex flex-col gap-1">
            {bank.matched.map(tx => (
              <div key={tx.id} className="flex items-center gap-2 text-[12px]">
                <Check size={12} style={{ color: 'var(--c-success)' }} className="shrink-0" />
                <span className="flex-1 min-w-0 truncate text-white/60">{fmtDay(tx.booking_date)} · {tx.counterparty || tx.description}</span>
                <span className="tnum text-white/60">{fmt(Math.abs(tx.amount))}</span>
                <button type="button" onClick={() => bank.unmatch(tx)} title="Klopt niet: terug naar de inbox" aria-label="Terug naar de inbox"
                  className="text-white/35 hover:text-white/70" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Undo2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
