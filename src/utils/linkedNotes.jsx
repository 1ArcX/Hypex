import React, { useEffect, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { checklistProgress, checklistComplete, toggleChecklistItem, resetChecklist } from '../notes/noteFormat'

// Notities die aan een taak gekoppeld zijn (tasks.note_id): voortgang "2/7" bij de taak, afvinken vanuit
// de taak, en events tussen Notities en de rest van de app:
//   'notesChanged'          { id, title?, content? }  — notitie gewijzigd (Notities ↔ taken blijven gelijk)
//   'noteChecklistComplete' { noteId }                 — laatste item afgevinkt → App rondt de taak af

const cache = new Map() // id → { id, title, content }
const listeners = new Set()
const notify = () => listeners.forEach(l => l())
let queue = new Set(), timer = null

function fetchQueued() {
  timer = null
  const ids = [...queue].filter(id => !cache.has(id))
  queue = new Set()
  if (!ids.length) return
  supabase.from('notes').select('id,title,content').in('id', ids).then(({ data }) => {
    for (const n of data || []) cache.set(n.id, n)
    for (const id of ids) if (!cache.has(id)) cache.set(id, null) // verwijderd
    notify()
  })
}
function ensure(id) {
  if (!id || cache.has(id)) return
  queue.add(id)
  if (!timer) timer = setTimeout(fetchQueued, 30) // gebundeld: één query voor alle taken op het scherm
}

// Wijzigingen vanuit Notities direct overnemen
if (typeof window !== 'undefined') {
  window.addEventListener('notesChanged', (e) => {
    const { id, ...fields } = e.detail || {}
    if (!id || !cache.has(id)) return
    cache.set(id, { ...(cache.get(id) || { id }), ...fields })
    notify()
  })
  window.addEventListener('refreshTasks', () => { cache.clear(); notify() })
}

export function useLinkedNote(noteId) {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force(n => n + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  ensure(noteId)
  return noteId ? cache.get(noteId) : null
}

async function writeContent(note, content) {
  cache.set(note.id, { ...note, content })
  notify()
  window.dispatchEvent(new CustomEvent('notesChanged', { detail: { id: note.id, content } }))
  await supabase.from('notes').update({ content, updated_at: new Date().toISOString() }).eq('id', note.id)
}

/** Afvinkpunt vanuit de taak omzetten; laatste item af → taak afronden (via App). */
export async function toggleLinkedItem(note, index) {
  const before = checklistComplete(note.content)
  const content = toggleChecklistItem(note.content, index)
  await writeContent(note, content)
  if (!before && checklistComplete(content)) window.dispatchEvent(new CustomEvent('noteChecklistComplete', { detail: { noteId: note.id } }))
}

/** Alle vinkjes in een gekoppelde notitie weer uit (herhalende taak afgerond / opnieuw ingepland). */
export async function resetLinkedNote(noteId) {
  const { data } = await supabase.from('notes').select('id,title,content').eq('id', noteId).single()
  if (!data) return
  const content = resetChecklist(data.content)
  if (content !== data.content) await writeContent(data, content)
}

/** Klein label bij een taak: notitie-icoon + voortgang van de afvinklijst. */
export function NoteProgress({ noteId, style }) {
  const note = useLinkedNote(noteId)
  if (!noteId) return null
  const p = note ? checklistProgress(note.content) : null
  return (
    <span className={`note-progress${p && p.done === p.total ? ' is-done' : ''}`} style={style} title="Gekoppelde notitie">
      <StickyNote size={11} aria-hidden="true" />{p && <span className="tnum">{p.done}/{p.total}</span>}
    </span>
  )
}

/** Afvinklijst van de gekoppelde notitie, af te vinken vanuit de taak (TaskDetailModal). */
export function LinkedChecklist({ noteId, onOpenNote }) {
  const note = useLinkedNote(noteId)
  if (!noteId) return null
  if (note === undefined) return <div className="linked-list"><p className="t-meta" style={{ margin: 0 }}>Notitie laden…</p></div>
  if (note === null) return null
  const items = String(note.content || '').split('\n').map(l => l.match(/^- \[( |x|X)\] ?(.*)$/)).filter(Boolean).map(m => ({ done: m[1] !== ' ', text: m[2] }))
  const p = checklistProgress(note.content)
  return (
    <div className="linked-list">
      <div className="linked-list__head">
        <StickyNote size={12} aria-hidden="true" />
        <span>{note.title || 'Notitie'}</span>
        {p && <span className="tnum linked-list__count">{p.done}/{p.total}</span>}
        {onOpenNote && <button type="button" className="linked-list__open" onClick={() => onOpenNote(note.id)}>Open notitie</button>}
      </div>
      {items.length === 0
        ? <p className="t-meta" style={{ margin: 0 }}>Geen afvinklijst in deze notitie.</p>
        : (
          <ul>
            {items.map((it, i) => (
              <li key={i}>
                <button type="button" className={`linked-list__item${it.done ? ' is-done' : ''}`} onClick={() => toggleLinkedItem(note, i)} aria-pressed={it.done}>
                  <span className="linked-list__box" aria-hidden="true">{it.done ? '✓' : ''}</span>
                  <span>{it.text || '…'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
