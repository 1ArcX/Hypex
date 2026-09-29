import { toneColor } from './tone'

/**
 * Compacte lijstrij: Wat? — Wanneer? — Status? — Actie?
 *   [dot] Titel                 [trailing pill(s)] [action]
 *         subtitel (1 regel)
 * - dot:      kleur of tone voor de stip (weglaten = geen stip)
 * - leading:  vrije JSX links i.p.v. een stip (bv. checkbox)
 * - trailing: pills / meta rechts
 * - action:   knop helemaal rechts (klikken erop triggert onClick van de rij niet)
 * - done:     doorgestreept + gedimd
 */
export function ListRow({ dot, leading, title, subtitle, trailing, action, onClick, done, active, style, titleStyle }) {
  const interactive = !!onClick
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e) } } : undefined}
      className={interactive ? 'ui-row ui-row--interactive' : 'ui-row'}
      data-active={active ? 'true' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 38, padding: '7px 10px',
        borderRadius: 'var(--r-sm)', background: 'var(--c-surface-2)',
        opacity: done ? 0.55 : 1, minWidth: 0,
        ...style,
      }}
    >
      {leading}
      {!leading && dot && (
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: toneColor(dot), flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-body)', fontWeight: 500, color: 'var(--c-text)', lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: done ? 'line-through' : 'none', ...titleStyle,
        }}>{title}</div>
        {subtitle && (
          <div className="t-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      {trailing && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{trailing}</div>}
      {action && <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

/** Ronde afvink-knop voor taakrijen. */
export function CheckButton({ checked, onChange, label, tone = 'accent' }) {
  const color = toneColor(tone)
  return (
    <button type="button" aria-label={label} aria-pressed={!!checked} onClick={e => { e.stopPropagation(); onChange?.(!checked) }}
      style={{
        width: 20, height: 20, borderRadius: 'var(--r-xs)', flexShrink: 0, cursor: 'pointer', padding: 0,
        border: `1.5px solid ${checked ? color : 'var(--c-border-strong)'}`,
        background: checked ? color : 'transparent', color: 'var(--on-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--t-fast) ease',
      }}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
      )}
    </button>
  )
}
