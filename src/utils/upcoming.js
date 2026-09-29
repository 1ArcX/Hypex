// Komende agenda-items uit alle bronnen (taken met tijd, lessen, eigen/geïmporteerde events,
// PMT-diensten), gesorteerd op starttijd. Gedeeld door Dashboard ("Volgende afspraak") en Hypex AI.
import { taskCategory, eventCategory } from './category'
import { eventDisplay } from './eventTitle'

const pad2 = n => String(n).padStart(2, '0')
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

function weekLessonsFromCache(now, magisterLessons) {
  const weekStart = (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0, 0, 0, 0); return d })()
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)) || [] } catch { return [] } }
  const cached = read(`magister_sched_${ymd(weekStart)}_${ymd(weekEnd)}`)
  const nextStart = new Date(weekStart); nextStart.setDate(weekStart.getDate() + 7)
  const nextEnd = new Date(weekEnd); nextEnd.setDate(weekEnd.getDate() + 7)
  const nextWeek = read(`magister_sched_${ymd(nextStart)}_${ymd(nextEnd)}`)
  return [...(cached.length ? cached : (magisterLessons || [])), ...nextWeek]
}

/** Alle komende items (start >= nu), oplopend. type: 'task' | 'lesson' | 'event' | 'work'. */
export function buildUpcoming({ tasks = [], calendarEvents = [], magisterLessons = [], now = new Date() }) {
  const at = (date, time) => time ? new Date(date + 'T' + time.slice(0, 5)) : null
  const shifts = (() => { try { return JSON.parse(localStorage.getItem('pmt_work_shifts')) || [] } catch { return [] } })()
  return [
    ...tasks.filter(t => t.date && (t.time || t.start_time) && !t.completed)
      .map(t => {
        const ts = (t.start_time || t.time || '').slice(0, 5)
        return { label: t.title, ts: new Date(t.date + 'T' + ts), end: at(t.date, t.end_time), type: 'task', raw: t, cat: taskCategory(t), highlightKey: `task:${t.id}` }
      })
      .filter(t => t.ts >= now),
    ...weekLessonsFromCache(now, magisterLessons).filter(l => l.start && !l.uitgevallen && new Date(l.start) >= now)
      .map(l => ({ label: l.vak || 'Les', ts: new Date(l.start), end: l.einde ? new Date(l.einde) : null, location: l.lokaal || l.location, type: 'lesson', cat: 'school', highlightKey: `lesson:${l.start}` })),
    ...calendarEvents.filter(ev => ev.start_time && new Date(ev.start_time) >= now)
      .map(ev => {
        const disp = eventDisplay(ev)
        return { label: disp.title, code: disp.code, ts: new Date(ev.start_time), end: ev.end_time ? new Date(ev.end_time) : null, location: ev.location, type: 'event', raw: ev, cat: eventCategory(ev), highlightKey: `event:${ev.id}` }
      }),
    ...shifts.filter(s => s.date && (s.start_time || s.start))
      .map(s => {
        const timeStr = s.start_time || s.start || '09:00'
        const day = s.date.slice(0, 10)
        return { label: 'Werk', ts: new Date(day + 'T' + timeStr), end: at(day, s.end_time || s.end), type: 'work', cat: 'werk', highlightKey: `work:${day}:${timeStr}` }
      })
      .filter(s => s.ts >= now),
  ].sort((a, b) => a.ts - b.ts)
}

/** "Over 14 min" / "Over 2u 10m" / "Morgen" / "Over 3 dagen". */
export function countdownLabel(ts, now = new Date()) {
  const mins = Math.round((ts - now) / 60000)
  const sameDay = ts.toDateString() === now.toDateString()
  if (sameDay && mins < 60) return mins <= 0 ? 'Nu' : `Over ${mins} min`
  if (sameDay) return `Over ${Math.floor(mins / 60)}u${mins % 60 ? ` ${mins % 60}m` : ''}`
  const a = new Date(now); a.setHours(0, 0, 0, 0)
  const b = new Date(ts); b.setHours(0, 0, 0, 0)
  const days = Math.round((b - a) / 86400000)
  return days === 1 ? 'Morgen' : `Over ${days} dagen`
}
