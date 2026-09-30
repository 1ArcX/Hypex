import type { Expense } from '../types'
import { monthStartOf, monthEndOf, todayStr, pad2, fmtDay } from '../lib/format'

const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

// Kalender-heatmap: hoeveel je per dag uitgaf, kleur naar verhouding.
// Met onDayClick zijn verstreken dagen aanklikbaar (→ uitgaven van die dag).
export function DayHeatmap({ budgetExpenses, selYear, selMonth, onDayClick }: {
  budgetExpenses: Expense[]
  selYear: number
  selMonth: number
  onDayClick?: (iso: string) => void
}) {
  const daysInSelMonth = new Date(selYear, selMonth + 1, 0).getDate()
  const todayISO = todayStr()

  const spentPerDay: Record<string, number> = {}
  budgetExpenses.forEach(e => {
    if (e.date >= monthStartOf(selYear, selMonth) && e.date <= monthEndOf(selYear, selMonth)) {
      spentPerDay[e.date] = (spentPerDay[e.date] || 0) + Number(e.amount)
    }
  })
  const dayValues = Object.values(spentPerDay).filter(v => v > 0)
  const maxDaySpend = dayValues.length > 0 ? Math.max(...dayValues) : 1

  const rawFirstDay = new Date(selYear, selMonth, 1).getDay() // 0=zo
  const firstOffset = (rawFirstDay + 6) % 7 // ma-eerst

  const cells: (number | null)[] = []
  for (let i = 0; i < firstOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInSelMonth; d++) cells.push(d)

  const isoOf = (d: number) => `${selYear}-${pad2(selMonth + 1)}-${pad2(d)}`
  const cellColor = (d: number) => {
    const iso = isoOf(d)
    if (iso > todayISO) return 'rgba(255,255,255,0.03)'
    const spent = spentPerDay[iso] || 0
    if (spent === 0) return 'rgba(255,255,255,0.05)'
    const ratio = spent / maxDaySpend
    if (ratio < 0.25) return 'color-mix(in srgb, var(--accent) 18%, transparent)'
    if (ratio < 0.5) return 'rgba(250,204,21,0.35)'
    if (ratio < 0.75) return 'rgba(249,115,22,0.5)'
    return 'rgba(248,113,113,0.7)'
  }

  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {DAY_HEADERS.map(h => (
        <div key={h} className="text-center text-[9px] font-bold text-white/30 uppercase tracking-wide pb-1">{h}</div>
      ))}
      {cells.map((d, idx) => {
        if (d === null) return <div key={`e${idx}`} />
        const iso = isoOf(d)
        const isFuture = iso > todayISO
        const isToday = iso === todayISO
        const clickable = !!onDayClick && !isFuture
        const content = (
          <>
            <span className={`text-[11px] leading-none ${isToday ? 'font-bold' : ''} ${isFuture ? 'text-white/30' : 'text-white/60'}`}>{d}</span>
            {!isFuture && (spentPerDay[iso] || 0) > 0 && (
              <span className="text-[8px] leading-none text-white/55 tabular-nums">€{Math.round(spentPerDay[iso])}</span>
            )}
          </>
        )
        const cls = `h-9 rounded-lg flex flex-col items-center justify-center gap-px ${isToday ? 'ring-1 ring-accent' : ''} ${isFuture ? 'opacity-30' : ''}`
        return clickable ? (
          <button key={d} type="button" onClick={() => onDayClick!(iso)}
            aria-label={`Uitgaven op ${fmtDay(iso)}`}
            className={`${cls} border-none p-0 cursor-pointer transition-[filter] hover:brightness-150 active:scale-95`}
            style={{ background: cellColor(d) }}>
            {content}
          </button>
        ) : (
          <div key={d} className={cls} style={{ background: cellColor(d) }}>{content}</div>
        )
      })}
    </div>
  )
}
