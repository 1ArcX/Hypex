import React from 'react'
import { Wallet, ArrowRight } from 'lucide-react'
import { useExpenses } from '../../geld/hooks/useExpenses'
import { useBudgetConfig } from '../../geld/hooks/useBudgetConfig'
import { useYearExpenses } from '../../geld/hooks/useYearExpenses'
import { useBudgetStats } from '../../geld/hooks/useBudgetStats'
import { useMonthNav } from '../../geld/hooks/useMonthNav'
import { fmt } from '../../geld/lib/format'
import LionMark from './LionMark'

// Dashboard-widget "Geld" (admin), in ING-stijl (donkere kaart, oranje accenten, leeuw als watermerk; `.ing-card` in index.css):
// exact dezelfde berekening als de Geld-pagina (useBudgetStats), alleen compacter. Alleen lezen.
export default function GeldMiniWidget({ userId, onOpen }) {
  const { isCurrentMonth, monthLabel } = useMonthNav()
  const { expenses, prevExpenses, loading } = useExpenses(userId)
  const { config, loading: configLoading } = useBudgetConfig(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const s = useBudgetStats({ expenses, prevExpenses, yearExpenses, config })

  const busy = loading || configLoading
  const over = !busy && !!config && s.adjustedRemaining < 0
  const low = !over && s.adjustedRemainPct < 15
  const spentPct = Math.max(0, Math.min(100, 100 - s.adjustedRemainPct))

  return (
    <div className={`card ing-card${over ? ' is-over' : ''}`} style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <LionMark />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, minHeight: 24 }}>
        <Wallet size={15} aria-hidden="true" className="ing-label" />
        <h3 className="t-card" style={{ margin: 0, color: 'inherit', flex: 1 }}>Geld</h3>
        {low && <span className="ing-pill">Bijna op</span>}
        <button type="button" className="ing-btn" onClick={onOpen} aria-label="Open Geld"
          style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={15} />
        </button>
      </div>
      {busy ? (
        <p className="t-meta" style={{ margin: 0 }}>Laden…</p>
      ) : !config ? (
        <p className="t-meta" style={{ margin: 0 }}>Nog geen budget ingesteld.</p>
      ) : (
        <>
          <p className="tnum" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: over ? 'var(--c-danger)' : 'inherit' }}>
            {over ? '−' : ''}{fmt(Math.abs(s.adjustedRemaining))}
          </p>
          <p className="ing-sub" style={{ margin: '3px 0 14px', fontSize: 12 }}>
            {over ? 'Budget overschreden' : isCurrentMonth ? 'Nog te besteden deze maand' : `Nog over · ${monthLabel}`}
          </p>
          <div className={`ing-bar${low ? ' is-low' : ''}`} style={{ marginTop: 'auto' }}
            role="progressbar" aria-valuenow={Math.round(spentPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Deel van het budget uitgegeven">
            <span style={{ width: `${spentPct}%` }} />
          </div>
          <p className="ing-sub tnum" style={{ margin: '7px 0 0', fontSize: 11, textAlign: 'right' }}>
            {fmt(s.totalSpent)} van {fmt(s.adjustedBase)} uitgegeven
          </p>
        </>
      )}
    </div>
  )
}
