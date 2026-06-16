// Herhalende taken — patronen, volgende/vorige datum en streak-logica.
// Een herhalende taak is één rij: `date` houdt de eerstvolgende keer bij.
// Bij afvinken schuift hij door naar de volgende datum (zoals iOS Herinneringen)
// en groeit/reset de streak. Pure functies, geen side effects.

export const RECURRENCE = {
  NONE: null,
  DAILY: 'daily',
  WEEKDAYS: 'weekdays', // maandag t/m vrijdag
  WEEKLY: 'weekly',     // gekozen weekdagen (recurrence_days), incl. "1x per week"
  MONTHLY: 'monthly',   // zelfde dag van de maand
}

const DAY_NAMES = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] // 1=Ma .. 7=Zo (ISO)

function pad2(n) { return String(n).padStart(2, '0') }

export function toISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO() {
  return toISO(new Date())
}

function parseISO(iso) {
  return new Date(iso + 'T00:00:00')
}

// ISO weekdag: 1=maandag .. 7=zondag
function isoDow(d) {
  const x = d.getDay()
  return x === 0 ? 7 : x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// Valt deze ISO-datum op het herhaalpatroon?
export function matchesPattern(dateStr, recurrence, days) {
  if (!recurrence || !dateStr) return false
  return patternMatch(parseISO(dateStr), recurrence, days)
}

// Snap een (start)datum naar de eerstvolgende datum die op het patroon valt.
export function snapToPattern(dateStr, recurrence, days) {
  if (!recurrence || !dateStr) return dateStr
  return matchesPattern(dateStr, recurrence, days) ? dateStr : nextOccurrence(dateStr, recurrence, days)
}

// Valt deze datum op het herhaalpatroon?
function patternMatch(d, recurrence, days) {
  const dow = isoDow(d)
  switch (recurrence) {
    case RECURRENCE.DAILY:    return true
    case RECURRENCE.WEEKDAYS: return dow >= 1 && dow <= 5
    case RECURRENCE.WEEKLY:   return days && days.length ? days.includes(dow) : true
    case RECURRENCE.MONTHLY:  return true // dag-van-maand wordt door next/prev bepaald
    default:                  return false
  }
}

// Eerstvolgende datum ná fromISO die op het patroon valt (ISO-string).
export function nextOccurrence(fromISO, recurrence, days) {
  if (recurrence === RECURRENCE.MONTHLY) {
    const d = parseISO(fromISO)
    const dom = d.getDate()
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const daysInMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
    x.setDate(Math.min(dom, daysInMonth))
    return toISO(x)
  }
  let d = addDays(parseISO(fromISO), 1)
  for (let i = 0; i < 800; i++) {
    if (patternMatch(d, recurrence, days)) return toISO(d)
    d = addDays(d, 1)
  }
  return toISO(d)
}

// Laatste datum vóór fromISO die op het patroon valt (ISO-string).
export function prevOccurrence(fromISO, recurrence, days) {
  if (recurrence === RECURRENCE.MONTHLY) {
    const d = parseISO(fromISO)
    const dom = d.getDate()
    const x = new Date(d.getFullYear(), d.getMonth(), 1)
    x.setMonth(x.getMonth() - 1)
    const daysInMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
    x.setDate(Math.min(dom, daysInMonth))
    return toISO(x)
  }
  let d = addDays(parseISO(fromISO), -1)
  for (let i = 0; i < 800; i++) {
    if (patternMatch(d, recurrence, days)) return toISO(d)
    d = addDays(d, -1)
  }
  return toISO(d)
}

// Korte leesbare omschrijving van het ritme.
export function recurrenceLabel(recurrence, days) {
  switch (recurrence) {
    case RECURRENCE.DAILY:    return 'Elke dag'
    case RECURRENCE.WEEKDAYS: return 'Ma–Vr'
    case RECURRENCE.MONTHLY:  return 'Maandelijks'
    case RECURRENCE.WEEKLY: {
      if (!days || !days.length) return 'Wekelijks'
      if (days.length === 7) return 'Elke dag'
      const sorted = [...days].sort((a, b) => a - b)
      return sorted.map(d => DAY_NAMES[d]).join('·')
    }
    default: return ''
  }
}

// Heeft deze herhalende taak een occurrence op exact deze datum (voor bv. de
// "morgen"-weergave)? Houdt rekening met de startdatum.
export function appliesOn(task, dateStr) {
  const { recurrence, recurrence_days, date } = task
  if (!recurrence || !date) return false
  const start = snapToPattern(date, recurrence, recurrence_days)
  if (dateStr < start) return false
  if (recurrence === RECURRENCE.MONTHLY) {
    return parseISO(dateStr).getDate() === parseISO(start).getDate()
  }
  return matchesPattern(dateStr, recurrence, recurrence_days)
}

// Staat deze herhalende taak vandaag (of eerder, gemist) op de planning?
// Snapt de opgeslagen datum eerst naar een geldige patroon-dag, zodat een
// routine die bv. alleen op vrijdag valt niet op dinsdag verschijnt.
export function isDueToday(task, today = todayISO()) {
  if (!task.recurrence || !task.date) return false
  const due = matchesPattern(task.date, task.recurrence, task.recurrence_days)
    ? task.date
    : nextOccurrence(task.date, task.recurrence, task.recurrence_days)
  return due <= today
}

// Vandaag al afgevinkt?
export function isDoneToday(task, today = todayISO()) {
  return task.last_completed_date === today
}

// Is de streak nog "levend" (gisteren/vorige keer ook gedaan, of vandaag)?
export function isStreakActive(task, today = todayISO()) {
  if (!task.last_completed_date) return false
  if (task.last_completed_date === today) return true
  return task.last_completed_date === prevOccurrence(today, task.recurrence, task.recurrence_days)
}

// Velden om weg te schrijven wanneer een herhalende taak wordt afgevinkt.
// Geeft null terug als er niets verandert (al gedaan vandaag).
export function advanceOnComplete(task, today = todayISO()) {
  if (task.last_completed_date === today) return null
  const { recurrence, recurrence_days } = task
  const expectedPrev = prevOccurrence(today, recurrence, recurrence_days)
  const continues = task.last_completed_date && task.last_completed_date === expectedPrev
  const streak = continues ? (task.streak || 0) + 1 : 1
  return {
    streak,
    best_streak: Math.max(task.best_streak || 0, streak),
    last_completed_date: today,
    date: nextOccurrence(today, recurrence, recurrence_days),
    completed: false,
  }
}

// Velden om weg te schrijven wanneer een afvink ongedaan wordt gemaakt.
export function revertOnUncomplete(task, today = todayISO()) {
  const { recurrence, recurrence_days } = task
  const streak = Math.max(0, (task.streak || 0) - 1)
  const prev = streak > 0 ? prevOccurrence(today, recurrence, recurrence_days) : null
  return {
    streak,
    best_streak: task.best_streak || 0,
    last_completed_date: prev,
    date: today,
    completed: false,
  }
}
