import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function pad2(n) { return String(n).padStart(2, '0') }
function fmt(n) { return `€${Number(n).toFixed(2).replace('.', ',')}` }
function fmtShort(n) {
  const abs = Math.abs(n)
  return `${n < 0 ? '-' : ''}€${abs < 10 ? abs.toFixed(2).replace('.', ',') : Math.round(abs)}`
}

// Geeft de vrijdag van de huidige week (begin van de week)
function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=zo, 1=ma, ..., 5=vr, 6=za
  // Dagen terug naar vrijdag
  const daysBack = day === 5 ? 0 : day === 6 ? 1 : day + 3
  const fri = new Date(now)
  fri.setDate(now.getDate() - daysBack)
  fri.setHours(0, 0, 0, 0)
  const thu = new Date(fri)
  thu.setDate(fri.getDate() + 6)
  thu.setHours(23, 59, 59, 999)

  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
  return { start: toISO(fri), end: toISO(thu), fri, thu }
}

function getDayLabel(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function WeekBudgetWidget({ userId, onNavigateToGeld }) {
  const [weekSpent, setWeekSpent]   = useState(0)
  const [weekBudget, setWeekBudget] = useState(null)
  const [loading, setLoading]       = useState(true)
  const { start, end, fri, thu }    = getWeekBounds()

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const [expRes, cfgRes] = await Promise.all([
        supabase.from('expenses').select('amount, is_savings_contribution, is_loan_repayment, is_savings_withdrawal, is_income, paid_from_savings, category, is_planned, date')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end),
        supabase.from('budget_config').select('monthly_budget, min_balance').eq('user_id', userId).single(),
      ])
      const exps = expRes.data || []
      const spent = exps
        .filter(e => !e.is_income && !e.is_savings_withdrawal && !e.is_savings_contribution && !e.is_loan_repayment && !e.paid_from_savings && e.category !== 'abonnementen' && (!e.is_planned || e.amount > 0))
        .reduce((s, e) => s + Number(e.amount), 0)
      setWeekSpent(Math.round(spent * 100) / 100)

      // Weekbudget = maandbudget / 4.33 afgerond op €5
      const monthly = cfgRes.data?.monthly_budget || 400
      const raw = monthly / 4.33
      setWeekBudget(Math.floor(raw / 5) * 5)
      setLoading(false)
    }
    load()
  }, [userId, start, end])

  if (loading || weekBudget === null) return null

  const remaining  = Math.round((weekBudget - weekSpent) * 100) / 100
  const pct        = Math.max(0, Math.min(100, (remaining / weekBudget) * 100))
  const isOver     = remaining < 0
  const isWarning  = !isOver && pct < 25
  const color      = isOver ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981'
  const daysLeft   = Math.round((thu - new Date()) / 86400000)

  return (
    <div
      onClick={onNavigateToGeld}
      style={{
        padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
        background: isOver ? 'rgba(239,68,68,0.07)' : isWarning ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.06)',
        border: `1px solid ${isOver ? 'rgba(239,68,68,0.25)' : isWarning ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 10, color, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
            💳 Weekbudget · {getDayLabel(start)} – {getDayLabel(end)}
          </p>
          <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>
            {fmtShort(remaining)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '3px 0 0' }}>
            {isOver ? `${fmt(Math.abs(remaining))} over budget` : `nog over · ${daysLeft} dag${daysLeft !== 1 ? 'en' : ''} resterend`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 2px' }}>Uitgegeven</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{fmt(weekSpent)}</p>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>van {fmt(weekBudget)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${isOver ? 100 : pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}
