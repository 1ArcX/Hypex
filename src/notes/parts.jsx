import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { preview } from './noteFormat'

// Gedeelde stukjes voor de Notities-app: datums/secties zoals Apple, afvinkrondje, menu, alert.

const DAY = 86400000
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }

export function noteTitle(note) {
  const t = (note?.title || '').trim()
  if (t) return t
  const first = String(note?.content || '').split('\n').map(l => l.replace(/^(- \[[ xX]\] |# |[-•*] |\d+[.)] )/, '').trim()).find(Boolean)
  return first || 'Nieuwe notitie'
}

/** Voorbeeldregel onder de titel (zonder de regel die al als titel dient). */
export function notePreview(note) {
  if ((note?.title || '').trim()) return preview(note.content) || 'Geen extra tekst'
  const lines = String(note?.content || '').split('\n')
  const i = lines.findIndex(l => l.trim())
  return preview(lines.slice(i + 1).join('\n')) || 'Geen extra tekst'
}

/** Tijd in de lijst: vandaag 14:05, gisteren, weekdag, anders 07-10-2026. */
export function rowTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), today = startOfDay(Date.now()), day = startOfDay(d)
  if (day === today) return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  if (day === today - DAY) return 'Gisteren'
  if (today - day < 7 * DAY) return d.toLocaleDateString('nl-NL', { weekday: 'long' })
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function longDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} om ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Apple-secties: Vastgezet, Vandaag, Gisteren, Vorige 7 dagen, Vorige 30 dagen, per maand, per jaar.
 * In een afvinkbare map komen afgevinkte notities in "Afgerond" onderaan.
 */
export function sectionize(notes, { checkable = false } = {}) {
  const today = startOfDay(Date.now())
  const now = new Date()
  const pinned = [], done = [], groups = new Map()
  const byUpdated = [...notes].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  for (const n of byUpdated) {
    if (checkable && n.done_at) { done.push(n); continue }
    if (n.pinned) { pinned.push(n); continue }
    const d = new Date(n.updated_at || n.created_at || Date.now()), day = startOfDay(d)
    let key
    if (day >= today) key = 'Vandaag'
    else if (day >= today - DAY) key = 'Gisteren'
    else if (day >= today - 7 * DAY) key = 'Vorige 7 dagen'
    else if (day >= today - 30 * DAY) key = 'Vorige 30 dagen'
    else if (d.getFullYear() === now.getFullYear()) key = d.toLocaleDateString('nl-NL', { month: 'long' }).replace(/^./, c => c.toUpperCase())
    else key = String(d.getFullYear())
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(n)
  }
  const out = []
  if (pinned.length) out.push({ key: 'Vastgezet', notes: pinned })
  for (const [key, list] of groups) out.push({ key, notes: list })
  if (done.length) out.push({ key: 'Afgerond', notes: done.sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')) })
  return out
}

export function CheckCircle({ on, onToggle, label }) {
  return (
    <button type="button" className={`nx-check${on ? ' is-on' : ''}`} aria-pressed={!!on} aria-label={label}
      onClick={e => { e.stopPropagation(); onToggle() }} onPointerDown={e => e.stopPropagation()}>
      <Check size={15} strokeWidth={3} />
    </button>
  )
}

/** Contextmenu op een vaste positie ({x, y}), sluit bij klik ernaast of Esc. */
export function Menu({ at, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: at.x, top: at.y })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(at.x - (at.alignRight ? r.width : 0), window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    })
  }, [at.x, at.y, at.alignRight])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="nx-menu-backdrop" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div ref={ref} className="nx-menu" role="menu" style={pos}>
        {items.filter(Boolean).map((it, i) => it === 'sep' ? <div key={i} className="nx-menu__sep" /> : (
          <button key={i} type="button" role="menuitem" className={it.danger ? 'is-danger' : ''}
            onClick={() => { onClose(); it.onClick() }}>
            <span>{it.label}</span>{it.icon && <it.icon size={18} />}
          </button>
        ))}
      </div>
    </>
  )
}

/** iOS-alert met tekstveld (nieuwe map, hernoemen). */
export function PromptAlert({ title, message, initial = '', confirm = 'Bewaar', placeholder = 'Naam', allowEmpty = false, onDone }) {
  const [v, setV] = useState(initial)
  const ok = allowEmpty || v.trim().length > 0
  return (
    <div className="nx-alert-backdrop" onClick={() => onDone(null)}>
      <div className="nx-alert" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        <input autoFocus value={v} onChange={e => setV(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter' && ok) onDone(v.trim()); if (e.key === 'Escape') onDone(null) }} />
        <div className="nx-alert__buttons">
          <button type="button" onClick={() => onDone(null)}>Annuleer</button>
          <button type="button" disabled={!ok} onClick={() => onDone(v.trim())}>{confirm}</button>
        </div>
      </div>
    </div>
  )
}

/** Lang indrukken (telefoon) of rechtsklik (desktop) → callback met positie. */
export function useLongPress(cb, ms = 480) {
  const t = useRef(null), start = useRef(null), fired = useRef(false)
  const clear = () => { clearTimeout(t.current); t.current = null }
  return {
    onContextMenu: (e) => { e.preventDefault(); cb({ x: e.clientX, y: e.clientY }) },
    onPointerDown: (e) => {
      if (e.pointerType !== 'touch') return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      t.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(10); cb({ x: start.current.x, y: start.current.y }) }, ms)
    },
    onPointerMove: (e) => { if (t.current && start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear() },
    onPointerUp: clear,
    onPointerCancel: clear,
    /** true als de tik een long-press was (dan de gewone klik negeren) */
    wasLong: () => fired.current,
  }
}

/** Telefoon-onderbalk: zwevende glazen balk (links · midden · rechts) + rode ✕ terug naar Home. */
export function FloatBar({ left, center, right, onHome, tools }) {
  return (
    <div className="nx-floatbar-wrap">
      <div className={`nx-floatbar${tools ? ' is-tools' : ''}`}>
        {tools || (<>
          {left || <span className="nx-floatbar__spacer" />}
          <span className="nx-floatbar__center">{center}</span>
          {right || <span className="nx-floatbar__spacer" />}
        </>)}
      </div>
      {onHome && (
        <button type="button" className="nx-home" onClick={onHome} aria-label="Terug naar Home" title="Terug naar Home">
          <X size={26} strokeWidth={2.6} />
        </button>
      )}
    </div>
  )
}
