import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, categoryColor, categoryLabel } from '../../utils/category'
import { useItemTypes, addItemType } from '../../hooks/useItemTypes'

export const TYPE_SWATCHES = ['#FACC15', '#F43F5E', '#FF8C42', '#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#00FFD1', '#94A3B8']

/**
 * Type-keuze (School/Werk/… + eigen types) met kleurstip. `value` / `onChange` werken met een
 * categorie-waarde (key van een ingebouwd type of id van een eigen type), zie utils/category.js.
 */
export function TypeSelect({ value, onChange, label = 'Type', allowCreate = true, compact = false, style }) {
  const { available } = useItemTypes() // her-renderen als types veranderen
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TYPE_SWATCHES[4])
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const place = () => {
      const r = btnRef.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      const h = Math.min(320, 44 + CATEGORY_ORDER.length * 36 + (allowCreate ? 90 : 0))
      setPos({ left: r.left, width: Math.max(r.width, 220), top: below > h + 8 ? r.bottom + 4 : Math.max(8, r.top - h - 4) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, allowCreate])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false); setCreating(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setCreating(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open])

  const pick = (cat) => { onChange?.(cat); setOpen(false); setCreating(false) }

  const create = async () => {
    const name = newName.trim()
    if (!name) return
    const t = await addItemType({ name, color: newColor })
    if (t) { pick(t.id); setNewName('') }
  }

  const cur = CATEGORIES[value] ? value : null
  return (
    <>
      <button ref={btnRef} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${cur ? categoryLabel(cur) : 'kies'}`}
        onClick={() => setOpen(o => !o)}
        className="glass-input"
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: compact ? 'auto' : '100%', cursor: 'pointer', textAlign: 'left', ...style }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: cur ? categoryColor(cur) : 'var(--c-text-3)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: cur ? 'var(--c-text)' : 'var(--c-text-3)' }}>
          {cur ? categoryLabel(cur) : 'Kies een type'}
        </span>
        <ChevronDown size={14} aria-hidden="true" style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
      </button>
      {open && pos && createPortal(
        <div ref={popRef} role="listbox" aria-label={label}
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 10050, maxHeight: 320, overflowY: 'auto',
            background: 'var(--c-surface-solid)', border: '1px solid var(--c-border-strong)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-float)', padding: 4 }}>
          {CATEGORY_ORDER.map(cat => {
            const sel = cat === cur
            return (
              <button key={cat} type="button" role="option" aria-selected={sel} onClick={() => pick(cat)}
                className="ui-row--interactive"
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 'var(--r-sm)',
                  background: sel ? 'var(--c-surface-3)' : 'transparent', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: categoryColor(cat), flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{categoryLabel(cat)}</span>
                {sel && <Check size={13} aria-hidden="true" style={{ color: 'var(--accent)' }} />}
              </button>
            )
          })}
          {allowCreate && available && (
            <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 4, paddingTop: 4 }}>
              {!creating ? (
                <button type="button" onClick={() => setCreating(true)}
                  className="ui-row--interactive"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 'var(--r-sm)', background: 'transparent', color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}>
                  <Plus size={13} aria-hidden="true" /> Nieuw type
                </button>
              ) : (
                <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input autoFocus className="glass-input" placeholder="Naam (bv. Sport)" value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); create() } }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TYPE_SWATCHES.map(c => (
                      <button key={c} type="button" aria-label={`Kleur ${c}`} onClick={() => setNewColor(c)}
                        style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '2px solid white' : '2px solid transparent' }} />
                    ))}
                  </div>
                  <button type="button" className="btn-primary" disabled={!newName.trim()} onClick={create} style={{ padding: '6px 10px', fontSize: 12, opacity: newName.trim() ? 1 : 0.5 }}>
                    Toevoegen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>,
        document.body)}
    </>
  )
}
