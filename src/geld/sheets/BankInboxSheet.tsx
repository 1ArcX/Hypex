import { useEffect, useState } from 'react'
import { Check, X, Undo2, Link2, Landmark, AlertTriangle } from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { fmt, fmtDay } from '../lib/format'
import { INCOME_CATEGORIES, findCategory, findIncomeCategory } from '../lib/categories'
import { entriesNear } from '../lib/bankMatch'
import type { CategoryConfig, Expense } from '../types'
import type { BankState, BankTx } from '../hooks/useBank'

// Bank-inbox (ING). Van boven naar beneden:
//  1. Oude transacties (vóór deze maand) in één keer negeren.
//  2. Alleen ING voor deze maand: losse eigen invoer vervangen door de banktransacties (met bevestiging).
//  3. Hoort bij je eigen invoer: slimme koppeling, ook samengesteld (bv. "Eten €15,70" = 2 pinbetalingen − Tikkie)
//     → Klopt (koppelen, je invoer blijft) of Gebruik ING (je invoer vervangen door de losse transacties).
//  4. Nieuwe transacties per dag, met je eigen invoer van die dag erboven en "Hoort bij…" om zelf te koppelen.
//  5. Niet op je afschrift: eigen invoer zonder bijpassende transactie → Klopt (bv. contant) of Verwijderen.
//  6. Al ingevoerd (door de server 1-op-1 gekoppeld), met terugzetten.

const KINDS = [
  { id: 'uitgave', label: 'Uitgave' }, { id: 'inkomen', label: 'Inkomen' },
  { id: 'terugbetaling', label: 'Terugbetaling' },
  { id: 'spaarstorting', label: 'Naar spaar' }, { id: 'spaaropname', label: 'Van spaar' },
]
const card = { background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }
const heading = 'text-[11px] font-semibold text-white/40 uppercase tracking-wider m-0 mb-2'
const signed = (amount: number) => `${amount > 0 ? '+' : '−'}${fmt(Math.abs(amount))}`

function OwnLabel({ e, categories }: { e: Expense; categories: CategoryConfig[] }) {
  const cat = e.is_income ? findIncomeCategory(e.category) : findCategory(categories, e.category)
  const kind = e.is_income ? 'inkomen' : e.is_savings_contribution ? 'naar spaar' : e.is_savings_withdrawal ? 'van spaar' : null
  return (
    <span className="min-w-0 truncate">
      {cat.emoji} {e.description || cat.label}{kind ? ` · ${kind}` : ''}
    </span>
  )
}

export function BankInboxSheet({ bank, categories, onClose }: { bank: BankState; categories: CategoryConfig[]; onClose: () => void }) {
  const [choice, setChoice] = useState<Record<string, { kind?: string; category?: string }>>({})
  const [confirmOnly, setConfirmOnly] = useState(false)
  const [onlyMonth, setOnlyMonth] = useState(bank.bankMonths[0] || '')
  const [preview, setPreview] = useState<{ add: BankTx[]; del: Expense[] } | null>(null)
  const [clean, setClean] = useState<Awaited<ReturnType<BankState['previewCleanup']>> | null>(null)
  useEffect(() => { bank.previewCleanup().then(setClean) }, [bank.inbox.length, bank.matched.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!onlyMonth && bank.bankMonths[0]) setOnlyMonth(bank.bankMonths[0]) }, [bank.bankMonths.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (tx: BankTx) => ({ kind: choice[tx.id]?.kind || tx.suggested_kind || (tx.amount > 0 ? 'inkomen' : 'uitgave'), category: choice[tx.id]?.category || tx.suggested_category || 'overig' })
  const set = (id: string, patch: { kind?: string; category?: string }) => setChoice(c => ({ ...c, [id]: { ...c[id], ...patch } }))

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthName = now.toLocaleDateString('nl-NL', { month: 'long' })
  const olderCount = bank.inbox.filter(t => t.booking_date < monthStart).length

  // Wat al in een voorstel zit, staat niet nog eens los in de lijst
  const grouped = new Set(bank.groups.flatMap(g => g.txs.map(t => t.id)))
  const groupedOwn = new Set(bank.groups.map(g => g.expense.id))
  const loose = bank.inbox.filter(t => !grouped.has(t.id))
  const ownFree = bank.ownOpen.filter(e => !groupedOwn.has(e.id))
  const days = [...new Set(loose.map(t => t.booking_date))].sort((a, b) => b.localeCompare(a))

  // Alleen ING voor de gekozen maand: voorbeeld ophalen zodra je de bevestiging opent of een andere maand kiest
  useEffect(() => {
    if (!confirmOnly || !onlyMonth) return
    let cancelled = false
    setPreview(null)
    bank.previewMonth(onlyMonth).then(p => { if (!cancelled) setPreview(p) })
    return () => { cancelled = true }
  }, [confirmOnly, onlyMonth]) // eslint-disable-line react-hooks/exhaustive-deps
  const onlyDel = preview?.del || []
  const onlyAdd = preview?.add || []
  const monthLabel = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const partial = onlyMonth && bank.firstBankDate && bank.firstBankDate.slice(0, 7) === onlyMonth && bank.firstBankDate.slice(8) !== '01'

  const addAll = async () => {
    for (const tx of loose) {
      const p = pick(tx)
      await bank.add(tx, choice[tx.id]?.category ? p.category : undefined, p.kind)
    }
  }

  return (
    <Sheet onClose={onClose} title={`Banktransacties${bank.inbox.length ? ` (${bank.inbox.length})` : ''}`}>
      {bank.error && <p className="m-0 mb-3 text-[12px]" style={{ color: 'var(--c-danger)' }}>{bank.error}</p>}
      {bank.inbox.length === 0 && bank.notOnStatement.length === 0 && (
        <p className="text-[13px] text-white/50 m-0 mb-4">Alles verwerkt. Nieuwe transacties verschijnen hier na het bijwerken.</p>
      )}

      {/* 0. Eerder verkeerd geïmporteerd: spaaroverboekingen als uitgave/inkomen, Tikkies als inkomen */}
      {clean && (clean.savings.length > 0 || clean.repay.length > 0 || clean.redate.length > 0) && (
        <div className="rounded-2xl p-3 mb-3" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid var(--accent-border)' }}>
          <p className="m-0 text-[12px] font-semibold text-white/85 mb-1">Opschonen</p>
          <ul className="m-0 mb-2 pl-4 text-[12px] text-white/70">
            {clean.savingsExp.length > 0 && <li>{clean.savingsExp.length} overboekingen met je spaarrekeningen staan als uitgave/inkomen ({fmt(clean.savingsExp.reduce((n, e) => n + Math.abs(Number(e.amount)), 0))}) — die worden verwijderd, want het is alleen geld verschuiven.</li>}
            {clean.savings.length - clean.savingsExp.length > 0 && <li>{clean.savings.length - clean.savingsExp.length} spaaroverboekingen in de inbox worden genegeerd.</li>}
            {clean.repay.filter(r => r.expense).length > 0 && <li>{clean.repay.filter(r => r.expense).length} Tikkies/terugbetalingen staan als inkomen ({fmt(clean.repay.filter(r => r.expense).reduce((n, r) => n + Math.abs(Number(r.expense!.amount)), 0))}) — die verlagen voortaan de uitgave waarvoor je voorschoot.</li>}
            {clean.repay.filter(r => !r.expense).length > 0 && <li>{clean.repay.filter(r => !r.expense).length} Tikkies in de inbox krijgen het voorstel "Terugbetaling".</li>}
            {clean.redate.length > 0 && <li>{clean.redate.length} uitgaven van ING staan op de boekdatum i.p.v. de dag dat je betaalde — die krijgen de echte betaaldatum (belangrijk voor je vakantie).</li>}
          </ul>
          <button type="button" onClick={async () => { await bank.cleanup(); setClean(await bank.previewCleanup()) }} disabled={bank.busy} className="btn-primary w-full" style={{ padding: '7px 12px', fontSize: 12 }}>
            {bank.busy ? 'Bezig…' : 'Rechtzetten'}
          </button>
        </div>
      )}

      {/* 1. Geschiedenis van de eerste koppeling */}
      {olderCount > 0 && (
        <div className="rounded-2xl p-3 mb-3" style={{ background: 'color-mix(in srgb, var(--c-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--c-warning) 30%, transparent)' }}>
          <p className="m-0 text-[12px] text-white/75 mb-2">
            {olderCount} {olderCount === 1 ? 'transactie is' : 'transacties zijn'} van vóór deze maand. Die staan meestal al in Geld; negeer ze om dubbele uitgaven te voorkomen.
          </p>
          <button type="button" onClick={() => bank.ignoreBefore(monthStart)} disabled={bank.busy} className="btn-ghost w-full" style={{ padding: '7px 12px', fontSize: 12 }}>
            Alles vóór 1 {monthName} negeren ({olderCount})
          </button>
        </div>
      )}

      {/* 2. Alleen ING voor deze maand */}
      {bank.bankMonths.length > 0 && (
        <div className="rounded-2xl p-3 mb-3" style={card}>
          {!confirmOnly ? (
            <div className="flex items-center gap-2">
              <Landmark size={15} style={{ color: '#FF6200' }} className="shrink-0" />
              <p className="m-0 text-[12px] text-white/70 flex-1">Een maand helemaal vervangen door je ING-afschrift?</p>
              <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setConfirmOnly(true)}>Alleen ING</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="m-0 text-[12px] font-semibold text-white/85 flex items-center gap-1.5 flex-1"><AlertTriangle size={13} style={{ color: 'var(--c-warning)' }} /> Alleen ING voor</p>
                <select className="glass-input" value={onlyMonth} onChange={e => setOnlyMonth(e.target.value)} aria-label="Maand"
                  style={{ width: 'auto', fontSize: 12, padding: '5px 8px', colorScheme: 'dark' }}>
                  {bank.bankMonths.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
                </select>
              </div>
              {partial && <p className="m-0 text-[11px]" style={{ color: 'var(--c-warning)' }}>ING heeft voor deze maand pas gegevens vanaf {fmtDay(bank.firstBankDate!)}; eigen invoer daarvóór wordt ook vervangen.</p>}
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} disabled={bank.busy}
                  onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 12); d.setDate(1); bank.fetchHistory(d.toLocaleDateString('en-CA')) }}>
                  {bank.busy ? 'Bezig met ophalen…' : 'Oudere maanden ophalen'}
                </button>
                {bank.historyNote && <span className="text-[11px] text-white/55 flex-1">{bank.historyNote}</span>}
                {bank.historyNote?.startsWith('ING gaf') && <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={bank.connect}>Opnieuw koppelen</button>}
              </div>
              {!preview ? <p className="m-0 text-[12px] text-white/50">Even kijken wat er verandert…</p> : <>
              <p className="m-0 text-[12px] text-white/65">
                {onlyDel.length
                  ? <>Je <b>{onlyDel.length}</b> losse eigen {onlyDel.length === 1 ? 'invoer wordt' : 'invoeren worden'} verwijderd ({fmt(onlyDel.reduce((n, e) => n + Number(e.amount), 0))}) en </>
                  : 'Er wordt niets van je eigen invoer verwijderd; '}
                de <b>{onlyAdd.length}</b> transacties van ING komen ervoor in de plaats, met de omschrijving van ING. Bij invoer die al gekoppeld was blijven jouw categorie en "van spaargeld" behouden; de rest krijgt de voorgestelde categorie (aanpassen met één tik op het icoontje). Spaaropnames, stortingen, leningen, geplande uitgaven en wat je als "klopt" markeerde blijven staan.
              </p>
              {onlyDel.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg p-2 text-[11px] text-white/55 flex flex-col gap-0.5" style={{ background: 'var(--c-surface-3)' }}>
                  {onlyDel.map(e => (
                    <div key={e.id} className="flex gap-2"><span className="w-14 shrink-0">{fmtDay(e.date)}</span><OwnLabel e={e} categories={categories} /><span className="ml-auto tnum">{fmt(Number(e.amount))}</span></div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1" style={{ padding: '7px 10px', fontSize: 12 }} onClick={() => setConfirmOnly(false)}>Annuleren</button>
                <button type="button" className="btn-primary flex-1" style={{ padding: '7px 10px', fontSize: 12 }} disabled={bank.busy || !preview || (!onlyAdd.length && !onlyDel.length)}
                  onClick={async () => { await bank.onlyBankMonth(onlyMonth); setConfirmOnly(false) }}>Vervangen door ING</button>
              </div>
              </>}
            </div>
          )}
        </div>
      )}

      {/* 3. Slimme koppeling met je eigen invoer */}
      {bank.groups.length > 0 && (
        <div className="mb-4">
          <p className={heading}>Hoort bij je eigen invoer</p>
          <div className="flex flex-col gap-2">
            {bank.groups.map(g => (
              <div key={g.expense.id} className="rounded-2xl p-3" style={{ ...card, borderColor: 'color-mix(in srgb, var(--c-success) 30%, var(--c-border))' }}>
                <div className="flex items-baseline gap-2 text-[13px] font-semibold text-white/90">
                  <Link2 size={13} style={{ color: 'var(--c-success)' }} className="shrink-0 self-center" />
                  <OwnLabel e={g.expense} categories={categories} />
                  <span className="ml-auto tnum shrink-0">{fmt(Number(g.expense.amount))}</span>
                </div>
                <p className="m-0 mt-0.5 mb-1.5 text-[11px] text-white/40">Jouw invoer · {fmtDay(g.expense.date)}{g.txs.length > 1 ? ` · = ${g.txs.length} transacties samen` : ''}</p>
                <div className="flex flex-col gap-0.5 pl-5">
                  {g.txs.map(t => (
                    <div key={t.id} className="flex gap-2 text-[11px] text-white/60">
                      <span className="w-14 shrink-0">{fmtDay(t.booking_date)}</span>
                      <span className="flex-1 min-w-0 truncate">{t.counterparty || t.description || 'Onbekend'}</span>
                      <span className="tnum shrink-0" style={{ color: t.amount > 0 ? 'var(--c-success)' : undefined }}>{signed(t.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button type="button" onClick={() => bank.replaceWithBank(g.expense, g.txs)} disabled={bank.busy} className="btn-ghost flex-1" style={{ padding: '7px 10px', fontSize: 12 }}
                    title="Je eigen invoer verwijderen en deze transacties los toevoegen">
                    Gebruik ING
                  </button>
                  <button type="button" onClick={() => bank.linkTxs(g.expense, g.txs)} disabled={bank.busy} className="btn-primary flex-1" style={{ padding: '7px 10px', fontSize: 12 }}>
                    <Check size={13} /> Klopt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Nieuwe transacties per dag */}
      {loose.length > 1 && olderCount === 0 && (
        <button type="button" onClick={addAll} disabled={bank.busy} className="btn-ghost w-full mb-3" style={{ padding: '8px 12px', fontSize: 12 }}>
          Alles met voorstel toevoegen ({loose.length})
        </button>
      )}
      {days.map(day => {
        const ownToday = ownFree.filter(e => e.date === day)
        return (
          <div key={day} className="mb-3">
            <p className={heading}>{fmtDay(day)}</p>
            {ownToday.length > 0 && (
              <div className="mb-2 rounded-xl px-3 py-2 text-[11px] text-white/55 flex flex-col gap-0.5" style={{ border: '1px dashed var(--c-border-strong)' }}>
                <span className="text-white/40">Jouw invoer deze dag</span>
                {ownToday.map(e => (
                  <div key={e.id} className="flex gap-2"><OwnLabel e={e} categories={categories} /><span className="ml-auto tnum shrink-0">{fmt(Number(e.amount))}</span></div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {loose.filter(t => t.booking_date === day).map(tx => {
                const p = pick(tx)
                const cats = p.kind === 'inkomen' ? INCOME_CATEGORIES.map(c => ({ id: c.id, label: c.label, emoji: c.emoji })) : categories
                const showCats = p.kind === 'uitgave' || p.kind === 'inkomen' || p.kind === 'terugbetaling'
                const near = entriesNear(ownFree, tx)
                return (
                  <div key={tx.id} className="rounded-2xl p-3" style={card}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="m-0 text-[13px] font-semibold text-white/90 truncate">{tx.counterparty || tx.description || 'Onbekend'}</p>
                        {tx.description && tx.counterparty && <p className="m-0 text-[11px] text-white/40 break-words">{tx.description}</p>}
                      </div>
                      <span className="text-[14px] font-bold tnum shrink-0" style={{ color: tx.amount > 0 ? 'var(--c-success)' : 'var(--c-text)' }}>{signed(tx.amount)}</span>
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

                    {near.length > 0 && (
                      <select className="glass-input mt-2" value="" aria-label="Hoort bij een eigen invoer"
                        onChange={ev => { const e = near.find(x => x.id === ev.target.value); if (e) bank.linkTxs(e, [tx]) }}
                        style={{ fontSize: 12, padding: '6px 8px', colorScheme: 'dark' }}>
                        <option value="">Hoort bij je eigen invoer…</option>
                        {near.map(e => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.description || e.category} · {fmt(Number(e.amount))}</option>)}
                      </select>
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
          </div>
        )
      })}

      {/* 5. Eigen invoer zonder bijpassende transactie */}
      {bank.notOnStatement.length > 0 && (
        <div className="mt-4">
          <p className={heading}>Niet op je afschrift</p>
          <p className="m-0 mb-2 text-[11px] text-white/40">Eigen invoer van deze maand waar (nog) geen ING-transactie bij past. Contant betaald? Kies Klopt.</p>
          <div className="flex flex-col gap-1.5">
            {bank.notOnStatement.map(e => (
              <div key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]" style={card}>
                <span className="w-14 shrink-0 text-white/40">{fmtDay(e.date)}</span>
                <span className="flex-1 min-w-0 flex text-white/75"><OwnLabel e={e} categories={categories} /></span>
                <span className="tnum shrink-0 text-white/75">{fmt(Number(e.amount))}</span>
                <button type="button" onClick={() => bank.markChecked(e)} disabled={bank.busy} title="Klopt (bv. contant)" aria-label="Klopt"
                  className="text-white/40 hover:text-white/80" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Check size={14} /></button>
                <button type="button" onClick={() => { if (window.confirm(`"${e.description || e.category}" (${fmt(Number(e.amount))}) verwijderen?`)) bank.deleteOwn(e) }} disabled={bank.busy}
                  title="Verwijderen" aria-label="Verwijderen" className="text-red-400/50 hover:text-red-400" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Door de server 1-op-1 gekoppeld */}
      {bank.matched.length > 0 && (
        <div className="mt-5">
          <p className={heading}>Al ingevoerd</p>
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
