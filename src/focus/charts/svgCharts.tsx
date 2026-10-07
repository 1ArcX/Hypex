import { useId } from 'react'
import { fmtDec } from '../lib/format'
import { ORANGE } from '../lib/meta'

/** Voortgangsring per onderwerp ("63% · 6u/9u"); vol = groene gloed */
export function TopicRing({ mins, target, name, size = 150 }: { mins: number; target: number; name: string; size?: number }) {
  const id = useId()
  const pct = target > 0 ? mins / target : 0
  const done = pct >= 1
  const R = 58, C = 2 * Math.PI * R
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox="0 0 150 150" width={size} height={size} style={{ overflow: 'visible', filter: done ? 'drop-shadow(0 0 12px rgba(47,180,99,0.55))' : undefined }} aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={done ? '#5AD27D' : '#F58A2C'} />
              <stop offset="100%" stopColor={done ? '#2FB463' : '#FB7185'} />
            </linearGradient>
          </defs>
          <circle cx="75" cy="75" r={R} fill="none" stroke="var(--fx-line-2)" strokeWidth="14" />
          <circle cx="75" cy="75" r={R} fill="none" stroke={`url(#${id})`} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, pct))} transform="rotate(-90 75 75)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <b className="tnum" style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(pct * 100)}%</b>
          <span className="tnum" style={{ fontSize: 14, color: 'var(--fx-text-2)' }}>{fmtDec(mins / 60)}u/{fmtDec(target / 60)}u</span>
        </div>
      </div>
      <span style={{ fontSize: 16, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{name}</span>
    </div>
  )
}

const hourLabel = (h: number) => `${h}u`

/** "Wanneer je studeert": 24-uurs radiale klok met het piekvenster in het midden */
export function RadialClock({ hist, peak }: { hist: number[]; peak: { start: number; end: number; share: number } }) {
  const max = Math.max(...hist, 1)
  const cx = 160, cy = 160, inner = 52, outerMax = 140
  const inPeak = (h: number) => peak.start <= peak.end ? h >= peak.start && h < peak.end : h >= peak.start || h < peak.end
  const wedge = (h: number, len: number) => {
    const a0 = ((h / 24) * 360 - 90 + 1.2) * Math.PI / 180
    const a1 = (((h + 1) / 24) * 360 - 90 - 1.2) * Math.PI / 180
    const r0 = inner + 6, r1 = r0 + len
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
  }
  return (
    <svg viewBox="0 0 320 320" style={{ width: '100%', maxWidth: 360, display: 'block', margin: '0 auto' }} role="img"
      aria-label={`Piek tussen ${peak.start} en ${peak.end} uur, ${Math.round(peak.share * 100)}% van je studietijd`}>
      {/* uurstippen */}
      {Array.from({ length: 24 }, (_, h) => {
        const a = ((h / 24) * 360 - 90) * Math.PI / 180
        return <circle key={h} cx={cx + 150 * Math.cos(a)} cy={cy + 150 * Math.sin(a)} r={h % 6 === 0 ? 2.4 : 1.3} fill="var(--fx-text-3)" />
      })}
      {[0, 6, 12, 18].map(h => {
        const a = ((h / 24) * 360 - 90) * Math.PI / 180
        const r = 132
        return <text key={h} x={cx + r * Math.cos(a)} y={cy + r * Math.sin(a) + 4} textAnchor="middle" fontSize="12" fill="var(--fx-text-2)">{hourLabel(h)}</text>
      })}
      {hist.map((m, h) => m > 0 && (
        <path key={h} d={wedge(h, Math.max(6, (m / max) * (outerMax - inner - 20)))}
          fill={ORANGE} fillOpacity={inPeak(h) ? 0.95 : 0.25 + 0.45 * (m / max)} />
      ))}
      <circle cx={cx} cy={cy} r={inner} fill="var(--fx-bg)" stroke="var(--fx-text-3)" strokeDasharray="3 4" />
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--fx-text)">{peak.start}–{peak.end || 24}u</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="13" fill="var(--fx-text-2)">{Math.round(peak.share * 100)}%</text>
    </svg>
  )
}
