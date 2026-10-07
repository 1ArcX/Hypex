// Herinneringen voor belangrijke datums. Dezelfde regels staan in netlify/functions/focus-reminders.js.
// Offsets: "1d" = 1 dag ervoor, "1w" = 1 week ervoor (op reminder_time), "2h" = 2 uur vóór reminder_time op de dag zelf.
import type { CourseDate } from '../types'

export const OFFSET_OPTIONS = ['2h', '1d', '2d', '3d', '1w', '2w'] as const
export const MAX_OFFSETS = 3

export function offsetLabel(o: string, long = false) {
  const n = parseInt(o, 10)
  const u = o.slice(-1)
  const word = u === 'h' ? (n === 1 ? 'uur' : 'uur') : u === 'd' ? (n === 1 ? 'dag' : 'dagen') : (n === 1 ? 'week' : 'weken')
  return long ? `${n} ${word} van tevoren` : `${n} ${word}`
}

/** Moment waarop een herinnering afgaat (lokale tijd) */
export function reminderAt(date: string, time: string, offset: string) {
  const [hh, mm] = (time || '09:00').split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setHours(hh || 0, mm || 0, 0, 0)
  const n = parseInt(offset, 10) || 0
  const u = offset.slice(-1)
  if (u === 'h') d.setHours(d.getHours() - n)
  if (u === 'd') d.setDate(d.getDate() - n)
  if (u === 'w') d.setDate(d.getDate() - 7 * n)
  return d
}

/** Eerstvolgende herinneringen (na nu), oplopend */
export function upcomingReminders(dates: CourseDate[], now = new Date()) {
  const out: { at: Date; date: CourseDate; offset: string }[] = []
  for (const d of dates) for (const o of d.reminder_offsets || []) {
    const at = reminderAt(d.date, d.reminder_time, o)
    if (at > now) out.push({ at, date: d, offset: o })
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

export function reminderBody(title: string, date: string, offset: string) {
  const u = offset.slice(-1)
  const n = parseInt(offset, 10)
  const when = u === 'h' ? 'vandaag' : u === 'w' ? `over ${n === 1 ? '1 week' : `${n} weken`}` : n === 1 ? 'morgen' : `over ${n} dagen`
  const d = new Date(`${date}T12:00:00`)
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${title} is ${when} (${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}).`
}
