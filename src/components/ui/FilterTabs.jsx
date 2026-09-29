import { toneColor, tint } from './tone'

/**
 * Filter-pills / segmented control met optionele tellingen.
 * items: [{ value, label, count?, tone? }]
 * variant: 'pills' (Taken-filters) | 'segmented' (Dag/Week/Maand)
 */
export function FilterTabs({ items, value, onChange, variant = 'pills', label, wrap = false, style }) {
  const segmented = variant === 'segmented'
  return (
    <div role="tablist" aria-label={label} style={{
      display: 'flex', gap: segmented ? 2 : 6, alignItems: 'center', minWidth: 0,
      ...(wrap ? { flexWrap: 'wrap' } : { overflowX: 'auto', scrollbarWidth: 'none' }),
      ...(segmented ? { padding: 2, borderRadius: 'var(--r-sm)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' } : null),
      ...style,
    }}>
      {items.map(it => {
        const active = it.value === value
        const tone = it.tone && it.tone !== 'accent' ? it.tone : null
        const countColor = tone ? toneColor(tone) : active ? 'var(--on-accent)' : 'var(--c-text-3)'
        return (
          <button key={it.value} type="button" role="tab" aria-selected={active} onClick={() => onChange(it.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer',
              height: segmented ? 26 : 28, padding: segmented ? '0 10px' : '0 11px',
              borderRadius: segmented ? 6 : 'var(--r-sm)', fontSize: 12, fontWeight: active ? 700 : 500,
              border: segmented ? 'none' : `1px solid ${active ? 'transparent' : 'var(--c-border)'}`,
              background: active ? (segmented ? 'var(--c-surface-3)' : 'var(--accent)') : segmented ? 'transparent' : 'var(--c-surface)',
              color: active ? (segmented ? 'var(--c-text)' : 'var(--on-accent)') : 'var(--c-text-2)',
              transition: 'background var(--t-fast) ease, color var(--t-fast) ease',
            }}>
            {it.label}
            {it.count != null && (
              <span className="tnum" style={{
                fontSize: 11, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: countColor,
                background: active && !segmented ? 'color-mix(in srgb, var(--on-accent) 15%, transparent)' : tone ? tint(tone, 16) : 'var(--c-surface-2)',
              }}>{it.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
