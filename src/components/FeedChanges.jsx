import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarClock, Check, X, ArrowRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { IconButton } from './ui'

// Melding als een gekoppelde agenda (Google / MijnX) is veranderd: een toast met een samenvatting
// per feed, en een lijst met oud → nieuw. "Gezien" zet seen_at in external_calendar_changes.

const KIND = { added: 'nieuw', changed: 'gewijzigd', removed: 'verwijderd' }
const KIND_COLOR = { added: 'var(--c-success)', changed: 'var(--c-warning)', removed: 'var(--c-danger)' }

const fmt = (iso, allDay) => {
  if (!iso) return ''
  const d = new Date(iso)
  const day = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  return allDay ? `${day} · hele dag` : `${day} ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
}
const range = (s) => s ? `${fmt(s.start_time, s.all_day)}${s.all_day ? '' : `–${new Date(s.end_time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`}` : ''

function useConnectionNames(changes) {
  const [names, setNames] = useState({})
  const ids = useMemo(() => [...new Set(changes.map(c => c.connection_id))].sort().join(','), [changes])
  useEffect(() => {
    if (!ids) return
    supabase.from('calendar_connections').select('id,name,provider').in('id', ids.split(','))
      .then(({ data }) => setNames(Object.fromEntries((data || []).map(c => [c.id, c.name || (c.provider === 'google' ? 'Google Agenda' : 'MijnX')]))))
  }, [ids])
  return names
}

function summarize(list) {
  const n = { added: 0, changed: 0, removed: 0 }
  list.forEach(c => { n[c.kind]++ })
  return Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${v} ${KIND[k]}`).join(' · ')
}

/** Toast onderaan met per feed een samenvatting. */
export function FeedChangesToast({ changes, onOpen, onDismiss }) {
  const names = useConnectionNames(changes)
  if (!changes.length) return null
  const byFeed = {}
  changes.forEach(c => { (byFeed[c.connection_id] ||= []).push(c) })
  return createPortal(
    <div role="status" aria-live="polite" className="modal-content"
      style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 9000,
        width: 'min(440px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px',
        background: 'var(--c-surface-solid)', border: '1px solid var(--c-border-strong)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-float)' }}>
      <CalendarClock size={18} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ fontWeight: 700, color: 'var(--c-text)' }}>Agenda bijgewerkt</div>
        {Object.entries(byFeed).map(([id, list]) => (
          <div key={id} style={{ color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {names[id] || 'Feed'}: {summarize(list)}
          </div>
        ))}
      </div>
      <button type="button" className="btn-neon" onClick={onOpen} style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}>Bekijk</button>
      <IconButton icon={X} label="Melding sluiten (gezien)" size={28} onClick={onDismiss} />
    </div>,
    document.body)
}

/** Lijst met wijzigingen, gegroepeerd per feed. */
export function FeedChangesSheet({ changes, editedKeys, onClose, onSeen, onJump }) {
  const names = useConnectionNames(changes)
  const byFeed = {}
  changes.forEach(c => { (byFeed[c.connection_id] ||= []).push(c) })
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
      <div className="glass-card modal-content" role="dialog" aria-modal="true" aria-labelledby="feed-changes-title"
        style={{ width: '100%', maxWidth: 480, padding: 22, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 id="feed-changes-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>Wijzigingen in je agenda's</h2>
          <IconButton icon={X} label="Sluiten" onClick={onClose} />
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, margin: '0 -4px', padding: '0 4px' }}>
          {Object.entries(byFeed).map(([id, list]) => (
            <section key={id}>
              <p className="t-overline" style={{ margin: '0 0 6px' }}>{names[id] || 'Feed'} · {summarize(list)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...list].sort((a, b) => new Date((a.after || a.before).start_time) - new Date((b.after || b.before).start_time)).map(c => {
                  const s = c.after || c.before
                  const titleChanged = c.kind === 'changed' && c.before?.title !== c.after?.title
                  const timeChanged = c.kind === 'changed' && range(c.before) !== range(c.after)
                  return (
                    <button key={c.id} type="button" onClick={() => onJump(c)} className="ui-row--interactive"
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', padding: '9px 10px', cursor: 'pointer',
                        borderRadius: 'var(--r-sm)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: KIND_COLOR[c.kind], width: 70, flexShrink: 0, paddingTop: 2 }}>{KIND[c.kind]}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
                        <span style={{ fontWeight: 600, textDecoration: c.kind === 'removed' ? 'line-through' : 'none' }}>
                          {titleChanged ? <>{c.before.title} <ArrowRight size={11} style={{ display: 'inline' }} /> {c.after.title}</> : (c.title || s.title)}
                        </span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--c-text-2)' }}>
                          {timeChanged
                            ? <><span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{range(c.before)}</span> <ArrowRight size={11} style={{ display: 'inline' }} /> {range(c.after)}</>
                            : range(s)}
                        </span>
                        {editedKeys?.has(`${c.connection_id}|${c.external_id}`) && c.kind !== 'removed' && (
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>Jouw aanpassing blijft actief</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={onSeen} style={{ marginTop: 16, justifyContent: 'center' }}>
          <Check size={14} /> Gezien
        </button>
      </div>
    </div>
  )
}
