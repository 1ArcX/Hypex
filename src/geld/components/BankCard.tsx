import { useEffect, useState } from 'react'
import { Landmark, RefreshCw, Inbox, AlertTriangle, PiggyBank, Wallet, Plus, Pencil } from 'lucide-react'
import { GlassCard } from './ui/Glass'
import { fmt, parseAmount } from '../lib/format'
import type { BankAccount, BankState } from '../hooks/useBank'

// Spaarrekening die ING niet deelt: naam, huidig saldo en waaraan overboekingen te herkennen zijn
function ManualSavingsForm({ bank, acc, onDone }: { bank: BankState; acc?: BankAccount; onDone: () => void }) {
  const [name, setName] = useState(acc?.name || '')
  const [balance, setBalance] = useState(acc?.balance != null ? String(acc.balance).replace('.', ',') : '')
  const [match, setMatch] = useState(acc?.match || acc?.iban || '')
  const [goal, setGoal] = useState(acc?.goal ? String(acc.goal).replace('.', ',') : '')
  const [cands, setCands] = useState<string[]>([])
  useEffect(() => { bank.savingsCandidates().then(setCands) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const ok = name.trim() && balance.trim()
  const input = { width: '100%', boxSizing: 'border-box' as const, fontSize: 13, padding: '7px 10px' }
  return (
    <div className="mt-3 rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
      <p className="m-0 text-[12px] font-semibold text-white/80">{acc ? 'Spaarrekening aanpassen' : 'Spaarrekening toevoegen'}</p>
      <input className="glass-input" style={input} placeholder="Naam (bv. Oranje Spaarrekening)" value={name} onChange={e => setName(e.target.value)} />
      <input className="glass-input" style={input} inputMode="decimal" placeholder="Huidig saldo (zie de ING-app)" value={balance} onChange={e => setBalance(e.target.value)} />
      <input className="glass-input" style={input} inputMode="decimal" placeholder="Doel (optioneel)" value={goal} onChange={e => setGoal(e.target.value)} />
      <input className="glass-input" style={input} placeholder="Herkennen aan: IBAN of naam bij overboekingen" value={match} onChange={e => setMatch(e.target.value)} />
      {cands.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {cands.map(c => (
            <button key={c} type="button" onClick={() => setMatch(c)} className="text-[11px] rounded-full px-2 py-0.5"
              style={{ cursor: 'pointer', border: `1px solid ${match === c ? 'var(--accent-border)' : 'var(--c-border)'}`, background: match === c ? 'var(--accent-soft)' : 'transparent', color: match === c ? 'var(--accent)' : 'var(--c-text-3)' }}>
              {c}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 text-[11px] text-white/40">Hypex telt overboekingen van/naar deze rekening op je betaalrekening erbij of eraf. Rente of stortingen van buitenaf zie je niet; pas dan het saldo hier aan.</p>
      <div className="flex gap-2">
        {acc && <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}
          onClick={async () => { if (window.confirm(`"${acc.name}" verwijderen?`)) { await bank.removeManualSavings(acc); onDone() } }}>Verwijderen</button>}
        <span className="flex-1" />
        <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={onDone}>Annuleren</button>
        <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!ok || bank.busy}
          onClick={async () => { await bank.saveManualSavings({ uid: acc?.uid, name, balance: parseAmount(balance), match, goal: goal.trim() ? parseAmount(goal) : null }); onDone() }}>Opslaan</button>
      </div>
    </div>
  )
}

// Kaart "Rekeningen" op Geld → Home: saldo's van ING (betaal + spaar), status van de koppeling,
// en de knop naar de inbox met nieuwe banktransacties.
export function BankCard({ bank, onOpenInbox }: { bank: BankState; onOpenInbox: () => void }) {
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null)
  const [openAcc, setOpenAcc] = useState<string | null>(null)
  if (bank.missing || bank.loading) return null
  const synced = bank.conn.last_synced_at
    ? new Date(bank.conn.last_synced_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  const expired = bank.conn.status === 'expired'
  const expiring = !expired && bank.daysLeft != null && bank.daysLeft <= 14

  if (!bank.connected) {
    return (
      <GlassCard className="mb-3 p-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #FF6200 16%, transparent)', color: '#FF6200' }}>
            <Landmark size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="m-0 text-[14px] font-semibold text-white/90">ING koppelen</p>
            <p className="m-0 text-[12px] text-white/50">Saldo's en transacties automatisch, alleen-lezen</p>
          </div>
          <button type="button" onClick={bank.connect} disabled={bank.busy} className="btn-primary" style={{ padding: '7px 12px', fontSize: 12 }}>
            {bank.busy ? 'Even…' : 'Koppelen'}
          </button>
        </div>
        {bank.error && <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-danger)' }}>{bank.error}</p>}
      </GlassCard>
    )
  }

  return (
    <GlassCard className="mb-3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark size={15} style={{ color: '#FF6200' }} aria-hidden="true" />
        <h3 className="m-0 text-[14px] font-semibold text-white/90 flex-1">Rekeningen</h3>
        <span className="text-[11px] text-white/40 tnum">{synced ? `bijgewerkt ${synced}` : 'nog niet bijgewerkt'}</span>
        <button type="button" onClick={bank.refresh} disabled={bank.busy} aria-label="Saldo's vernieuwen" title="Vernieuwen"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white/80" style={{ background: 'var(--c-surface-2)', border: 'none', cursor: 'pointer' }}>
          <RefreshCw size={13} className={bank.busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {(expired || expiring) && (
        <button type="button" onClick={bank.connect} className="w-full mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px]"
          style={{ background: 'color-mix(in srgb, var(--c-warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--c-warning) 35%, transparent)', color: 'var(--c-warning)', cursor: 'pointer' }}>
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{expired ? 'Koppeling verlopen' : `Koppeling verloopt over ${bank.daysLeft} ${bank.daysLeft === 1 ? 'dag' : 'dagen'}`}</span>
          <span className="font-semibold">Opnieuw koppelen</span>
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        {bank.accounts.map(a => (
          <div key={a.uid}>
          <div className="flex items-center gap-2.5" onClick={a.manual ? () => setOpenAcc(o => o === a.uid ? null : a.uid) : undefined}
            style={a.manual ? { cursor: 'pointer' } : undefined} title={a.manual ? 'Tik voor de overboekingen' : undefined}>
            {a.kind === 'spaar' ? <PiggyBank size={14} className="text-white/40 shrink-0" /> : <Wallet size={14} className="text-white/40 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] text-white/85 truncate">{a.name || (a.kind === 'spaar' ? 'Spaarrekening' : 'Betaalrekening')}</p>
              {a.manual && a.goal
                ? <div className="mt-1 flex items-center gap-2">
                    <span className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-3)' }}>
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, (Number(a.balance || 0) / Number(a.goal)) * 100))}%`, background: Number(a.balance || 0) >= Number(a.goal) ? 'var(--c-success)' : 'var(--accent)' }} />
                    </span>
                    <span className="text-[10px] text-white/40 tnum shrink-0">doel {fmt(Number(a.goal))}</span>
                  </div>
                : a.manual
                ? <p className="m-0 text-[10px] text-white/35">zelf bijgehouden{a.match ? ' · via overboekingen' : ' · nog niet gekoppeld aan overboekingen'}</p>
                : a.iban && <p className="m-0 text-[10px] text-white/35 tnum">{a.iban.replace(/(.{4})/g, '$1 ').trim()}</p>}
            </div>
            <span className="text-[14px] font-semibold tnum" style={{ color: Number(a.balance) < 0 ? 'var(--c-danger)' : 'var(--c-text)' }}>
              {a.balance == null ? '—' : `${a.manual ? '≈ ' : ''}${fmt(Number(a.balance))}`}
            </span>
            {a.manual && (
              <button type="button" onClick={e => { e.stopPropagation(); setEditing(a) }} aria-label={`${a.name} aanpassen`} title="Saldo of naam aanpassen"
                className="text-white/35 hover:text-white/70" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Pencil size={12} />
              </button>
            )}
          </div>
          {/* Overboekingen van/naar deze spaarrekening (tellen niet mee in je uitgaven) */}
          {openAcc === a.uid && (() => {
            const list = bank.transfersFor(a).slice(0, 15)
            return (
              <div className="ml-6 mt-1.5 mb-1 flex flex-col gap-1">
                {!a.match && (
                  <div className="text-[11px] text-white/55">
                    <p className="m-0 mb-1">Welk spaarnummer hoort bij {a.name}?</p>
                    <div className="flex gap-1 flex-wrap">
                      {bank.unassignedCodes.map(c => (
                        <button key={c.code} type="button" onClick={() => bank.setMatch(a, c.code)} disabled={bank.busy}
                          className="rounded-full px-2 py-0.5" title={`${c.label} · ${c.count}× · laatst ${c.last}`}
                          style={{ cursor: 'pointer', border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', color: 'var(--c-text-2)', fontSize: 11 }}>
                          {c.code} · {c.count}×
                        </button>
                      ))}
                      {!bank.unassignedCodes.length && <span className="text-white/40">Geen spaaroverboekingen gevonden.</span>}
                    </div>
                  </div>
                )}
                {a.match && !list.length && <p className="m-0 text-[11px] text-white/40">Nog geen overboekingen met {a.match}.</p>}
                {list.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 shrink-0 text-white/40 tnum">{new Date(t.booking_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                    <span className="flex-1 min-w-0 truncate text-white/55">{t.toSavings > 0 ? 'Naar spaar' : 'Van spaar'}</span>
                    <span className="tnum font-semibold" style={{ color: t.toSavings > 0 ? 'var(--c-success)' : 'var(--c-text-2)' }}>{t.toSavings > 0 ? '+' : '−'}{fmt(Math.abs(t.toSavings))}</span>
                  </div>
                ))}
              </div>
            )
          })()}
          </div>
        ))}
        {!editing && (
          <button type="button" onClick={() => setEditing('new')} className="self-start mt-1 inline-flex items-center gap-1 text-[12px] text-white/45 hover:text-white/75"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Plus size={12} /> Spaarrekening toevoegen
          </button>
        )}
        {editing && <ManualSavingsForm bank={bank} acc={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
        {bank.accounts.some(a => a.kind === 'spaar') && (
          <div className="flex items-center justify-between pt-2 mt-1 text-[12px]" style={{ borderTop: '1px solid var(--c-border)' }}>
            <span className="text-white/50">Totaal gespaard</span>
            <span className="font-semibold tnum text-white/90">{fmt(bank.savingsTotal)}</span>
          </div>
        )}
      </div>

      {(bank.inbox.length > 0 || bank.matched.length > 0 || bank.notOnStatement.length > 0) && (
        <button type="button" onClick={onOpenInbox} className="w-full mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
          style={{ background: bank.inbox.length ? 'var(--accent-soft)' : 'var(--c-surface-2)', border: `1px solid ${bank.inbox.length ? 'var(--accent-border)' : 'var(--c-border)'}`, cursor: 'pointer', color: 'var(--c-text)' }}>
          <Inbox size={15} style={{ color: bank.inbox.length ? 'var(--accent)' : 'var(--c-text-3)' }} />
          <span className="flex-1 text-[13px] font-semibold">
            {bank.inbox.length ? `${bank.inbox.length} nieuwe ${bank.inbox.length === 1 ? 'transactie' : 'transacties'}` : bank.notOnStatement.length ? `${bank.notOnStatement.length} niet op je afschrift` : 'Banktransacties'}
          </span>
          <span className="text-[12px] text-white/50">Bekijken</span>
        </button>
      )}
      {bank.error && <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-danger)' }}>{bank.error}</p>}
    </GlassCard>
  )
}
