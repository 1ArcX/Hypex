import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Home, Calendar, CheckSquare, Timer, FileText, BarChart2, Briefcase, Wallet, Sparkles, Plus, CornerDownLeft, StickyNote } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { taskCategory, eventCategory, categoryColor } from '../utils/category'
import { eventDisplay } from '../utils/eventTitle'

// "Zoek in Hypex" (Ctrl/⌘K) — client-side zoeken over wat al geladen is (taken, agenda-items)
// plus notitie-titels (lichte select bij openen) en paginanavigatie. Geen nieuwe backend.

const PAGES = [
  { id: 'dashboard',    label: 'Dashboard',    Icon: Home },
  { id: 'agenda',       label: 'Agenda',       Icon: Calendar },
  { id: 'taken',        label: 'Taken',        Icon: CheckSquare },
  { id: 'focus',        label: 'Focus',        Icon: Timer },
  { id: 'notities',     label: 'Notities',     Icon: FileText },
  { id: 'statistieken', label: 'Statistieken', Icon: BarChart2 },
  { id: 'jumbo',        label: 'Jumbo',        Icon: Briefcase, access: 'jumbo' },
  { id: 'geld',         label: 'Geld',         Icon: Wallet,    access: 'admin' },
  { id: 'hypexai',      label: 'Hypex AI',     Icon: Sparkles,  access: 'admin' },
]

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const fmtDate = d => {
  if (!d) return ''
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function CommandPalette({ open, onClose, userId, tasks = [], calendarEvents = [], isAdmin, showJumbo, onNavigate, onOpenTask, onOpenEvent, onOpenNote, onNewTask }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [notes, setNotes] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setQuery(''); setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
    if (userId) {
      supabase.from('notes').select('id, title, content, updated_at').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(200)
        .then(({ data }) => setNotes(data || []))
    }
  }, [open, userId])

  const results = useMemo(() => {
    const q = norm(query.trim())
    const match = (...fields) => !q || fields.some(f => norm(f).includes(q))
    const pages = PAGES
      .filter(p => !p.access || (p.access === 'admin' ? isAdmin : showJumbo))
      .filter(p => match(p.label))
      .map(p => ({ key: `page:${p.id}`, group: 'Pagina\'s', Icon: p.Icon, title: p.label, run: () => onNavigate(p.id) }))
    const actions = match('nieuwe taak', 'taak toevoegen')
      ? [{ key: 'action:newtask', group: 'Acties', Icon: Plus, title: 'Nieuwe taak', run: () => onNewTask() }]
      : []
    if (!q) return [...actions, ...pages]

    const taskHits = tasks
      .filter(t => match(t.title, t.description))
      .sort((a, b) => Number(a.completed) - Number(b.completed))
      .slice(0, 8)
      .map(t => ({
        key: `task:${t.id}`, group: 'Taken', dot: categoryColor(taskCategory(t)), title: t.title,
        meta: t.completed ? 'Voltooid' : fmtDate(t.date || t.due_date), done: t.completed, run: () => onOpenTask(t),
      }))
    const now = new Date()
    const eventHits = calendarEvents
      .filter(ev => match(ev.title, ev.description, ev.location))
      // eerst komende (oplopend), daarna voorbije (meest recent eerst)
      .sort((a, b) => {
        const ta = new Date(a.start_time), tb = new Date(b.start_time)
        const fa = ta >= now, fb = tb >= now
        if (fa !== fb) return fa ? -1 : 1
        return fa ? ta - tb : tb - ta
      })
      .slice(0, 6)
      .map(ev => ({
        key: `event:${ev.id}`, group: 'Agenda', dot: categoryColor(eventCategory(ev)), title: eventDisplay(ev).title,
        meta: `${fmtDate(ev.start_time)} ${new Date(ev.start_time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`, run: () => onOpenEvent(ev),
      }))
    const noteHits = notes
      .filter(n => match(n.title, n.content))
      .slice(0, 6)
      .map(n => ({ key: `note:${n.id}`, group: 'Notities', Icon: StickyNote, title: n.title || 'Naamloos', meta: fmtDate(n.updated_at), run: () => onOpenNote(n) }))
    return [...taskHits, ...eventHits, ...noteHits, ...actions, ...pages]
  }, [query, tasks, calendarEvents, notes, isAdmin, showJumbo, onNavigate, onOpenTask, onOpenEvent, onOpenNote, onNewTask])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const choose = (r) => { if (!r) return; onClose(); r.run() }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = null
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="modal-content card" role="dialog" aria-modal="true" aria-label="Zoek in Hypex" onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, calc(100vw - 32px))', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <Search size={16} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Zoek taken, afspraken, notities of pagina's…" aria-label="Zoeken"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={results[active] ? `cmdk-${active}` : undefined}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: 15, minWidth: 0 }} />
          <kbd style={{ fontSize: 10, color: 'var(--c-text-3)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '2px 5px' }}>Esc</kbd>
        </div>
        <div ref={listRef} id="cmdk-list" role="listbox" style={{ maxHeight: 'min(420px, 60vh)', overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <p style={{ margin: 0, padding: '20px 12px', textAlign: 'center', fontSize: 13, color: 'var(--c-text-3)' }}>Geen resultaten voor “{query}”</p>
          )}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            const isActive = i === active
            return (
              <React.Fragment key={r.key}>
                {header && <div className="t-overline" style={{ color: 'var(--c-text-3)', padding: '8px 10px 4px' }}>{header}</div>}
                <div id={`cmdk-${i}`} data-idx={i} role="option" aria-selected={isActive}
                  onMouseMove={() => setActive(i)} onClick={() => choose(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                  }}>
                  {r.Icon
                    ? <r.Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--c-text-3)', flexShrink: 0 }} aria-hidden="true" />
                    : <span aria-hidden="true" style={{ width: 8, height: 8, margin: '0 3.5px', borderRadius: '50%', background: r.dot, flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.6 : 1 }}>{r.title}</span>
                  {r.meta && <span className="t-meta tnum" style={{ flexShrink: 0 }}>{r.meta}</span>}
                  {isActive && <CornerDownLeft size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} aria-hidden="true" />}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
