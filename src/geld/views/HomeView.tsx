import { AlertTriangle, BarChart3, Settings2 } from 'lucide-react'
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
  const heroColor = s.adjustedRemaining < 0 || s.adjustedRemainPct < 15 ? '#F87171'
    : s.adjustedRemainPct < 40 ? '#FBBF24' : '#5EEAD4'

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

      {/* Hero: nog over */}
      <GlassCard className="relative overflow-hidden px-6 pt-6 pb-5 mb-3">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${heroColor}22, transparent 70%)` }} />
        <p className="text-[11px] text-white/35 uppercase tracking-[0.08em] font-semibold mb-1">
          {s.adjustedRemaining < 0 ? '🚨 Budget overschreden' : s.vacationMode ? 'Nog over op vakantie' : 'Nog over deze maand'}
        </p>
        <p className="text-[46px] font-extrabold leading-none mb-4 tabular-nums" style={{ color: s.adjustedRemaining < 0 ? '#F87171' : 'white' }}>
          {fmt(Math.abs(s.adjustedRemaining))}
        </p>
        <ProgressBar pct={100 - s.adjustedRemainPct} color={heroColor} height={8} />
        <div className="flex justify-between text-[12px] text-white/35 mt-2.5">
          <span>{fmt(s.totalSpent)} uitgegeven{s.savingsExpTotal > 0 ? ` · 💳 ${fmt(s.savingsExpTotal)} spaar` : ''}</span>
          <span>
            {s.vacationMode
              ? `Budget: ${fmt(s.adjustedBase)}`
              : budgetBreakdown(s)}
          </span>
        </div>
      </GlassCard>

      {/* Dagbudget */}
      <GlassCard className="px-5 py-4 mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-0.5" style={{ color: dagColor }}>Vandaag nog te besteden</p>
          <p className="text-[34px] font-extrabold leading-none m-0 tabular-nums" style={{ color: dagColor }}>{fmt(s.dagBudget - s.todayTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-white/40 m-0">{s.daysLeft} dagen over</p>
          <p className="text-[11px] text-white/30 m-0">vandaag {fmt(s.todayTotal)} uit</p>
          <p className="text-[11px] text-white/30 m-0">dagbudget {fmt(s.dagBudget)}</p>
        </div>
      </GlassCard>

      {/* Weekbudget */}
      {isCurrentMonth && (
        <GlassCard className="px-4 py-3.5 mb-2.5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] font-bold mb-0.5" style={{ color: wColor }}>
                💳 Weekbudget · {w.remainingWeeks} {w.remainingWeeks !== 1 ? 'weken' : 'week'} resterend
              </p>
              <p className="text-[26px] font-extrabold leading-tight m-0 tabular-nums" style={{ color: wColor }}>{fmtShort(w.weekRemaining)}</p>
              <p className="text-[11px] text-white/30 m-0 mt-0.5">
                {w.weekRemaining < 0 ? `${fmt(Math.abs(w.weekRemaining))} over weekbudget` : 'nog over deze week'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/30 m-0">Uitgegeven</p>
              <p className="text-[15px] font-bold text-white/90 m-0 tabular-nums">{fmt(w.weekSpentSoFar)}</p>
              <p className="text-[10px] text-white/30 m-0 mt-0.5">van {fmt(w.weekAllowance)} · {w.remainingWeeks}× verdeeld</p>
            </div>
          </div>
          <ProgressBar pct={w.weekRemaining < 0 ? 100 : w.weekAllowance > 0 ? (w.weekRemaining / w.weekAllowance) * 100 : 0} color={wColor} height={4} />
        </GlassCard>
      )}

      {/* Stats-rij: vandaag / inkomen / opnames + prognose / spaarstreak */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <StatCard label="Vandaag" value={fmt(s.todayTotal)} dim={s.todayTotal === 0} />
        <StatCard label="💚 Inkomen" onClick={onOpenInkomsten}
          value={s.hasRecurring ? fmt(s.recurringExpected) : s.totalManualIncome > 0 ? fmt(s.totalManualIncome) : '–'}
          tint={s.hasRecurring || s.totalManualIncome > 0 ? '#34D399' : undefined}
          sub={s.hasRecurring ? 'VERWACHT' : undefined} />
        <StatCard label="🏦 Opnames" onClick={s.savingsWithdrawals.length > 0 ? onOpenInkomsten : undefined}
          value={s.savingsWithdrawals.length > 0 ? `${s.savingsWithdrawals.length}× ${fmtShort(s.savingsTotal)}` : '–'}
          tint={s.savingsWithdrawals.length > 0 ? '#F87171' : undefined} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3.5">
        <StatCard label="Prognose"
          value={s.projectedTotal === null ? 'Geen data' : fmtShort(s.projectedTotal)}
          tint={s.projectedTotal === null ? undefined : s.projectedOver ? '#F87171' : '#34D399'}
          sub={s.projectedTotal === null ? undefined : s.projectedOver ? `⚠ +${fmtShort(s.projectedTotal - s.adjustedBase)}` : '✓ Op schema'} />
        <StatCard label="Spaarstreak" value={`${s.spaarStreak}d`}
          tint={s.spaarStreak < 3 ? '#F87171' : '#34D399'}
          sub={s.spaarStreak < 3 ? '🔓 Recent' : '🔒 Geen opname'} />
      </div>

      {/* Spaarwaarschuwingen */}
      {s.savingsWithdrawals.length > 0 && (
        <div className="px-4 py-3.5 rounded-2xl bg-red-400/[0.06] border border-red-400/25 mb-2.5 flex items-center gap-2.5 backdrop-blur-lg">
          <AlertTriangle size={18} color="#F87171" className="shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-red-400 m-0 mb-0.5">
              Je hebt {s.savingsWithdrawals.length}× van je spaarrekening gehaald deze maand
            </p>
            <p className="text-[12px] text-red-400/70 m-0">Totaal: {fmt(s.savingsTotal)}</p>
          </div>
        </div>
      )}
      {s.savingsExpenses.length > 0 && (
        <div className="px-4 py-3.5 rounded-2xl bg-amber-400/[0.05] border border-amber-400/25 mb-2.5 backdrop-blur-lg">
          <p className="text-[13px] font-bold text-amber-400 m-0 mb-0.5">
            🏦 {s.savingsExpenses.length === 1 ? '1 noodaankoop' : `${s.savingsExpenses.length} noodaankopen`} van spaarrekening — {fmt(s.savingsExpTotal)}
          </p>
          <p className="text-[12px] text-amber-400/60 m-0">Noodzakelijk, maar probeer dit te vermijden — zie alle uitgaven voor details</p>
        </div>
      )}

      {/* Analyse-knop */}
      {s.regularExpenses.length > 0 && (
        <button onClick={onOpenAnalyse}
          className="w-full mb-3.5 px-4 py-3.5 rounded-2xl bg-white/[0.05] backdrop-blur-lg border border-white/10 text-white/70 cursor-pointer text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.985] transition-transform">
          <BarChart3 size={15} className="text-teal-300" /> Analyse van deze maand
        </button>
      )}

      {/* Recente transacties */}
      {s.allTransactions.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel className="!mb-0">Recent</SectionLabel>
            <button onClick={onOpenUitgaven} className="text-[12px] text-teal-300 bg-transparent border-none cursor-pointer p-0 font-semibold">
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
  if (parts.length > 1) parts.push(`= ${fmt(s.adjustedBase)}`)
  return parts.length > 1 ? parts.join(' − ') : `Budget: ${fmt(s.adjustedBase)}`
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

function StatCard({ label, value, sub, tint, dim, onClick }: {
  label: string
  value: string
  sub?: string
  tint?: string
  dim?: boolean
  onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      className={`px-3.5 py-3 rounded-2xl backdrop-blur-lg border ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
      style={tint
        ? { background: `${tint}10`, borderColor: `${tint}40` }
        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] uppercase tracking-[0.06em] font-semibold mb-1"
        style={{ color: tint || 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="text-[17px] font-bold m-0 leading-tight tabular-nums"
        style={{ color: dim ? 'rgba(255,255,255,0.3)' : tint || 'rgba(255,255,255,0.9)' }}>{value}</p>
      {sub && <p className="text-[9px] font-semibold m-0 mt-0.5" style={{ color: tint ? `${tint}99` : 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  )
}
