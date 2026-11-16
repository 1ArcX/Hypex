import { Landmark, RefreshCw, Inbox, AlertTriangle, PiggyBank, Wallet } from 'lucide-react'
import { GlassCard } from './ui/Glass'
import { fmt } from '../lib/format'
import type { BankState } from '../hooks/useBank'

// Kaart "Rekeningen" op Geld → Home: saldo's van ING (betaal + spaar), status van de koppeling,
// en de knop naar de inbox met nieuwe banktransacties.
export function BankCard({ bank, onOpenInbox }: { bank: BankState; onOpenInbox: () => void }) {
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
          <div key={a.uid} className="flex items-center gap-2.5">
            {a.kind === 'spaar' ? <PiggyBank size={14} className="text-white/40 shrink-0" /> : <Wallet size={14} className="text-white/40 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] text-white/85 truncate">{a.name || (a.kind === 'spaar' ? 'Spaarrekening' : 'Betaalrekening')}</p>
              {a.iban && <p className="m-0 text-[10px] text-white/35 tnum">{a.iban.replace(/(.{4})/g, '$1 ').trim()}</p>}
            </div>
            <span className="text-[14px] font-semibold tnum" style={{ color: Number(a.balance) < 0 ? 'var(--c-danger)' : 'var(--c-text)' }}>
              {a.balance == null ? '—' : fmt(Number(a.balance))}
            </span>
          </div>
        ))}
        {bank.accounts.some(a => a.kind === 'spaar') && (
          <div className="flex items-center justify-between pt-2 mt-1 text-[12px]" style={{ borderTop: '1px solid var(--c-border)' }}>
            <span className="text-white/50">Totaal gespaard</span>
            <span className="font-semibold tnum text-white/90">{fmt(bank.savingsTotal)}</span>
          </div>
        )}
      </div>

      {(bank.inbox.length > 0 || bank.matched.length > 0) && (
        <button type="button" onClick={onOpenInbox} className="w-full mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
          style={{ background: bank.inbox.length ? 'var(--accent-soft)' : 'var(--c-surface-2)', border: `1px solid ${bank.inbox.length ? 'var(--accent-border)' : 'var(--c-border)'}`, cursor: 'pointer', color: 'var(--c-text)' }}>
          <Inbox size={15} style={{ color: bank.inbox.length ? 'var(--accent)' : 'var(--c-text-3)' }} />
          <span className="flex-1 text-[13px] font-semibold">
            {bank.inbox.length ? `${bank.inbox.length} nieuwe ${bank.inbox.length === 1 ? 'transactie' : 'transacties'}` : 'Banktransacties'}
          </span>
          <span className="text-[12px] text-white/50">Bekijken</span>
        </button>
      )}
      {bank.error && <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-danger)' }}>{bank.error}</p>}
    </GlassCard>
  )
}
