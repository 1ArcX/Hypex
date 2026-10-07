import React, { useEffect, useRef, useState } from 'react'
import { Pin, PinOff, Trash2, Folder } from 'lucide-react'
import { checklistProgress } from './noteFormat'
import { CheckCircle, noteTitle, notePreview, rowTime, sectionize } from './parts'

const ACTIONS_W = 152 // twee knoppen van 76px

/**
 * Notitierij. Telefoon: naar links vegen = Vastzetten / Verwijder (helemaal doorvegen = verwijderen).
 * Desktop: rechtsklik = menu (via onContext).
 */
function Row({ note, mac, selected, checkable, showFolder, folderName, onOpen, onPin, onDone, onDelete, onContext }) {
  const wrapRef = useRef(null), rowRef = useRef(null)
  const g = useRef({ sx: 0, sy: 0, base: 0, dragging: false, moved: false, id: null })
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  const [removing, setRemoving] = useState(false)
  const swipe = !mac

  // Open rij sluit bij tikken ergens anders
  useEffect(() => {
    if (!offset) return
    const close = (e) => { if (!wrapRef.current?.contains(e.target)) { setSettling(true); setOffset(0) } }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [offset])

  const remove = () => {
    const el = wrapRef.current
    if (el) el.style.height = el.offsetHeight + 'px'
    setRemoving(true)
    setTimeout(() => onDelete(note), 280)
  }

  const down = (e) => {
    if (!swipe || e.button !== 0) return
    g.current = { sx: e.clientX, sy: e.clientY, base: offset, dragging: false, moved: false, id: e.pointerId }
  }
  const move = (e) => {
    const s = g.current
    if (!swipe || s.id !== e.pointerId) return
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy
    if (!s.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s.id = null; return }
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.dragging = true; s.moved = true
        try { rowRef.current?.setPointerCapture(e.pointerId) } catch { /* geen echte pointer */ }
        setSettling(false)
      } else return
    }
    const w = wrapRef.current?.offsetWidth || 360
    let off = Math.min(0, s.base + dx)
    if (off > 0) off = 0
    setOffset(Math.max(-w, off))
  }
  const up = (e) => {
    const s = g.current
    if (!swipe || s.id !== e.pointerId) return
    s.id = null
    if (!s.dragging) return
    s.dragging = false
    const w = wrapRef.current?.offsetWidth || 360
    setSettling(true)
    if (offset < -w * 0.6) { setOffset(-w); remove() }
    else setOffset(offset < -56 ? -ACTIONS_W : 0)
  }
  const click = () => {
    if (g.current.moved) { g.current.moved = false; return }
    if (offset) { setSettling(true); setOffset(0); return }
    onOpen(note)
  }

  const progress = checklistProgress(note.content)
  const done = checkable && !!note.done_at
  const fullSwipe = offset < -(wrapRef.current?.offsetWidth || 360) * 0.6
  return (
    <div ref={wrapRef} className={`nx-row-wrap${checkable ? ' has-check' : ''}${selected ? ' is-selected' : ''}${removing ? ' is-removing' : ''}`}>
      {swipe && offset < 0 && (
        <div className="nx-row-actions" style={{ width: Math.max(ACTIONS_W, -offset) }}>
          {!fullSwipe && (
            <button type="button" className="is-pin" onClick={() => { setSettling(true); setOffset(0); onPin(note) }}>
              {note.pinned ? <PinOff size={20} /> : <Pin size={20} />}{note.pinned ? 'Maak los' : 'Zet vast'}
            </button>
          )}
          <button type="button" className="is-del" style={{ flex: 1 }} onClick={remove}><Trash2 size={20} />Verwijder</button>
        </div>
      )}
      <div ref={rowRef} role="button" tabIndex={0}
        className={`nx-row${selected ? ' is-selected' : ''}${done ? ' is-done' : ''}${settling ? ' is-settling' : ''}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={click}
        onKeyDown={e => { if (e.key === 'Enter') onOpen(note) }}
        onContextMenu={e => { if (onContext) { e.preventDefault(); onContext(note, { x: e.clientX, y: e.clientY }) } }}>
        {checkable && <CheckCircle on={done} onToggle={() => onDone(note)} label={done ? 'Markeer als open' : 'Afvinken'} />}
        <div className="nx-row__body">
          <div className="nx-row__title">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{noteTitle(note)}</span>
            {progress && <span className="nx-row__progress tnum">{progress.done}/{progress.total}</span>}
          </div>
          <div className="nx-row__sub"><b>{rowTime(note.updated_at || note.created_at)}</b>{notePreview(note)}</div>
          {showFolder && <div className="nx-row__folder"><Folder size={12} /> {folderName || 'Notities'}</div>}
        </div>
      </div>
    </div>
  )
}

export default function NoteList({ notes, mac, selectedId, checkable, showFolder, folders, query, onOpen, onPin, onDone, onDelete, onContext, emptyText }) {
  const folderName = (id) => folders.find(f => f.id === id)?.name
  if (!notes.length) {
    return (
      <div className="nx-empty">
        <b>{query ? 'Geen resultaten' : 'Geen notities'}</b>
        {query ? `Niets gevonden voor "${query}".` : emptyText}
      </div>
    )
  }
  const sections = query ? [{ key: 'Resultaten', notes }] : sectionize(notes, { checkable })
  return sections.map(sec => (
    <section key={sec.key} className="nx-list-section">
      <h2 className="nx-list-section__title">{sec.key === 'Vastgezet' && !mac ? <><Pin size={16} style={{ display: 'inline-block', marginRight: 4, verticalAlign: -2 }} />Vastgezet</> : sec.key}</h2>
      <div className="nx-group">
        {sec.notes.map(n => (
          <Row key={n.id} note={n} mac={mac} selected={n.id === selectedId} checkable={checkable}
            showFolder={showFolder} folderName={folderName(n.folder_id)}
            onOpen={onOpen} onPin={onPin} onDone={onDone} onDelete={onDelete} onContext={onContext} />
        ))}
      </div>
    </section>
  ))
}

