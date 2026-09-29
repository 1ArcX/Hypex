/** Rustige lege staat: icoon + tekst (+ optionele actie). */
export function EmptyState({ icon: Icon, title, text, action, compact, style }) {
  return (
    <div style={{ textAlign: 'center', padding: compact ? '14px 8px' : '28px 16px', color: 'var(--c-text-3)', ...style }}>
      {Icon && <Icon size={compact ? 18 : 22} aria-hidden="true" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }} />}
      {title && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)' }}>{title}</p>}
      {text && <p style={{ margin: title ? '4px 0 0' : 0, fontSize: 12, lineHeight: 1.5 }}>{text}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  )
}
