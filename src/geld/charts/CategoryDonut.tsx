import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { CategoryConfig } from '../types'
import { fmtShort } from '../lib/format'

export type CatSpend = CategoryConfig & { spent: number }

// Donut van uitgaven per categorie (Recharts)
export function CategoryDonut({ data, totalSpent }: { data: CatSpend[]; totalSpent: number }) {
  if (data.length === 0) {
    return <p className="text-[12px] text-white/30 text-center my-5">Geen data</p>
  }
  return (
    <>
      <div className="relative h-[130px] mb-2.5">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="spent" nameKey="label"
              innerRadius="68%" outerRadius="100%"
              startAngle={90} endAngle={-270}
              stroke="none" paddingAngle={2} isAnimationActive={false}>
              {data.map(cat => <Cell key={cat.id} fill={cat.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[14px] font-bold text-white/90 tabular-nums">{fmtShort(totalSpent)}</span>
          <span className="text-[9px] text-white/35">totaal</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {data.map(cat => (
          <div key={cat.id} className="flex items-center gap-1.5">
            <div className="w-[7px] h-[7px] rounded-sm shrink-0" style={{ background: cat.color }} />
            <span className="text-[9px] text-white/40 flex-1 truncate">{cat.emoji} {cat.label.split(' ')[0]}</span>
            <span className="text-[9px] text-white/60 font-semibold tabular-nums">
              {Math.round((cat.spent / totalSpent) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
