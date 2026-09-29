import { toneColor, tint } from './tone'

/**
 * Icoon-knop. `label` is verplicht (aria-label + tooltip) — toegankelijkheid.
 * variant: 'ghost' (transparant) | 'soft' (oppervlak) | 'solid' (accent-gevuld)
 */
export function IconButton({ icon: Icon, label, onClick, tone, variant = 'ghost', size = 30, iconSize = 15, disabled, style, ...rest }) {
  const color = tone ? toneColor(tone) : 'var(--c-text-2)'
  const bg = variant === 'solid' ? (tone ? color : 'var(--accent)')
    : variant === 'soft' ? (tone ? tint(tone, 12) : 'var(--c-surface-2)')
    : 'transparent'
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`ui-icon-btn ui-icon-btn--${variant}`}
      style={{
        width: size, height: size, flexShrink: 0, padding: 0, cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: variant === 'solid' ? '50%' : 'var(--r-sm)',
        border: variant === 'soft' ? `1px solid ${tone ? tint(tone, 25) : 'var(--c-border)'}` : '1px solid transparent',
        background: bg, color: variant === 'solid' ? 'var(--on-accent)' : color,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}>
      <Icon size={iconSize} aria-hidden="true" />
    </button>
  )
}
