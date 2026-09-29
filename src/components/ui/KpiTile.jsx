import { toneColor, tint } from './tone'

/**
 * KPI-tegel: getint rond icoon + groot getal + label (mockup paneel 1 & 5).
 * Bij value 0 wordt de tegel gedempt zodat alleen relevante KPI's opvallen.
 */
export function KpiTile({ icon: Icon, value, label, sub, tone = 'accent', onClick, dimWhenZero = true, style }) {
  const color = toneColor(tone)
  const dim = dimWhenZero && (value === 0 || value === '0')
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card ${onClick ? 'card-interactive' : ''} ${dim ? '' : 'card-tone'}`}
      style={{
        '--tone': color,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textAlign: 'left',
        font: 'inherit', color: 'inherit', width: '100%', minWidth: 0,
        ...style,
      }}
    >
      {Icon && (
        <span aria-hidden="true" style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: dim ? 'var(--c-surface-2)' : tint(tone, 16), color: dim ? 'var(--c-text-3)' : color,
        }}>
          <Icon size={17} />
        </span>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="t-kpi" style={{ color: dim ? 'var(--c-text-3)' : color }}>{value}</span>
        <span className="t-meta" style={{ color: dim ? 'var(--c-text-3)' : tint(tone, 85), marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {sub && <span className="t-meta" style={{ marginTop: 1 }}>{sub}</span>}
      </span>
    </Tag>
  )
}
