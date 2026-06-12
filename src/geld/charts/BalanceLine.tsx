import { LineChart, Line, ReferenceLine, ResponsiveContainer, YAxis, XAxis } from 'recharts'

// Saldoverloop over de maand: werkelijke lijn + gestippelde prognose (Recharts)
export function BalanceLine({ balanceByDay, dayOfMonth, daysInMonth, adjustedBase, totalSpent }: {
  balanceByDay: number[]
  dayOfMonth: number
  daysInMonth: number
  adjustedBase: number
  totalSpent: number
}) {
  const rate = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    return {
      d,
      actual: d <= dayOfMonth ? balanceByDay[i] : undefined,
      proj: d >= dayOfMonth && totalSpent > 0
        ? adjustedBase - totalSpent - rate * (d - dayOfMonth)
        : undefined,
    }
  })

  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 2, bottom: 4, left: 2 }}>
          <XAxis dataKey="d" hide />
          <YAxis hide domain={[Math.min(0, ...balanceByDay), Math.max(adjustedBase, balanceByDay[0] ?? adjustedBase)]} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
          <ReferenceLine y={adjustedBase} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <ReferenceLine x={dayOfMonth} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
          <Line type="monotone" dataKey="proj" stroke="#5EEAD4" strokeWidth={1.5} strokeOpacity={0.35}
            strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="actual" stroke="#5EEAD4" strokeWidth={2} dot={false}
            isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
