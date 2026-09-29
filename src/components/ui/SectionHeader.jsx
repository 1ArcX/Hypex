import { ChevronDown } from 'lucide-react'
import { toneColor } from './tone'

/**
 * Sectiekop voor gegroepeerde lijsten ("Urgent (2)", "Routines (2)").
 * Met `collapsible` wordt het een knop die `onToggle` aanroept.
 */
export function SectionHeader({ icon: Icon, title, count, tone = 'neutral', collapsible, open = true, onToggle, right, style }) {
  const color = tone === 'neutral' ? 'var(--c-text-2)' : toneColor(tone)
  const content = (
    <>
      {collapsible && (
        <ChevronDown size={14} aria-hidden="true" style={{ transition: 'transform var(--t-fast) ease', transform: open ? 'none' : 'rotate(-90deg)', color: 'var(--c-text-3)' }} />
      )}
      {Icon && <Icon size={14} aria-hidden="true" style={{ color }} />}
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
      {count != null && <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>({count})</span>}
    </>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 6px', ...style }}>
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={open}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'left' }}>
          {content}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>{content}</div>
      )}
      {right}
    </div>
  )
}
