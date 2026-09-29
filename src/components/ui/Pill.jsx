import { toneColor, tint } from './tone'

/**
 * Compacte pill/badge voor datum, status, telling of tag.
 * tone: 'neutral' | 'accent' | 'danger' | 'warning' | 'success' | 'info' | categorie | losse kleur
 * dot:  toon een gekleurde stip vóór de tekst (voor tags/categorieën)
 */
export function Pill({ tone = 'neutral', dot, solid, children, title, style }) {
  const color = toneColor(tone)
  const neutral = tone === 'neutral'
  return (
    <span title={title} className="t-badge tnum" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      height: 20, padding: '0 7px', borderRadius: 'var(--r-xs)', whiteSpace: 'nowrap',
      background: solid ? color : neutral ? 'var(--c-surface-2)' : tint(tone, 14),
      color: solid ? 'var(--on-accent)' : neutral ? 'var(--c-text-2)' : color,
      border: `1px solid ${solid ? 'transparent' : neutral ? 'var(--c-border)' : tint(tone, 24)}`,
      ...style,
    }}>
      {dot && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />}
      {children}
    </span>
  )
}

/** Kleine teller-badge (bv. rood getal naast "Taken" in de sidebar). */
export function CountBadge({ count, tone = 'danger', label }) {
  if (!count) return null
  return (
    <span aria-label={label} className="tnum" style={{
      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-full)',
      background: toneColor(tone), color: '#fff', fontSize: 10, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
