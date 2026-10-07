// Notitie-inhoud blijft platte tekst (zoekpalette en Hypex AI lezen/schrijven `notes.content`).
// Elke regel is een blok:
//   "# kop"            → heading
//   "- [ ] item"       → check (open),  "- [x] item" → check (af)
//   "- item"           → bullet
//   "1. item"          → number
//   anders             → text
// parse() en serialize() zijn elkaars omgekeerde, dus bestaande notities blijven exact gelijk.

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

export function parseLine(line) {
  let m
  if ((m = line.match(/^- \[( |x|X)\] ?(.*)$/))) return { type: 'check', done: m[1] !== ' ', text: m[2] }
  if ((m = line.match(/^# (.*)$/))) return { type: 'heading', text: m[1] }
  if ((m = line.match(/^([-•*]) (.*)$/))) return { type: 'bullet', mark: m[1], text: m[2] }
  if ((m = line.match(/^\d+[.)] (.*)$/))) return { type: 'number', text: m[1] }
  return { type: 'text', text: line }
}

export function parse(content) {
  return String(content ?? '').split('\n').map(line => ({ id: newId(), ...parseLine(line) }))
}

export function serializeBlock(b, n = 1) {
  if (b.type === 'check') return `- [${b.done ? 'x' : ' '}] ${b.text}`
  if (b.type === 'heading') return `# ${b.text}`
  if (b.type === 'bullet') return `${b.mark || '-'} ${b.text}`
  if (b.type === 'number') return `${n}. ${b.text}`
  return b.text
}

/** Nummers lopen door binnen een aaneengesloten genummerde lijst. */
export function numberOf(blocks, i) {
  let n = 1
  for (let j = i - 1; j >= 0 && blocks[j].type === 'number'; j--) n++
  return n
}

export function serialize(blocks) {
  return blocks.map((b, i) => serializeBlock(b, numberOf(blocks, i))).join('\n')
}

/** Leesbare voorbeeldtekst voor de lijst (zonder markeringen). */
export function preview(content, max = 120) {
  const out = []
  for (const line of String(content ?? '').split('\n')) {
    const b = parseLine(line)
    const t = b.text.trim()
    if (!t) continue
    out.push(b.type === 'check' ? `${b.done ? '☑' : '○'} ${t}` : t)
    if (out.join(' ').length > max) break
  }
  return out.join(' ').slice(0, max)
}

/** { done, total } van de afvinklijst in een notitie, of null zonder checklist. */
export function checklistProgress(content) {
  let done = 0, total = 0
  for (const line of String(content ?? '').split('\n')) {
    const m = line.match(/^- \[( |x|X)\]/)
    if (m) { total++; if (m[1] !== ' ') done++ }
  }
  return total ? { done, total } : null
}
