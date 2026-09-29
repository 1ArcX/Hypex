// Eén definitie van taakstatussen, gedeeld door Dashboard, Sidebar-badge, Taken en zoeken.
// "Te laat" volgt de bestaande Taken-filter: herhalende taken (routines) tellen niet mee —
// een gemiste routine is een gemiste streak, geen achterstallige taak.

export const isOpen = t => !t.completed
export const isUrgent = t => !t.completed && (t.priority ?? 2) === 1
export const isOverdue = (t, today) => !t.completed && !t.recurrence && !!t.date && t.date < today
export const isToday = (t, today) => t.date === today

/** Aantal dagen dat een taak te laat is (>= 1). */
export function daysLate(t, today) {
  if (!t.date) return 0
  const a = new Date(t.date + 'T00:00:00'), b = new Date(today + 'T00:00:00')
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
