// Leesbare naam + technische code voor agenda-items (beslissing D3).
// MyX (HAN-rooster, ICS) levert SUMMARY = cursuscode ("EMBSYP08-CO-TUT") en
// DESCRIPTION = "<code> <opleiding> <periode> <cursusnaam>" ("EMBSYP08-CO-TUT ESE S1a Embedded Systems Project").
// We tonen de cursusnaam groot en de code klein; zonder leesbare naam blijft alleen de titel.

const PROGRAM_PERIOD = /^[A-Z]{2,6}\s+S\d+[a-z]?\s+/ // "ESE S1a "

export function eventDisplay(ev) {
  const title = (ev?.title || '').trim()
  if (!ev?.external || !title) return { title: title || '(zonder titel)', code: null }
  const desc = (ev.description || '').trim()
  if (!desc.startsWith(title)) return { title, code: null }
  const name = desc.slice(title.length).trim().replace(PROGRAM_PERIOD, '').trim()
  if (!name || name === title) return { title, code: null }
  return { title: name, code: title }
}
