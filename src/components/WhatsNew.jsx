import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, ChevronDown, X, LayoutDashboard, CalendarDays, CheckSquare, Music, StickyNote, Timer, Wallet, Wand2 } from 'lucide-react'
import { RELEASES } from '../changelog'

// "Wat is er nieuw": popup na een update. Meerdere gemiste updates stapelen als tijdlijn
// (nieuwste open, oudere ingeklapt). Ook te openen als volledig update-log (Instellingen).

const AREAS = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard, color: 'var(--accent)' },
  agenda: { label: 'Agenda', icon: CalendarDays, color: 'var(--c-info)' },
  taken: { label: 'Taken', icon: CheckSquare, color: 'var(--cat-school)' },
  spotify: { label: 'Spotify', icon: Music, color: '#1DB954' },
  notities: { label: 'Notities', icon: StickyNote, color: '#FFD60A' },
  focus: { label: 'Focus', icon: Timer, color: 'var(--c-warning)' },
  geld: { label: 'Geld', icon: Wallet, color: 'var(--c-success)' },
  app: { label: 'Hypex', icon: Wand2, color: 'var(--cat-persoonlijk)' },
}

const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

function Release({ r, open, onToggle, index, latest }) {
  const areas = [...new Set(r.items.map(i => i.area))]
  return (
    <li className={`wn-release${open ? ' is-open' : ''}`} style={{ '--i': index }}>
      <span className="wn-dot" aria-hidden="true" />
      <button type="button" className="wn-head" onClick={onToggle} aria-expanded={open}>
        <span className="wn-head__text">
          <span className="wn-date">{fmtDate(r.date)}{latest && <b className="wn-new">Nieuw</b>}</span>
          <span className="wn-title">{r.title}</span>
          {!open && (
            <span className="wn-areas">
              {areas.map(a => { const A = AREAS[a] || AREAS.app; return <span key={a} style={{ '--c': A.color }}><A.icon size={11} /> {A.label}</span> })}
              <em>{r.items.length} {r.items.length === 1 ? 'wijziging' : 'wijzigingen'}</em>
            </span>
          )}
        </span>
        <ChevronDown size={16} className="wn-chev" aria-hidden="true" />
      </button>
      <div className="wn-body" hidden={!open}>
        <ul className="wn-items">
          {r.items.map((it, j) => {
            const A = AREAS[it.area] || AREAS.app
            return (
              <li key={j} style={{ '--c': A.color, '--j': j }}>
                <span className="wn-icon"><A.icon size={14} /></span>
                <span><b>{A.label}</b> {it.text}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}

/**
 * releases: de te tonen updates (nieuwste eerst). all = volledig update-log.
 */
export default function WhatsNew({ releases, all = false, onClose }) {
  const list = all ? RELEASES : releases
  const [open, setOpen] = useState(() => new Set(list.slice(0, 1).map(r => r.id)))
  const [showAll, setShowAll] = useState(all)
  const shown = showAll ? RELEASES : list

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const toggle = (id) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const missed = list.length

  return createPortal(
    <div className="wn-backdrop" onClick={onClose}>
      <div className="wn-sheet glow-bg" role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={e => e.stopPropagation()} style={{ '--glow': 'var(--accent)' }}>
        <div className="wn-grabber" aria-hidden="true" />
        <header className="wn-top">
          <span className="wn-badge"><Sparkles size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="wn-title">{showAll ? 'Update-log' : 'Wat is er nieuw'}</h2>
            <p>{showAll ? `${RELEASES.length} updates` : missed > 1 ? `${missed} updates sinds je laatste bezoek` : 'Sinds je laatste bezoek'}</p>
          </div>
          <button type="button" className="wn-x" onClick={onClose} aria-label="Sluiten"><X size={18} /></button>
        </header>

        <ol className="wn-list">
          {shown.map((r, i) => (
            <Release key={r.id} r={r} index={i} latest={!all && list.some(x => x.id === r.id)}
              open={open.has(r.id)} onToggle={() => toggle(r.id)} />
          ))}
        </ol>

        <footer className="wn-foot">
          {!showAll && RELEASES.length > list.length && (
            <button type="button" className="btn-ghost" onClick={() => setShowAll(true)}>Hele update-log</button>
          )}
          <button type="button" className="btn-primary" onClick={onClose} style={{ flex: 1 }}>{all || showAll ? 'Sluiten' : 'Top, verder!'}</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
