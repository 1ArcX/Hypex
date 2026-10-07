import { parseLine } from './noteFormat'

// Pure bewerkingen op een notitie als lijst regels: lines[0] is de titel, daarna de blokken
// ({ type: 'text'|'heading'|'check'|'bullet'|'number', text, done?, mark? }).
// Een positie is { line, off } (regelindex + tekenpositie). Alles geeft nieuwe objecten terug.

export const clone = (lines) => lines.map(l => ({ ...l }))
const cmp = (a, b) => a.line - b.line || a.off - b.off
export const order = (a, b) => (cmp(a, b) <= 0 ? [a, b] : [b, a])

/** Tekst tussen twee posities weghalen; regels ertussen vallen weg, eerste regel houdt zijn type. */
export function removeRange(lines, a, b) {
  const [s, e] = order(a, b)
  const out = clone(lines)
  if (s.line === e.line) {
    const l = out[s.line]
    l.text = l.text.slice(0, s.off) + l.text.slice(e.off)
  } else {
    out[s.line].text = out[s.line].text.slice(0, s.off) + out[e.line].text.slice(e.off)
    out.splice(s.line + 1, e.line - s.line)
  }
  return { lines: out, caret: { line: s.line, off: s.off } }
}

/** Enter: regel splitsen zoals Apple Notes. */
export function splitAt(lines, c) {
  const out = clone(lines)
  const l = out[c.line]
  const isList = l.type === 'check' || l.type === 'bullet' || l.type === 'number'
  if (isList && !l.text) { // lege lijstregel + Enter = einde van de lijst
    out[c.line] = { type: 'text', text: '' }
    return { lines: out, caret: { line: c.line, off: 0 } }
  }
  const before = l.text.slice(0, c.off), after = l.text.slice(c.off)
  l.text = before
  const type = l.type === 'title' || l.type === 'heading' ? 'text' : l.type
  const nl = { type, text: after, ...(type === 'check' ? { done: false } : {}), ...(type === 'bullet' && l.mark ? { mark: l.mark } : {}) }
  out.splice(c.line + 1, 0, nl)
  return { lines: out, caret: { line: c.line + 1, off: 0 } }
}

/** Backspace aan het begin van een regel: eerst opmaak weg, daarna samenvoegen met de vorige regel. */
export function backspaceAtStart(lines, c) {
  const out = clone(lines)
  const l = out[c.line]
  if (c.line === 0) return null
  if (l.type !== 'text') {
    out[c.line] = { type: 'text', text: l.text }
    return { lines: out, caret: { line: c.line, off: 0 } }
  }
  const prev = out[c.line - 1]
  const off = prev.text.length
  prev.text += l.text
  out.splice(c.line, 1)
  return { lines: out, caret: { line: c.line - 1, off } }
}

/** Delete aan het eind van een regel: volgende regel erachter plakken. */
export function deleteAtEnd(lines, c) {
  if (c.line >= lines.length - 1) return null
  const out = clone(lines)
  out[c.line].text += out[c.line + 1].text
  out.splice(c.line + 1, 1)
  return { lines: out, caret: { ...c } }
}

/** Tekst invoegen (typen over een selectie, plakken). Meerdere regels worden blokken. */
export function insertText(lines, c, text) {
  const parts = String(text).replace(/\r\n?/g, '\n').split('\n')
  const out = clone(lines)
  const l = out[c.line]
  const tail = l.text.slice(c.off)
  l.text = l.text.slice(0, c.off) + parts[0]
  if (parts.length === 1) { l.text += tail; return { lines: out, caret: { line: c.line, off: c.off + parts[0].length } } }
  const extra = parts.slice(1).map(p => parseLine(p))
  const last = extra[extra.length - 1]
  const off = last.text.length
  last.text += tail
  out.splice(c.line + 1, 0, ...extra)
  return { lines: out, caret: { line: c.line + extra.length, off } }
}

const SHORTCUTS = [
  [/^(- \[ \] |\[\] |\[ \] )/, { type: 'check', done: false }],
  [/^- \[x\] /i, { type: 'check', done: true }],
  [/^# /, { type: 'heading' }],
  [/^([-*•]) /, { type: 'bullet' }],
  [/^1[.)] /, { type: 'number' }],
]

/** "- ", "[ ] ", "1. ", "# " aan het begin van een tekstregel → opmaak. Geeft null als er niets verandert. */
export function applyShortcut(lines, c) {
  const l = lines[c.line]
  if (!l || c.line === 0) return null
  let patch = null, len = 0
  if (l.type === 'bullet') {
    const m = l.text.match(/^\[ ?\] /)
    if (m) { patch = { type: 'check', done: false }; len = m[0].length }
  } else if (l.type === 'text') {
    for (const [re, p] of SHORTCUTS) {
      const m = l.text.match(re)
      if (m) { patch = { ...p, ...(p.type === 'bullet' ? { mark: m[1] } : {}) }; len = m[0].length; break }
    }
  }
  if (!patch) return null
  const out = clone(lines)
  out[c.line] = { ...patch, text: l.text.slice(len) }
  return { lines: out, caret: { line: c.line, off: Math.max(0, c.off - len) } }
}

/** Type van een regel wisselen via de werkbalk (zelfde type nogmaals = terug naar tekst). */
export function setLineType(lines, c, type) {
  const out = clone(lines)
  let i = c?.line ?? 0
  if (i === 0) { // in de titel → regel eronder, of een nieuwe
    if (out.length > 1 && !out[1].text && out[1].type === 'text') i = 1
    else { out.splice(1, 0, { type: 'text', text: '' }); i = 1 }
  }
  const l = out[i]
  const next = l.type === type ? 'text' : type
  out[i] = { type: next, text: l.text, ...(next === 'check' ? { done: false } : {}) }
  return { lines: out, caret: { line: i, off: i === c?.line ? c.off : out[i].text.length } }
}
