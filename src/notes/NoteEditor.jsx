import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ListChecks, Type, Pin, PinOff, Trash2, SquarePen, FolderInput, List, ListOrdered, CheckCircle2, Circle, X } from 'lucide-react'
import { parse, serialize, parseLine, numberOf, newId } from './noteFormat'
import { CheckCircle, longDate, Menu, FloatBar } from './parts'

// Blok-editor in Apple Notes-stijl. Elke regel is een blok (tekst, kop, opsomming, genummerd, afvinkpunt)
// met een eigen auto-groeiend tekstveld; Enter/Backspace/pijltjes/plakken gedragen zich als één document.

function AutoText({ value, onChange, inputRef, className, ...rest }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  })
  return <textarea ref={el => { ref.current = el; inputRef?.(el) }} rows={1} value={value} className={className}
    onChange={e => onChange(e.target.value, e)} spellCheck {...rest} />
}

/** Hoogte van het schermtoetsenbord (telefoon), zodat de werkbalk erboven blijft. */
function useKeyboardInset(enabled) {
  const [kb, setKb] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const on = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    on()
    vv.addEventListener('resize', on); vv.addEventListener('scroll', on)
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on) }
  }, [enabled])
  return kb
}

const SHORTCUTS = [
  [/^(- \[ \] |\[\] |\[ \] )/, { type: 'check', done: false }],
  [/^- \[x\] /i, { type: 'check', done: true }],
  [/^# /, { type: 'heading' }],
  [/^([-*•]) /, { type: 'bullet' }],
  [/^1[.)] /, { type: 'number' }],
]

export default function NoteEditor({
  note, mac, saveState, checkable, folders,
  onEdit, onPin, onToggleDone, onDelete, onNew, onMove, onEditingChange, onHome,
}) {
  const [title, setTitle] = useState(note.title || '')
  const [blocks, setBlocks] = useState(() => parse(note.content))
  const [enterId, setEnterId] = useState(null)
  const [fmt, setFmt] = useState(null) // { x, y } Aa-menu
  const [moveAt, setMoveAt] = useState(null)
  const refs = useRef(new Map())
  const titleRef = useRef(null)
  const focusReq = useRef(null) // { id: blockId | 'title', pos: number | 'end' }
  const cur = useRef(null) // laatst gefocuste blok-id of 'title'
  const noteId = useRef(note.id)
  const [editing, setEditing] = useState(false)
  const kb = useKeyboardInset(!mac)

  // Andere notitie geopend → opnieuw inlezen. Nieuwe lege notitie → meteen in de titel.
  useEffect(() => {
    if (noteId.current === note.id) return
    noteId.current = note.id
    setTitle(note.title || '')
    setBlocks(parse(note.content))
    cur.current = null
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!note.title && !note.content) focusReq.current = { id: 'title', pos: 0 }
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const req = focusReq.current
    if (!req) return
    focusReq.current = null
    const el = req.id === 'title' ? titleRef.current : refs.current.get(req.id)
    if (!el) return
    el.focus({ preventScroll: false })
    const p = req.pos === 'end' ? el.value.length : Math.min(req.pos, el.value.length)
    el.setSelectionRange(p, p)
  })

  const emit = (nextBlocks, nextTitle = title) => onEdit({ title: nextTitle, content: serialize(nextBlocks) })
  const commit = (next, focus) => {
    if (focus) focusReq.current = focus
    setBlocks(next)
    emit(next)
  }
  const setTitleText = (t) => { setTitle(t); emit(blocks, t) }

  // ── Bewerken ───────────────────────────────────────────────────────
  const changeText = (i, text) => {
    const b = blocks[i]
    let nb = { ...b, text }
    // "- " wordt meteen een opsomming; daarna "[ ] " typen = afvinkpunt
    const box = b.type === 'bullet' && text.match(/^\[ ?\] /)
    if (box) { nb = { id: b.id, type: 'check', done: false, text: text.slice(box[0].length) }; focusReq.current = { id: b.id, pos: 0 } }
    else if (b.type === 'text') {
      for (const [re, patch] of SHORTCUTS) {
        const m = text.match(re)
        if (m) { nb = { ...b, ...patch, text: text.slice(m[0].length) }; focusReq.current = { id: b.id, pos: 0 }; break }
      }
    }
    commit(blocks.map((x, j) => j === i ? nb : x))
  }

  const onKey = (i, e) => {
    const b = blocks[i], el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const listy = b.type !== 'text'
      if (listy && b.type !== 'heading' && !b.text) { // lege lijstregel + Enter = terug naar tekst
        commit(blocks.map((x, j) => j === i ? { ...x, type: 'text', done: undefined } : x), { id: b.id, pos: 0 })
        return
      }
      const before = b.text.slice(0, el.selectionStart), after = b.text.slice(el.selectionEnd)
      const type = b.type === 'heading' ? 'text' : b.type
      const nb = { id: newId(), type, text: after, ...(type === 'check' ? { done: false } : {}), ...(type === 'bullet' ? { mark: b.mark } : {}) }
      setEnterId(nb.id)
      commit([...blocks.slice(0, i), { ...b, text: before }, nb, ...blocks.slice(i + 1)], { id: nb.id, pos: 0 })
      return
    }
    if (e.key === 'Backspace' && atStart) {
      if (b.type !== 'text') { // eerst de opmaak eraf, zoals Apple
        e.preventDefault()
        commit(blocks.map((x, j) => j === i ? { id: x.id, type: 'text', text: x.text } : x), { id: b.id, pos: 0 })
        return
      }
      e.preventDefault()
      if (i === 0) { // samenvoegen met de titel
        const t = title + b.text
        const next = blocks.length > 1 ? blocks.slice(1) : [{ ...b, text: '' }]
        focusReq.current = { id: 'title', pos: title.length }
        setTitle(t); setBlocks(next); emit(next, t)
        return
      }
      const prev = blocks[i - 1]
      commit([...blocks.slice(0, i - 1), { ...prev, text: prev.text + b.text }, ...blocks.slice(i + 1)], { id: prev.id, pos: prev.text.length })
      return
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      e.preventDefault()
      focusReq.current = i > 0 ? { id: blocks[i - 1].id, pos: 'end' } : { id: 'title', pos: 'end' }
      setBlocks([...blocks])
      return
    }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length && i < blocks.length - 1) {
      e.preventDefault()
      focusReq.current = { id: blocks[i + 1].id, pos: 0 }
      setBlocks([...blocks])
    }
  }

  const onPaste = (i, e) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\n')) return
    e.preventDefault()
    const b = blocks[i], el = e.currentTarget
    const before = b.text.slice(0, el.selectionStart), after = b.text.slice(el.selectionEnd)
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const first = { ...b, text: before + lines[0] }
    const rest = lines.slice(1).map(l => ({ id: newId(), ...parseLine(l) }))
    const last = rest[rest.length - 1]
    const pos = last.text.length
    last.text += after
    commit([...blocks.slice(0, i), first, ...rest, ...blocks.slice(i + 1)], { id: last.id, pos })
  }

  const titleKey = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const el = e.currentTarget
      const before = title.slice(0, el.selectionStart), after = title.slice(el.selectionEnd)
      const first = blocks[0]
      if (!after && first && !first.text && first.type === 'text') { focusReq.current = { id: first.id, pos: 0 }; setBlocks([...blocks]); return }
      const nb = { id: newId(), type: 'text', text: after }
      const next = [nb, ...blocks]
      focusReq.current = { id: nb.id, pos: 0 }
      setTitle(before); setBlocks(next); emit(next, before)
    } else if (e.key === 'ArrowDown' && e.currentTarget.selectionStart === title.length && blocks[0]) {
      e.preventDefault(); focusReq.current = { id: blocks[0].id, pos: 0 }; setBlocks([...blocks])
    }
  }
  const titlePaste = (e) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\n')) return
    e.preventDefault()
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const t = title + lines[0]
    const rest = lines.slice(1).map(l => ({ id: newId(), ...parseLine(l) }))
    const next = [...rest, ...blocks.filter((b, i) => !(i === 0 && !b.text && blocks.length === 1))]
    focusReq.current = { id: rest[rest.length - 1].id, pos: 'end' }
    setTitle(t); setBlocks(next); emit(next, t)
  }

  const toggleCheck = (i) => commit(blocks.map((x, j) => j === i ? { ...x, done: !x.done } : x))

  // ── Werkbalk ───────────────────────────────────────────────────────
  const curIndex = () => blocks.findIndex(b => b.id === cur.current)
  const setType = (type) => {
    let i = curIndex()
    if (i < 0) { // titel of niets gefocust → nieuwe regel onderaan
      const last = blocks[blocks.length - 1]
      if (last && !last.text && last.type === 'text') i = blocks.length - 1
      else {
        const nb = { id: newId(), type, text: '', ...(type === 'check' ? { done: false } : {}) }
        commit([...blocks, nb], { id: nb.id, pos: 0 })
        return
      }
    }
    const b = blocks[i]
    const nextType = b.type === type ? 'text' : type
    commit(blocks.map((x, j) => j === i ? { id: x.id, type: nextType, text: x.text, ...(nextType === 'check' ? { done: false } : {}) } : x), { id: b.id, pos: 'end' })
  }
  const curType = blocks[curIndex()]?.type || null

  const keepFocus = (e) => e.preventDefault() // knoppen in de werkbalk mogen de focus niet stelen
  const openFmt = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setFmt(f => f ? null : { x: Math.max(8, Math.min(r.left + r.width / 2 - 140, window.innerWidth - 288)), y: mac ? r.bottom + 6 : r.top - 8, up: !mac })
  }

  const focusIn = (id) => { cur.current = id; if (!editing) { setEditing(true); onEditingChange?.(true) } }
  const focusOut = () => {
    setTimeout(() => {
      if (!document.activeElement?.closest?.('.nx-editor')) { setEditing(false); onEditingChange?.(false) }
    }, 0)
  }

  const clickBelow = (e) => {
    if (e.target !== e.currentTarget) return
    const last = blocks[blocks.length - 1]
    if (!last) return
    focusReq.current = { id: last.id, pos: 'end' }
    setBlocks([...blocks])
  }

  const done = checkable && !!note.done_at
  const toolbar = (
    <>
      <button type="button" className={`nx-icon-btn${fmt ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={openFmt} aria-label="Opmaak" title="Opmaak"><Type size={mac ? 17 : 22} /></button>
      <button type="button" className={`nx-icon-btn${curType === 'check' ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={() => setType('check')} aria-label="Afvinklijst" title="Afvinklijst"><ListChecks size={mac ? 17 : 22} /></button>
      <button type="button" className={`nx-icon-btn${note.pinned ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={onPin} aria-label={note.pinned ? 'Maak los' : 'Zet vast'} title={note.pinned ? 'Maak los' : 'Zet vast'}>
        {note.pinned ? <PinOff size={mac ? 17 : 22} /> : <Pin size={mac ? 17 : 22} />}
      </button>
      {checkable && (
        <button type="button" className={`nx-icon-btn${done ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={onToggleDone} aria-label={done ? 'Markeer als open' : 'Afvinken'} title={done ? 'Markeer als open' : 'Notitie afvinken'}>
          {done ? <CheckCircle2 size={mac ? 17 : 22} /> : <Circle size={mac ? 17 : 22} />}
        </button>
      )}
      {mac && <button type="button" className="nx-icon-btn" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMoveAt({ x: r.left, y: r.bottom + 6 }) }} aria-label="Verplaats naar map" title="Verplaats naar map"><FolderInput size={17} /></button>}
      {mac && <button type="button" className="nx-icon-btn" onClick={onDelete} aria-label="Verwijder notitie" title="Verwijder"><Trash2 size={17} /></button>}
      <button type="button" className="nx-icon-btn" onMouseDown={keepFocus} onClick={onNew} aria-label="Nieuwe notitie" title="Nieuwe notitie"><SquarePen size={mac ? 17 : 22} /></button>
    </>
  )

  return (
    <>
      {mac && (
        <div className="nx-mac-bar" style={{ gap: 2 }}>
          {toolbar}
          <span style={{ flex: 1 }} />
          <span className="nx-save" aria-live="polite">{saveState === 'saving' ? 'Opslaan…' : saveState === 'saved' ? 'Opgeslagen' : ''}</span>
        </div>
      )}
      <div className="nx-editor" onClick={clickBelow} onBlur={focusOut} style={!mac ? { paddingBottom: 120 + kb } : undefined}>
        <p className="nx-editor__date">{longDate(note.updated_at || note.created_at)}</p>
        <AutoText className="nx-title-input" value={title} placeholder="Titel" aria-label="Titel"
          inputRef={el => { titleRef.current = el }}
          onChange={setTitleText} onKeyDown={titleKey} onPaste={titlePaste} onFocus={() => focusIn('title')} />
        {blocks.map((b, i) => (
          <div key={b.id} className={`nx-block is-${b.type}${b.done ? ' is-done' : ''}${enterId === b.id ? ' is-enter' : ''}`}>
            {b.type === 'check' && <CheckCircle on={b.done} onToggle={() => toggleCheck(i)} label={b.done ? 'Niet afgevinkt' : 'Afvinken'} />}
            {b.type === 'bullet' && <span className="nx-block__mark" aria-hidden="true">•</span>}
            {b.type === 'number' && <span className="nx-block__mark" aria-hidden="true">{numberOf(blocks, i)}.</span>}
            <AutoText value={b.text} aria-label={b.type === 'check' ? 'Afvinkpunt' : 'Tekst'}
              placeholder={i === 0 && blocks.length === 1 && !b.text && b.type === 'text' ? 'Begin met typen…' : undefined}
              inputRef={el => { if (el) refs.current.set(b.id, el); else refs.current.delete(b.id) }}
              onChange={t => changeText(i, t)} onKeyDown={e => onKey(i, e)} onPaste={e => onPaste(i, e)}
              onFocus={() => focusIn(b.id)} />
          </div>
        ))}
      </div>

      {/* Telefoon: toetsenbord open = werkbalk erboven, anders de zwevende balk met de rode ✕ */}
      {!mac && (kb > 40 || editing
        ? <div className="nx-keybar" style={{ '--nx-kb': `${kb}px`, ...(kb ? { '--nx-kb-safe': '0px' } : {}) }}>{toolbar}</div>
        : <FloatBar tools={toolbar} onHome={onHome} />)}

      {fmt && (
        <>
          <div className="nx-menu-backdrop" onClick={() => setFmt(null)} />
          <div className="nx-format" style={{ position: 'fixed', left: fmt.x, ...(fmt.up ? { bottom: window.innerHeight - fmt.y } : { top: fmt.y }) }} onMouseDown={keepFocus}>
            <div className="nx-format__title">Opmaak <button type="button" className="nx-icon-btn" style={{ color: 'var(--nx-text-2)', minWidth: 24, minHeight: 24, padding: 2 }} onClick={() => setFmt(null)} aria-label="Sluiten"><X size={16} /></button></div>
            <div className="nx-format__styles">
              <button type="button" className={curType === 'heading' ? 'is-on' : ''} onClick={() => setType('heading')} style={{ fontWeight: 700, fontSize: 17 }}>Kop</button>
              <button type="button" className={curType === 'text' ? 'is-on' : ''} onClick={() => setType('text')} style={{ fontSize: 15 }}>Tekst</button>
            </div>
            <div className="nx-format__lists">
              <button type="button" className={curType === 'bullet' ? 'is-on' : ''} onClick={() => setType('bullet')} aria-label="Opsomming" title="Opsomming"><List size={18} /></button>
              <button type="button" className={curType === 'number' ? 'is-on' : ''} onClick={() => setType('number')} aria-label="Genummerde lijst" title="Genummerde lijst"><ListOrdered size={18} /></button>
              <button type="button" className={curType === 'check' ? 'is-on' : ''} onClick={() => setType('check')} aria-label="Afvinklijst" title="Afvinklijst"><ListChecks size={18} /></button>
            </div>
          </div>
        </>
      )}

      {moveAt && (
        <Menu at={moveAt} onClose={() => setMoveAt(null)} items={[
          { label: 'Notities (geen map)', onClick: () => onMove(null) },
          ...folders.filter(f => f.id !== note.folder_id).map(f => ({ label: f.name, onClick: () => onMove(f.id) })),
        ]} />
      )}
    </>
  )
}
