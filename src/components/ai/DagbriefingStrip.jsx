import React, { useMemo } from 'react'
import { Flame, Clock3, CalendarClock, Wallet } from 'lucide-react'
import { todayISO } from '../../utils/recurrence'
import { isOverdue, isUrgent } from '../../utils/taskStatus'
import { buildUpcoming, countdownLabel } from '../../utils/upcoming'
import { useExpenses } from '../../geld/hooks/useExpenses'
import { useBudgetConfig } from '../../geld/hooks/useBudgetConfig'
import { useYearExpenses } from '../../geld/hooks/useYearExpenses'
import { useBudgetStats } from '../../geld/hooks/useBudgetStats'
import { useMonthNav } from '../../geld/hooks/useMonthNav'
import { fmt } from '../../geld/lib/format'
import { tint } from '../ui'

// Gestructureerde dagbriefing uit echte Hypex-data (geen AI): urgent, te laat,
// volgende afspraak en dagbudget. De AI-tekst eronder blijft de bestaande integratie.

function Tile({ icon: Icon, tone, label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={onClick ? 'card-interactive' : undefined}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)',
        background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', textAlign: 'left', minWidth: 0,
        font: 'inherit', color: 'inherit', cursor: onClick ? 'pointer' : 'default',
      }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint(tone, 16), color: `var(--c-${tone}, ${tone})` }}>
        <Icon size={14} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="t-meta" style={{ display: 'block' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        {sub && <span className="t-meta" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </Tag>
  )
}

function BudgetTile({ userId, onNavigate }) {
  const { isCurrentMonth } = useMonthNav()
  const { expenses, prevExpenses, loading } = useExpenses(userId)
  const { config, loading: configLoading } = useBudgetConfig(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const s = useBudgetStats({ expenses, prevExpenses, yearExpenses, config })
  const busy = loading || configLoading
  const left = s.dagBudget - s.todayTotal
  return (
    <Tile icon={Wallet} tone={left < 0 ? 'danger' : 'success'} label="Dagbudget"
      value={busy ? 'Laden…' : !config ? 'Geen budget' : isCurrentMonth ? `${left < 0 ? '−' : ''}${fmt(Math.abs(left))}` : '–'}
      sub={busy || !config ? undefined : `vandaag ${fmt(s.todayTotal)} uit`}
      onClick={onNavigate ? () => onNavigate('geld') : undefined} />
  )
}

export default function DagbriefingStrip({ tasks, calendarEvents = [], magisterLessons = [], userId, onNavigate, onNavigateToTasks, onNavigateToAgenda }) {
  const today = todayISO()
  const urgent = tasks.filter(isUrgent)
  const overdue = tasks.filter(t => isOverdue(t, today)).sort((a, b) => a.date.localeCompare(b.date))
  const next = useMemo(() => buildUpcoming({ tasks, calendarEvents, magisterLessons })[0] || null, [tasks, calendarEvents, magisterLessons])
  const hhmm = d => d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
      <Tile icon={Flame} tone="danger" label="Urgent" value={urgent.length ? `${urgent.length} ${urgent.length === 1 ? 'taak' : 'taken'}` : 'Niets urgent'}
        sub={urgent[0]?.title} onClick={onNavigateToTasks ? () => onNavigateToTasks('urgent') : undefined} />
      <Tile icon={Clock3} tone="warning" label="Te laat" value={overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'taak' : 'taken'}` : 'Niets te laat'}
        sub={overdue[0]?.title} onClick={onNavigateToTasks ? () => onNavigateToTasks('telaat') : undefined} />
      <Tile icon={CalendarClock} tone="info" label="Volgende afspraak"
        value={next ? next.label : 'Niets gepland'}
        sub={next ? `${countdownLabel(next.ts)} · ${hhmm(next.ts)}${next.location ? ` · ${next.location}` : ''}` : undefined}
        onClick={next && onNavigateToAgenda ? () => onNavigateToAgenda(next.ts, next.highlightKey) : undefined} />
      <BudgetTile userId={userId} onNavigate={onNavigate} />
    </div>
  )
}
