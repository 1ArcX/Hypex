import { toneColor, tint } from './tone'

/**
 * Basis-kaart (v2): oppervlak + hairline, geen glow in rust.
 * - tone:        tint de kaart in een semantische/categorie-kleur
 * - urgent:      rode tint + subtiele statische gloed
 * - interactive: hover-verhoging (gebruik samen met onClick)
 * - pad:         padding in px (default 16)
 * - glow:        Spotify-achtige gekleurde, wazige achtergrond in deze kleur (tone-naam of CSS-kleur)
 */
export function Card({ as: Tag = 'div', tone, urgent, interactive, glow, pad = 16, className = '', style, children, ...rest }) {
  const cls = ['card', urgent && 'card-urgent', tone && !urgent && 'card-tone', interactive && 'card-interactive', glow && 'glow-card', className]
    .filter(Boolean).join(' ')
  return (
    <Tag className={cls} style={{ padding: pad, ...(tone ? { '--tone': toneColor(tone) } : null), ...(glow ? { '--glow': toneColor(glow) } : null), ...style }} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * Kaartkop: icoon + titel (+ telling) links, actie rechts.
 * `action` is vrije JSX (knop/link); `tone` kleurt icoon en titel.
 */
export function CardHeader({ icon: Icon, title, count, tone, action, style }) {
  const color = tone ? toneColor(tone) : 'var(--c-text)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, minHeight: 24, ...style }}>
      {Icon && <Icon size={15} style={{ color: tone ? color : 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />}
      <h3 className="t-card" style={{ margin: 0, color, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
        {count != null && (
          <span className="tnum" style={{ marginLeft: 6, color: tone ? tint(tone, 80) : 'var(--c-text-3)', fontWeight: 600 }}>({count})</span>
        )}
      </h3>
      {action}
    </div>
  )
}

/** Link-achtige kaartactie: "Bekijk alles →" */
export function CardLink({ children, onClick, ...rest }) {
  return (
    <button type="button" onClick={onClick}
      style={{ background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
      {...rest}>
      {children}
    </button>
  )
}
