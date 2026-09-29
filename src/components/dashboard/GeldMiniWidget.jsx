import React from 'react'
import { Wallet, ArrowRight } from 'lucide-react'
import { CardHeader, IconButton, ProgressBar } from '../ui'
import { useExpenses } from '../../geld/hooks/useExpenses'
import { useBudgetConfig } from '../../geld/hooks/useBudgetConfig'
import { useYearExpenses } from '../../geld/hooks/useYearExpenses'
import { useBudgetStats } from '../../geld/hooks/useBudgetStats'
import { useMonthNav } from '../../geld/hooks/useMonthNav'
import { fmt } from '../../geld/lib/format'

// Dashboard-widget "Geld" (admin): exact dezelfde berekening als de Geld-pagina
// (useBudgetStats), alleen compacter. Alleen lezen — geen mutaties.
export default function GeldMiniWidget({ userId, onOpen }) {
  const { isCurrentMonth, monthLabel } = useMonthNav()
  const { expenses, prevExpenses, loading } = useExpenses(userId)
  const { config, loading: configLoading } = useBudgetConfig(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const s = useBudgetStats({ expenses, prevExpenses, yearExpenses, config })

  const busy = loading || configLoading
  const over = s.adjustedRemaining < 0
  const tone = over || s.adjustedRemainPct < 15 ? 'danger' : s.adjustedRemainPct < 40 ? 'warning' : 'accent'

  return (
    <div className="card" style={{ padding: 14, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <CardHeader icon={Wallet} title="Geld"
        action={<IconButton icon={ArrowRight} label="Open Geld" onClick={onOpen} size={26} />} />
      {busy ? (
        <p className="t-meta" style={{ margin: 0 }}>Laden…</p>
      ) : !config ? (
        <p className="t-meta" style={{ margin: 0 }}>Nog geen budget ingesteld.</p>
      ) : (
        <>
          <p className="t-kpi" style={{ margin: 0, color: over ? 'var(--c-danger)' : 'var(--c-text)' }}>
            {over ? '−' : ''}{fmt(Math.abs(s.adjustedRemaining))}
          </p>
          <p className="t-meta" style={{ margin: '2px 0 12px' }}>
            {over ? 'Budget overschreden' : isCurrentMonth ? 'Nog deze maand' : `Nog over · ${monthLabel}`}
          </p>
          <ProgressBar value={100 - s.adjustedRemainPct} max={100} tone={tone} height={5} label="Deel van het budget uitgegeven" style={{ marginTop: 'auto' }} />
          <p className="t-meta tnum" style={{ margin: '6px 0 0', textAlign: 'right' }}>
            {fmt(s.totalSpent)} / {fmt(s.adjustedBase)}
          </p>
        </>
      )}
    </div>
  )
}
