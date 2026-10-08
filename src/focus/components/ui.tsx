import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { ChevronDown, Star } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { KIND_BY_ID } from '../lib/meta'
import type { SessionKind } from '../types'

/**
 * Indeling van de Focus-tab, op basis van de breedte van het Focus-vlak (niet het venster — de Dash-zijbalk telt mee):
 * desktop (≥ 1024px) = zijbalk + kolommen, panel (≥ 1360px) = ook een vast timerpaneel rechts.
 */
export const FX_DESKTOP = 1024
export const FX_PANEL = 1360
export const FxLayoutContext = createContext({ desktop: false, panel: false })
export const useFxLayout = () => useContext(FxLayoutContext)

/** Thema van de Focus-tab: 'auto' volgt het systeem */
export function useFxTheme() {
  const pref = useFocusStore(s => s.theme)
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return pref === 'auto' ? (sysDark ? 'dark' : 'light') : pref
}

/** Slide-up sheet in de Focus-stijl; rendert in een portal met hetzelfde thema */
export function Sheet({ onClose, children, full = false, label }: { onClose: () => void; children: ReactNode; full?: boolean; label?: string }) {
  const theme = useFxTheme()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return ReactDOM.createPortal(
    <div className="fx fx-sheet-root" data-theme={theme} style={{ background: 'transparent', height: 'auto', overflow: 'visible' }}>
      <div className="fx-sheet-backdrop" onClick={onClose} />
      <div className={`fx-sheet${full ? ' is-full' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {!full && <div className="fx-grabber" />}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetHead({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  return (
    <div className="fx-sheet-head">
      <div style={{ minWidth: 42 }}>{left}</div>
      <h3>{title}</h3>
      <div style={{ minWidth: 42, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}

/** Kleine keuzelijst zoals "7 dagen ⌄" en "Altijd ⌄" */
export function Dropdown<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div className="fx-dropdown" ref={ref}>
      <button type="button" className="fx-dropbtn" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label}>
        {options.find(o => o.id === value)?.label} <ChevronDown size={18} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="fx-menu" role="menu">
          {options.map(o => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={o.id === value} onClick={() => { onChange(o.id); setOpen(false) }}>
              {o.label}{o.id === value && <span style={{ color: 'var(--fx-orange)' }}>●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** ⋯-menu met acties */
export function ActionMenu({ trigger, items }: { trigger: ReactNode; items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div className="fx-dropdown" ref={ref}>
      <span onClick={() => setOpen(o => !o)}>{trigger}</span>
      {open && (
        <div className="fx-menu" role="menu">
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'is-danger' : ''} onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Stars({ value, size = 15 }: { value: number | null; size?: number }) {
  const v = Math.round(value || 0)
  return (
    <span className="fx-stars" aria-label={value ? `${v} van 5 sterren` : 'Niet beoordeeld'}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} style={{ width: size, height: size }} fill={i <= v ? 'currentColor' : 'none'} strokeWidth={1.6} />
      ))}
    </span>
  )
}

export function RateInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="fx-rate" role="radiogroup" aria-label="Focus-score">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} ster${i > 1 ? 'ren' : ''}`}
          className={value != null && i <= value ? 'is-on' : ''} onClick={() => onChange(i)}>
          <Star fill={value != null && i <= value ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  )
}

export function KindIcon({ kind, color, size = 48 }: { kind: SessionKind | null; color?: string; size?: number }) {
  const k = kind ? KIND_BY_ID[kind] : null
  const Icon = k?.Icon
  return (
    <span className="fx-kind-icon" style={{ color: color || k?.color || '#8E8E93', width: size, height: size, borderRadius: size * 0.3 }}>
      {Icon ? <Icon size={size * 0.42} strokeWidth={2.2} /> : <span style={{ width: size * 0.3, height: size * 0.3, borderRadius: '50%', background: 'currentColor' }} />}
    </span>
  )
}

export function Delta({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return null
  const up = value >= 0
  return <span className={up ? 'fx-up' : 'fx-down'} title={suffix}>{up ? '↑' : '↓'} {Math.abs(Math.round(value))}%</span>
}
