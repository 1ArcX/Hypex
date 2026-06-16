// Dagdeel: grove planning ochtend / middag / avond.
// Een taak kan een expliciet dagdeel hebben (kolom `daypart`), anders wordt het
// afgeleid uit de starttijd. Tasks zonder beide vallen onder "geen dagdeel".

export const DAYPARTS = [
  { id: 'ochtend', label: 'Ochtend', emoji: '🌅' },
  { id: 'middag',  label: 'Middag',  emoji: '☀️' },
  { id: 'avond',   label: 'Avond',   emoji: '🌙' },
]

const ORDER = { ochtend: 0, middag: 1, avond: 2 }

export function daypartFromTime(timeStr) {
  if (!timeStr) return null
  const h = parseInt(String(timeStr).slice(0, 2), 10)
  if (Number.isNaN(h)) return null
  if (h < 12) return 'ochtend'
  if (h < 17) return 'middag'
  return 'avond'
}

export function taskDaypart(task) {
  return task.daypart || daypartFromTime(task.start_time || task.time) || null
}

export function daypartLabel(id) {
  return DAYPARTS.find(d => d.id === id)?.label || ''
}

export function daypartEmoji(id) {
  return DAYPARTS.find(d => d.id === id)?.emoji || ''
}

export function daypartOrder(id) {
  return id in ORDER ? ORDER[id] : 3 // geen dagdeel achteraan
}
