import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { fmtDur, fmtDec } from '../lib/format'
import type { VolumePoint, StreamSeries } from '../lib/stats'
import { ORANGE } from '../lib/meta'

const axisTick = { fill: 'var(--fx-text-2)', fontSize: 13 }

function TipBox({ title, lines }: { title: string; lines: { color?: string; label: string; value: string }[] }) {
  return (
    <div style={{ background: 'var(--fx-card)', border: '1px solid var(--fx-line-2)', borderRadius: 12, padding: '8px 12px', boxShadow: 'var(--fx-shadow)', fontSize: 13, color: 'var(--fx-text)' }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
      {lines.map(l => (
        <div key={l.label} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fx-text-2)' }}>
            {l.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />}{l.label}
          </span>
          <b className="tnum">{l.value}</b>
        </div>
      ))}
    </div>
  )
}

/** "Studievolume": oranje vlak met zachte gradient, zoals op het Overzicht van de app */
export function VolumeArea({ points }: { points: VolumePoint[] }) {
  const data = points.map(p => ({ ...p, h: p.mins / 60 }))
  return (
    <div className="fx-chart" aria-label="Studievolume grafiek">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fxVol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ORANGE} stopOpacity={0.32} />
              <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} dy={6} />
          <Tooltip cursor={{ stroke: 'var(--fx-line-2)' }}
            content={({ active, payload }) => active && payload?.length
              ? <TipBox title={String(payload[0].payload.label)} lines={[{ label: 'Gestudeerd', value: fmtDur(payload[0].payload.mins) }]} /> : null} />
          <Area type="monotone" dataKey="h" stroke={ORANGE} strokeWidth={2.5} fill="url(#fxVol)" isAnimationActive animationDuration={700}
            activeDot={{ r: 5, fill: ORANGE, stroke: 'var(--fx-bg)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** "Waar je tijd heen ging": gestapelde stroom per vak (silhouet, zoals de app) */
export function StreamByCourse({ buckets, series }: { buckets: Record<string, number | string>[]; series: StreamSeries[] }) {
  if (buckets.length < 2) buckets = [...buckets, ...buckets.map(b => ({ ...b, key: `${b.key}-2` }))]
  return (
    <div className="fx-chart is-tall" aria-label="Tijd per vak over tijd">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={buckets} stackOffset="silhouette" margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} dy={6} />
          <Tooltip cursor={{ stroke: 'var(--fx-line-2)' }}
            content={({ active, payload }) => active && payload?.length
              ? <TipBox title={String(payload[0].payload.label)} lines={series.filter(s => Number(payload[0].payload[s.id]) > 0).map(s => ({ color: s.color, label: s.name, value: `${fmtDec(Number(payload[0].payload[s.id]))}u` }))} />
              : null} />
          {[...series].reverse().map(s => (
            <Area key={s.id} type="basis" dataKey={s.id} stackId="1" stroke="none" fill={s.color} fillOpacity={0.95} isAnimationActive animationDuration={700} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Donut "Sessie-verdeling" met totaal in het midden */
export function KindDonut({ data, centerTop, centerBottom }: { data: { label: string; color: string; mins: number }[]; centerTop: string; centerBottom: string }) {
  const rows = data.length ? data : [{ label: 'leeg', color: 'var(--fx-line-2)', mins: 1 }]
  return (
    <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="mins" innerRadius={52} outerRadius={82} paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={8} stroke="none" startAngle={90} endAngle={-270} isAnimationActive animationDuration={700}>
            {rows.map(r => <Cell key={r.label} fill={r.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <b className="tnum" style={{ fontSize: 20, fontWeight: 800 }}>{centerTop}</b>
        <span style={{ fontSize: 13, color: 'var(--fx-text-2)' }}>{centerBottom}</span>
      </div>
    </div>
  )
}

/** Weekoverzicht: oranje staafjes per dag */
export function WeekBars({ days }: { days: { date: string; label: string; mins: number; future: boolean }[] }) {
  const data = days.map(d => ({ ...d, h: d.mins / 60 }))
  return (
    <div style={{ height: 120, margin: '10px -4px 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} dy={4} />
          <Tooltip cursor={{ fill: 'var(--fx-line)' }}
            content={({ active, payload }) => active && payload?.length
              ? <TipBox title={String(payload[0].payload.label)} lines={[{ label: 'Gestudeerd', value: fmtDur(payload[0].payload.mins) }]} /> : null} />
          <Bar dataKey="h" radius={[6, 6, 6, 6]} fill={ORANGE} fillOpacity={0.85} isAnimationActive animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
