// Eén definitie van taakstatussen, gedeeld door Dashboard, Sidebar-badge, Taken en zoeken.
// "Te laat" volgt de bestaande Taken-filter: herhalende taken (routines) tellen niet mee —
// een gemiste routine is een gemiste streak, geen achterstallige taak.

import { appliesOn } from './recurrence'

/** Laatste dag van een taak: einddatum bij een meerdaagse taak, anders de datum. */
export const taskLastDate = t => (t.end_date && t.date && t.end_date > t.date ? t.end_date : t.date)
export const isMultiDay = t => !t.recurrence && !!t.end_date && !!t.date && t.end_date > t.date

/** Valt de taak op deze dag? Routines volgen hun patroon; meerdaagse taken staan op elke dag van date t/m end_date. */
export function taskOnDay(t, ds) {
  if (t.recurrence) return appliesOn(t, ds)
  if (!t.date) return false
  return ds >= t.date && ds <= taskLastDate(t)
}

export const isOpen = t => !t.completed
export const isUrgent = t => !t.completed && (t.priority ?? 2) === 1
export const isOverdue = (t, today) => !t.completed && !t.recurrence && !!t.date && taskLastDate(t) < today
export const isToday = (t, today) => taskOnDay(t, today)

/** Korte weergave van een meerdaagse periode: "ma–vr", of "19 okt – 2 nov". */
export function spanLabel(t) {
  if (!isMultiDay(t)) return ''
  const a = new Date(t.date + 'T00:00:00'), b = new Date(t.end_date + 'T00:00:00')
  const days = Math.round((b - a) / 86400000)
  if (days < 7) {
    const dn = d => d.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '')
    return `${dn(a)}–${dn(b)}`
  }
  const f = d => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${f(a)} – ${f(b)}`
}

/** Aantal dagen dat een taak te laat is (>= 1). */
export function daysLate(t, today) {
  if (!t.date) return 0
  const a = new Date(taskLastDate(t) + 'T00:00:00'), b = new Date(today + 'T00:00:00')
  return Math.max(1, Math.round((b - a) / 86400000))
}

/** Korte Nederlandse datum voor pills: "Vandaag", "Morgen", "Gisteren", "25 sep". */
export function shortDate(iso, today) {
  if (!iso) return ''
  if (iso === today) return 'Vandaag'
  const d = new Date(iso + 'T00:00:00'), t = new Date(today + 'T00:00:00')
  const diff = Math.round((d - t) / 86400000)
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gisteren'
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}
