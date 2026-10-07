import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ListChecks, Type, Pin, PinOff, Trash2, SquarePen, FolderInput, List, ListOrdered, CheckCircle2, Circle, X } from 'lucide-react'
import { parse, serialize } from './noteFormat'
import { removeRange, splitAt, backspaceAtStart, deleteAtEnd, insertText, applyShortcut, setLineType } from './docModel'
import { longDate, Menu, FloatBar, NxPortal } from './parts'
import { openExternalUrl } from '../utils/openExternal'

// Editor in Apple Notes-stijl: één bewerkbaar document (contentEditable), zodat selecteren met de muis,
// Ctrl+A, kopiëren en verwijderen over meerdere regels gewoon werkt. Elke regel is een <div class="nx-line">
// met data-type (title, text, heading, check, bullet, number); afvinkrondjes, opsommingstekens en nummers
// zijn CSS (::before), dus selecteren/kopiëren geeft alleen tekst. Structuurwijzigingen (Enter, Backspace
// aan het begin, plakken, opmaak) lopen via docModel.js; gewoon typen laat de browser doen.

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

// ── DOM ⇄ model ─────────────────────────────────────────────────────────
const lineText = (el) => (el.textContent || '').replace(/\n/g, ' ')

// Links (http(s)://… en www.…) worden <a class="nx-link"> in de regel; klikken opent ze.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,:;!?'")\]}]/gi
const linksIn = (text) => text.match(URL_RE) || []

/** Tekst in een regel zetten, met links als <a>. */
function fillLine(d, text) {
  d.textContent = ''
  if (!text) { d.appendChild(document.createElement('br')); return }
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) d.appendChild(document.createTextNode(text.slice(last, m.index)))
    const a = document.createElement('a')
    a.className = 'nx-link'
    a.href = /^https?:/i.test(m[0]) ? m[0] : `https://${m[0]}`
    a.textContent = m[0]
    a.rel = 'noopener noreferrer'
    a.target = '_blank'
    d.appendChild(a)
    last = m.index + m[0].length
  }
  if (last < text.length) d.appendChild(document.createTextNode(text.slice(last)))
}

function lineEl(l, i, total) {
  const d = document.createElement('div')
  d.className = 'nx-line'
  d.dataset.type = i === 0 ? 'title' : l.type
  if (l.type === 'check') d.dataset.done = l.done ? '1' : '0'
  if (l.mark) d.dataset.mark = l.mark
  fillLine(d, l.text)
  markEmpty(d, i, total)
  return d
}
function markEmpty(d, i, total) {
  const empty = !(d.textContent || '').length
  if (empty && i === 0) d.dataset.ph = 'Titel'
  else if (empty && i === 1 && total === 2 && d.dataset.type === 'text') d.dataset.ph = 'Begin met typen…'
  else delete d.dataset.ph
}

function render(root, lines) {
  root.textContent = ''
  lines.forEach((l, i) => root.appendChild(lineEl(l, i, lines.length)))
}

function readLines(root) {
  const out = []
  for (const el of root.children) {
    const type = el.dataset.type || 'text'
    out.push({ type: out.length === 0 ? 'title' : (type === 'title' ? 'text' : type), text: lineText(el),
      ...(type === 'check' ? { done: el.dataset.done === '1' } : {}), ...(el.dataset.mark ? { mark: el.dataset.mark } : {}) })
  }
  return out.length ? out : [{ type: 'title', text: '' }]
}

/** Klopt de DOM nog met ons formaat? (browser kan bij plakken/samenvoegen spans of losse tekst maken) */
function isCanonical(root) {
  if (!root.children.length) return false
  for (const n of root.childNodes) {
    if (n.nodeType !== 1 || n.tagName !== 'DIV' || !n.classList.contains('nx-line')) return false
    for (const c of n.childNodes) {
      if (c.nodeType === 3) continue
      if (c.nodeType === 1 && c.tagName === 'BR' && n.childNodes.length === 1) continue
      if (c.nodeType === 1 && c.tagName === 'A' && c.classList.contains('nx-link') && [...c.childNodes].every(x => x.nodeType === 3)) continue
      return false
    }
    // Links moeten precies overeenkomen met de URL's in de tekst (na typen kan een link groeien/verdwijnen)
    const want = linksIn(lineText(n)), have = [...n.querySelectorAll('a.nx-link')].map(a => a.textContent)
    if (want.length !== have.length || want.some((u, i) => u !== have[i])) return false
  }
  return true
}

// ── Caret ───────────────────────────────────────────────────────────────
function posOf(root, node, off) {
  if (node === root) {
    const n = root.children.length
    if (!n) return { line: 0, off: 0 }
    if (off >= n) return { line: n - 1, off: lineText(root.children[n - 1]).length }
    return { line: off, off: 0 }
  }
  const el = node.nodeType === 1 ? node : node.parentNode
  const line = el?.closest?.('.nx-line')
  if (!line || line.parentNode !== root) return null
  const r = document.createRange()
  r.setStart(line, 0)
  try { r.setEnd(node, off) } catch { return { line: [...root.children].indexOf(line), off: 0 } }
  return { line: [...root.children].indexOf(line), off: r.toString().length }
}
function getSel(root) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer) && r.startContainer !== root) return null
  const s = posOf(root, r.startContainer, r.startOffset), e = posOf(root, r.endContainer, r.endOffset)
  if (!s || !e) return null
  return { s, e, collapsed: r.collapsed }
}
function pointIn(line, off) {
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
  let n, left = off
  while ((n = walker.nextNode())) {
    if (left <= n.length) return [n, left]
    left -= n.length
  }
  return [line, 0]
}
function setCaret(root, c) {
  const line = root.children[Math.min(c.line, root.children.length - 1)]
  if (!line) return
  const [node, off] = pointIn(line, c.off)
  const sel = window.getSelection()
  const r = document.createRange()
  r.setStart(node, off); r.collapse(true)
  sel.removeAllRanges(); sel.addRange(r)
  const el = node.nodeType === 1 ? node : node.parentNode
  el?.scrollIntoView?.({ block: 'nearest' })
}

export default function NoteEditor({
  note, mac, saveState, checkable, folders,
  onEdit, onPin, onToggleDone, onDelete, onNew, onMove, onEditingChange, onHome,
}) {
  const rootRef = useRef(null)
  const lastCaret = useRef(null)
  const hist = useRef({ list: [], i: -1, at: 0 })
  const [fmt, setFmt] = useState(null)
  const [moveAt, setMoveAt] = useState(null)
  const [curType, setCurType] = useState(null)
  const [editing, setEditing] = useState(false)
  const kb = useKeyboardInset(!mac)

  const emit = (lines) => onEdit({ title: lines[0]?.text || '', content: serialize(lines.slice(1)) })

  const pushHist = (lines, caret, coalesce) => {
    const h = hist.current, now = Date.now()
    h.list = h.list.slice(0, h.i + 1)
    if (coalesce && h.list.length > 1 && now - h.at < 800) h.list[h.list.length - 1] = { lines, caret }
    else h.list.push({ lines, caret })
    if (h.list.length > 200) h.list.shift()
    h.i = h.list.length - 1
    h.at = now
  }

  /** Structuurwijziging toepassen: model → DOM, caret terug, opslaan. */
  const apply = (res, { history = true } = {}) => {
    if (!res) return
    const root = rootRef.current
    render(root, res.lines)
    setCaret(root, res.caret)
    lastCaret.current = res.caret
    setCurType(res.lines[res.caret.line]?.type || null)
    if (history) pushHist(res.lines, res.caret, false)
    emit(res.lines)
  }

  // Eerste keer: notitie inlezen. (Editor krijgt per notitie een eigen key → opnieuw mounten bij wisselen.)
  useLayoutEffect(() => {
    const root = rootRef.current
    // Lege notitie = alleen de titelregel (Enter maakt de eerste tekstregel; geen loze lege regel achteraan)
    const blocks = note.content ? parse(note.content).map(({ id, ...b }) => b) : []
    const lines = [{ type: 'title', text: note.title || '' }, ...blocks]
    render(root, lines)
    pushHist(lines, { line: 0, off: 0 }, false)
    // Nieuwe notitie: meteen typen (op de telefoon neemt dit de focus over van het verborgen veld → toetsenbord blijft open)
    if (!note.title && !note.content) { root.focus({ preventScroll: true }); setCaret(root, { line: 0, off: 0 }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Huidige regel bijhouden (voor de werkbalk)
  useEffect(() => {
    const on = () => {
      const root = rootRef.current
      const s = root && getSel(root)
      if (!s) return
      lastCaret.current = s.s
      setCurType(root.children[s.s.line]?.dataset.type || null)
    }
    document.addEventListener('selectionchange', on)
    return () => document.removeEventListener('selectionchange', on)
  }, [])

  // ── Invoer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const root = rootRef.current
    const before = (e) => {
      const t = e.inputType
      if (t.startsWith('format')) { e.preventDefault(); return }
      if (t === 'historyUndo' || t === 'historyRedo') { e.preventDefault(); step(t === 'historyUndo' ? -1 : 1); return }
      const sel = getSel(root)
      if (!sel) return
      const lines = readLines(root)
      const multi = !sel.collapsed
      if (t === 'insertParagraph' || t === 'insertLineBreak') {
        e.preventDefault()
        const base = multi ? removeRange(lines, sel.s, sel.e) : { lines, caret: sel.s }
        apply(splitAt(base.lines, base.caret))
        return
      }
      if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertReplacementText' && e.dataTransfer) {
        e.preventDefault()
        const text = e.dataTransfer?.getData('text/plain') ?? e.data ?? ''
        const base = multi ? removeRange(lines, sel.s, sel.e) : { lines, caret: sel.s }
        apply(insertText(base.lines, base.caret, text))
        return
      }
      if (t === 'deleteContentBackward' || t === 'deleteWordBackward' || t === 'deleteSoftLineBackward' || t === 'deleteHardLineBackward') {
        if (multi && sel.s.line !== sel.e.line) { e.preventDefault(); apply(removeRange(lines, sel.s, sel.e)); return }
        if (!multi && sel.s.off === 0) { e.preventDefault(); const r = backspaceAtStart(lines, sel.s); if (r) apply(r); return }
        return
      }
      if (t === 'deleteContentForward' || t === 'deleteWordForward' || t === 'deleteByCut' || t === 'deleteContent') {
        if (multi && sel.s.line !== sel.e.line) { e.preventDefault(); apply(removeRange(lines, sel.s, sel.e)); return }
        if (!multi && t === 'deleteContentForward' && sel.s.off === lines[sel.s.line].text.length) { e.preventDefault(); const r = deleteAtEnd(lines, sel.s); if (r) apply(r); return }
        return
      }
      if ((t === 'insertText' || t === 'insertReplacementText') && multi && sel.s.line !== sel.e.line) {
        e.preventDefault()
        const base = removeRange(lines, sel.s, sel.e)
        apply(insertText(base.lines, base.caret, e.data || ''))
      }
    }
    const input = () => {
      const sel = getSel(root)
      let lines = readLines(root)
      const caret = sel?.s || lastCaret.current || { line: 0, off: 0 }
      const sc = applyShortcut(lines, caret)
      if (sc) { apply(sc); return }
      if (!isCanonical(root)) { apply({ lines, caret }, { history: false }); pushHist(lines, caret, true); return }
      ;[...root.children].forEach((d, i) => markEmpty(d, i, root.children.length))
      pushHist(lines, caret, true)
      emit(lines)
    }
    const paste = (e) => { // vangnet voor browsers zonder insertFromPaste
      if (e.defaultPrevented) return
      e.preventDefault()
      const sel = getSel(root)
      if (!sel) return
      const lines = readLines(root)
      const base = sel.collapsed ? { lines, caret: sel.s } : removeRange(lines, sel.s, sel.e)
      apply(insertText(base.lines, base.caret, e.clipboardData.getData('text/plain')))
    }
    root.addEventListener('beforeinput', before)
    root.addEventListener('input', input)
    root.addEventListener('paste', paste)
    return () => { root.removeEventListener('beforeinput', before); root.removeEventListener('input', input); root.removeEventListener('paste', paste) }
  }) // elke render opnieuw koppelen: handlers gebruiken de nieuwste props (onEdit)

  const step = (dir) => {
    const h = hist.current
    const j = h.i + dir
    if (j < 0 || j >= h.list.length) return
    h.i = j
    apply(h.list[j], { history: false })
  }

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) { e.preventDefault(); return }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); step(e.shiftKey ? 1 : -1); return }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); step(1) }
  }

  // Link aanklikken = openen (zoals Apple Notes); slepen om te selecteren blijft werken
  const onClick = (e) => {
    const a = e.target.closest?.('a.nx-link')
    if (!a) return
    e.preventDefault()
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    openExternalUrl(a.getAttribute('href'))
  }

  // Afvinkrondje is een ::before links in de regel: klik daar = afvinken
  const onPointerDown = (e) => {
    const line = e.target.closest?.('.nx-line')
    if (!line || line.dataset.type !== 'check') return
    const r = line.getBoundingClientRect()
    if (e.clientX - r.left > 30) return
    e.preventDefault()
    const root = rootRef.current
    const i = [...root.children].indexOf(line)
    const lines = readLines(root)
    lines[i] = { ...lines[i], done: !lines[i].done }
    const sel = getSel(root)
    apply({ lines, caret: sel?.s || { line: i, off: lines[i].text.length } })
    if (!sel) root.blur()
  }

  const focusIn = () => { if (!editing) { setEditing(true); onEditingChange?.(true) } }
  const focusOut = () => { setEditing(false); onEditingChange?.(false) }

  // Klik onder de tekst = cursor aan het eind
  const clickBelow = (e) => {
    if (e.target !== e.currentTarget) return
    const root = rootRef.current
    root.focus()
    const n = root.children.length - 1
    setCaret(root, { line: n, off: lineText(root.children[n]).length })
  }

  const setType = (type) => {
    const root = rootRef.current
    root.focus()
    apply(setLineType(readLines(root), lastCaret.current || { line: root.children.length - 1, off: 0 }, type))
  }

  const keepFocus = (e) => e.preventDefault() // knoppen in de werkbalk mogen de focus niet stelen
  const openFmt = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setFmt(f => f ? null : { x: Math.max(8, Math.min(r.left + r.width / 2 - 140, window.innerWidth - 288)), y: mac ? r.bottom + 6 : r.top - 8, up: !mac })
  }

  const done = checkable && !!note.done_at
  const ic = mac ? 17 : 22
  const toolbar = (
    <>
      <button type="button" className={`nx-icon-btn${fmt ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={openFmt} aria-label="Opmaak" title="Opmaak"><Type size={ic} /></button>
      <button type="button" className={`nx-icon-btn${curType === 'check' ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={() => setType('check')} aria-label="Afvinklijst" title="Afvinklijst"><ListChecks size={ic} /></button>
      <button type="button" className={`nx-icon-btn${note.pinned ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={onPin} aria-label={note.pinned ? 'Maak los' : 'Zet vast'} title={note.pinned ? 'Maak los' : 'Zet vast'}>
        {note.pinned ? <PinOff size={ic} /> : <Pin size={ic} />}
      </button>
      {checkable && (
        <button type="button" className={`nx-icon-btn${done ? ' is-on' : ''}`} onMouseDown={keepFocus} onClick={onToggleDone} aria-label={done ? 'Markeer als open' : 'Afvinken'} title={done ? 'Markeer als open' : 'Notitie afvinken'}>
          {done ? <CheckCircle2 size={ic} /> : <Circle size={ic} />}
        </button>
      )}
      {mac && <button type="button" className="nx-icon-btn" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMoveAt({ x: r.left, y: r.bottom + 6 }) }} aria-label="Verplaats naar map" title="Verplaats naar map"><FolderInput size={17} /></button>}
      {mac && <button type="button" className="nx-icon-btn" onClick={onDelete} aria-label="Verwijder notitie" title="Verwijder"><Trash2 size={17} /></button>}
      <button type="button" className="nx-icon-btn" onMouseDown={keepFocus} onClick={onNew} aria-label="Nieuwe notitie" title="Nieuwe notitie"><SquarePen size={ic} /></button>
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
      <div className="nx-editor" onMouseDown={e => { if (e.target === e.currentTarget) e.preventDefault() }} onClick={clickBelow}
        style={!mac ? { paddingBottom: 120 + kb } : undefined}>
        <p className="nx-editor__date" contentEditable={false}>{longDate(note.updated_at || note.created_at)}</p>
        <div ref={rootRef} className="nx-doc" contentEditable suppressContentEditableWarning spellCheck
          role="textbox" aria-multiline="true" aria-label="Notitie"
          onKeyDown={onKeyDown} onPointerDown={onPointerDown} onClick={onClick} onFocus={focusIn} onBlur={focusOut} />
      </div>

      {/* Telefoon: toetsenbord open = werkbalk erboven, anders de zwevende balk met de rode ✕ */}
      {!mac && (kb > 40 || editing
        ? <div className="nx-keybar" style={{ '--nx-kb': `${kb}px`, ...(kb ? { '--nx-kb-safe': '0px' } : {}) }}>{toolbar}</div>
        : <FloatBar tools={toolbar} onHome={onHome} />)}

      {fmt && (
        <NxPortal>
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
        </NxPortal>
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
