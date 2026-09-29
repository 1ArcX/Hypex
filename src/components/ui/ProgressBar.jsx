import { toneColor } from './tone'

/**
 * Dunne voortgangsbalk. value/max worden geklemd op 0–100%.
 * glow alleen voor Level-1 status (bv. lopende timer), niet standaard.
 */
export function ProgressBar({ value = 0, max = 100, tone = 'accent', height = 6, glow = false, label, style }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const color = toneColor(tone)
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}
      style={{ height, borderRadius: 'var(--r-full)', background: 'var(--c-surface-3)', overflow: 'hidden', ...style }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: 'inherit', background: color,
        transition: 'width 0.5s var(--ease)',
        boxShadow: glow && pct > 0 ? `0 0 10px color-mix(in srgb, ${color} 45%, transparent)` : 'none',
      }} />
    </div>
  )
}
