import { AlertTriangle, BarChart3, PiggyBank, Settings2, CalendarDays, CalendarRange, TrendingUp, ShieldCheck, ArrowRight, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCard, ProgressBar, SectionLabel } from '../components/ui/Glass'
import { TransactionRow } from '../components/TransactionRow'
import { MonthHeader } from '../components/MonthHeader'
import type { BudgetStats } from '../hooks/useBudgetStats'
import type { Expense } from '../types'
import { fmt, fmtShort } from '../lib/format'

// Home: hero-saldo, dag- en weekbudget, alerts en recente transacties.
// Detail (analyse, inkomsten, alle uitgaven) zit achter sheets.
export function HomeView({ stats, isCurrentMonth, remainingLoan, openLoansCount, onOpenBudget, onOpenAnalyse, onOpenInkomsten, onOpenUitgaven, onEdit, onDelete }: {
  stats: BudgetStats
  isCurrentMonth: boolean
  remainingLoan: number
  openLoansCount: number
  onOpenBudget: () => void
  onOpenAnalyse: () => void
  onOpenInkomsten: () => void
  onOpenUitgaven: () => void
  onEdit: (exp: Expense) => void
  onDelete: (id: string) => void
}) {
  const s = stats
  const heroColor = s.adjustedRemaining < 0 || s.adjustedRemainPct < 15 ? 'var(--c-danger)'
    : s.adjustedRemainPct < 40 ? 'var(--c-warning)' : 'var(--accent)'

  const dagLeft = s.dagBudget - s.todayTotal
  const dagColor = s.dagBudget > 15 ? '#34D399' : s.dagBudget > 5 ? '#FBBF24' : '#F87171'
  const w = s.week
  const wColor = w.weekRemaining < 0 ? '#F87171'
    : w.weekAllowance > 0 && w.weekRemaining / w.weekAllowance < 0.25 ? '#FBBF24' : '#34D399'

  return (
    <>
      <MonthHeader showSearch />

      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-[22px] font-extrabold text-white/95 m-0">Overzicht</h2>
        <button onClick={onOpenBudget}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-semibold cursor-pointer border backdrop-blur-lg ${
            s.vacationMode ? 'bg-cyan-400/10 border-cyan-400/40 text-cyan-400' : 'bg-white/[0.05] border-white/10 text-white/60'
          }`}>
          {s.vacationMode ? <>✈️ Vakantiemodus</> : <><Settings2 size={13} /> Budget</>}
        </button>
      </div>

      {/* Vakantiebanner */}
      {s.vacationMode && (
        <div className="mb-3 px-3.5 py-3 rounded-2xl bg-cyan-400/[0.07] border border-cyan-400/30 backdrop-blur-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">✈️</span>
            <p className="flex-1 text-[12px] font-bold text-cyan-400 m-0">Vakantiemodus — {fmt(s.monthlyBudget)} totaal</p>
            <button onClick={onOpenBudget} className="text-[11px] text-cyan-400 bg-transparent border-none cursor-pointer p-0 font-semibold">Wijzig</button>
          </div>
          <p className="text-[11px] text-white/35 m-0 mt-1">{s.daysLeft} dag{s.daysLeft !== 1 ? 'en' : ''} over van {s.daysInMonth}</p>
        </div>
      )}

      {/* Alert: openstaande lening */}
      {remainingLoan > 0 && (
        <button onClick={onOpenInkomsten}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl mb-2.5 bg-amber-400/[0.07] border border-amber-400/30 cursor-pointer text-left backdrop-blur-lg">
          <span className="text-base">🤝</span>
          <span className="flex-1 text-[12px] font-semibold text-amber-400">
            {openLoansCount}× openstaande lening — {fmt(remainingLoan)} nog terug te storten
          </span>
          <span className="text-[11px] text-white/30">→</span>
        </button>
      )}

      {/* Alert: carryover */}
      <AlertStrip stats={s} />

      {/* Hero (Level 1): nog over deze maand */}
      <GlassCard className="relative overflow-hidden px-5 pt-5 pb-4 mb-3"
        style={{ borderColor: `color-mix(in srgb, ${heroColor} 35%, transparent)`, background: `color-mix(in srgb, ${heroColor} 5%, var(--c-surface))` }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Wallet size={14} style={{ color: heroColor }} aria-hidden="true" />
          <p className="text-[12px] font-semibold m-0" style={{ color: 'var(--c-text-2)' }}>
            {s.adjustedRemaining < 0 ? '🚨 Budget overschreden' : s.vacationMode ? 'Nog over op vakantie' : 'Nog over deze maand'}
          </p>
        </div>
        <p className="text-[40px] font-extrabold leading-none mb-3.5 tabular-nums" style={{ color: s.adjustedRemaining < 0 ? 'var(--c-danger)' : 'var(--c-text)', letterSpacing: '-0.02em' }}>
          {s.adjustedRemaining < 0 ? '−' : ''}{fmt(Math.abs(s.adjustedRemaining))}
        </p>
        <ProgressBar pct={100 - s.adjustedRemainPct} color={heroColor} height={6} />
        <div className="flex justify-between items-baseline gap-3 mt-2">
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--c-text-3)' }}>
            {s.savingsExpTotal > 0 ? `💳 ${fmt(s.savingsExpTotal)} spaar` : ''}
          </span>
          <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--c-text-2)' }}>
            {fmt(s.totalSpent)} / {fmt(s.adjustedBase)}
          </span>
        </div>
        {!s.vacationMode && budgetBreakdown(s).includes('=') && (
          <p className="text-[11px] m-0 mt-1 text-right tabular-nums" style={{ color: 'var(--c-text-3)' }}>{budgetBreakdown(s)}</p>
        )}
      </GlassCard>

      {/* Level 2: vandaag · deze week · inkomsten */}
      <div className={`grid ${isCurrentMonth ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mb-2`}>
        <StatCard icon={<CalendarDays size={12} />} label="Vandaag" tint={dagColor}
          value={fmt(dagLeft)}
          sub={`${fmt(s.todayTotal)} uit · ${s.daysLeft} ${s.daysLeft === 1 ? 'dag' : 'dagen'} over`} />
        {isCurrentMonth && (
          <StatCard icon={<CalendarRange size={12} />} label="Deze week" tint={wColor}
            value={fmtShort(w.weekRemaining)}
            sub={w.weekRemaining < 0 ? `${fmt(Math.abs(w.weekRemaining))} over budget` : `van ${fmt(w.weekAllowance)} · ${w.remainingWeeks} ${w.remainingWeeks !== 1 ? 'weken' : 'week'}`}
            progress={w.weekRemaining < 0 ? 100 : w.weekAllowance > 0 ? (w.weekRemaining / w.weekAllowance) * 100 : 0} />
        )}
        <StatCard icon={<PiggyBank size={12} />} label="Inkomsten" onClick={onOpenInkomsten}
          value={s.hasRecurring ? fmt(s.recurringExpected) : s.totalManualIncome > 0 ? fmt(s.totalManualIncome) : '–'}
          tint={s.hasRecurring || s.totalManualIncome > 0 ? '#34D399' : undefined}
          sub={s.hasRecurring ? 'verwacht' : 'Inkomsten & sparen →'} />
      </div>

      {/* Level 3: prognose · spaarstreak · analyse */}
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <StatCard icon={<TrendingUp size={12} />} label="Prognose"
          value={s.projectedTotal === null ? 'Geen data' : fmtShort(s.projectedTotal)}
          tint={s.projectedTotal === null ? undefined : s.projectedOver ? '#F87171' : '#34D399'}
          sub={s.projectedTotal === null ? undefined : s.projectedOver ? `⚠ +${fmtShort(s.projectedTotal - s.adjustedBase)}` : '✓ Op schema'} />
        <StatCard icon={<ShieldCheck size={12} />} label="Spaarstreak" value={`${s.spaarStreak}d`}
          tint={s.spaarStreak < 3 ? '#F87171' : '#34D399'}
          sub={s.spaarStreak < 3 ? '🔓 Recent' : '🔒 Geen opname'} />
        <StatCard icon={<BarChart3 size={12} />} label="Analyse"
          value={s.regularExpenses.length > 0 ? 'Bekijk' : '–'}
          sub={s.regularExpenses.length > 0 ? 'Categorieën & trends' : 'Nog geen uitgaven'}
          onClick={s.regularExpenses.length > 0 ? onOpenAnalyse : undefined}
          trailing={s.regularExpenses.length > 0 ? <ArrowRight size={14} /> : undefined} />
      </div>

      {/* Spaarwaarschuwingen */}
      {s.savingsWithdrawals.length > 0 && (
        <button onClick={onOpenInkomsten}
          className="w-full text-left px-4 py-3 rounded-r-md bg-red-400/[0.06] border border-red-400/25 mb-2.5 flex items-center gap-2.5 cursor-pointer">
          <AlertTriangle size={18} color="#F87171" className="shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-red-400 m-0 mb-0.5">
              Je hebt {s.savingsWithdrawals.length}× van je spaarrekening gehaald deze maand
            </p>
            <p className="text-[12px] text-red-400/70 m-0">Totaal: {fmt(s.savingsTotal)}</p>
          </div>
          <ArrowRight size={14} color="#F87171" className="shrink-0" />
        </button>
      )}
      {s.savingsExpenses.length > 0 && (
        <div className="px-4 py-3 rounded-r-md bg-amber-400/[0.05] border border-amber-400/25 mb-2.5">
          <p className="text-[13px] font-bold text-amber-400 m-0 mb-0.5">
            🏦 {s.savingsExpenses.length === 1 ? '1 noodaankoop' : `${s.savingsExpenses.length} noodaankopen`} van spaarrekening — {fmt(s.savingsExpTotal)}
          </p>
          <p className="text-[12px] text-amber-400/60 m-0">Noodzakelijk, maar probeer dit te vermijden — zie alle uitgaven voor details</p>
        </div>
      )}

      {/* Recente transacties */}
      {s.allTransactions.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel className="!mb-0">Recent</SectionLabel>
            <button onClick={onOpenUitgaven} className="text-[12px] text-accent bg-transparent border-none cursor-pointer p-0 font-semibold">
              Alles →
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {s.allTransactions.slice(0, 6).map(exp => (
              <TransactionRow key={exp.id} exp={exp} allCategories={s.allCategories} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function budgetBreakdown(s: BudgetStats): string {
  const parts = [`Budget ${fmt(s.monthlyBudget)}`]
  if (s.vasteLastenBudget > 0) parts.push(`🏠 ${fmt(s.vasteLastenBudget)}`)
  if (s.carryover > 0) parts.push(`↩ ${fmt(Math.round(s.carryover))}`)
  return parts.length > 1 ? `${parts.join(' − ')} = ${fmt(s.adjustedBase)}` : `Budget: ${fmt(s.adjustedBase)}`
}

function AlertStrip({ stats: s }: { stats: BudgetStats }) {
  return (
    <>
      {s.carryover > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl mb-2.5 bg-red-400/[0.06] border border-red-400/25 text-[12px] text-red-400/85 backdrop-blur-lg">
          <span className="text-[15px]">↩</span>
          <span className="flex-1">Vorige maand {fmt(s.carryover)} over limiet — wordt afgetrokken van dit maandbudget</span>
          <span className="font-bold whitespace-nowrap tabular-nums">−{fmt(s.carryover)}</span>
        </div>
      )}
    </>
  )
}

function StatCard({ icon, label, value, sub, tint, dim, onClick, progress, trailing }: {
  icon?: ReactNode
  label: string
  value: string
  sub?: string
  tint?: string
  dim?: boolean
  onClick?: () => void
  progress?: number
  trailing?: ReactNode
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} type={onClick ? 'button' : undefined}
      className={`text-left w-full px-3 py-2.5 rounded-r-md border ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform hover:brightness-110' : ''}`}
      style={tint
        ? { background: `color-mix(in srgb, ${tint} 7%, var(--c-surface))`, borderColor: `color-mix(in srgb, ${tint} 28%, transparent)` }
        : { background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
      <p className="text-[11px] font-semibold mb-1 flex items-center gap-1.5"
        style={{ color: tint || 'var(--c-text-3)' }}>{icon}{label}</p>
      <p className="text-[17px] font-bold m-0 leading-tight tabular-nums flex items-center justify-between gap-1"
        style={{ color: dim ? 'var(--c-text-3)' : 'var(--c-text)' }}>
        <span className="truncate">{value}</span>{trailing && <span style={{ color: 'var(--c-text-3)' }}>{trailing}</span>}
      </p>
      {sub && <p className="text-[10px] font-medium m-0 mt-0.5 truncate" style={{ color: 'var(--c-text-3)' }}>{sub}</p>}
      {progress !== undefined && (
        <div className="mt-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--c-surface-3)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: tint }} />
        </div>
      )}
    </Tag>
  )
}
