import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { loadExternalEvents } from '../../utils/externalEvents'
import { eventCategory, categoryLabel, categoryColor } from '../../utils/category'
import { taskOnDay } from '../../utils/taskStatus'
import { addDays, parseDay, todayISO } from '../../focus/lib/format'

const DAYPART_END: Record<string, string> = { ochtend: '12:00', middag: '17:00', avond: '22:00' }

// Alles wat Recap per dag nodig heeft naast de recap zelf: agenda van die dag (eigen + feeds), uren per type,
// gepland-maar-blijven-liggen, deadlines van de komende 3 dagen, studietijd per vak en de eerstvolgende toets.
// Zelfde bronnen als de agenda (Timeline) en Focus; de Claude-connector (get_recap) rekent hetzelfde.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DayEvent { id: string; title: string; start: Date; end: Date; cat: string; own: boolean; recurring: boolean; raw: any }
export interface TypeHours { cat: string; label: string; color: string; mins: number }
export interface DayDetails {
  loading: boolean
  events: DayEvent[]
  hours: TypeHours[]
  freeMins: number
  /** vandaag: minuten die nog gepland staan (na nu), niet in `hours` */
  laterMins: number
  leftOpen: any[]
  stillToCome: any[]
  deadlines: { title: string; date: string; kind: 'taak' | 'toets'; course?: string }[]
  focusByCourse: { name: string; color: string; mins: number }[]
  nextExam: { course: string; title: string; date: string; days: number } | null
  reload: () => void
}

const WAKE_MINS = 16 * 60 // vrije tijd = 16 wakkere uren min wat er gepland stond (slaap telt niet mee)
const SLEEP_RE = /(slapen|slaap|sleep|nachtrust)/i

/** Komt een eigen (herhalend) agenda-item op deze dag voor? Zelfde regels als Timeline.getEventsForDay. */
function ownOccursOn(ev: any, day: string) {
  const start = new Date(ev.start_time)
  const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const d = parseDay(day), checkD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endD = new Date(ev.end_time); const endDay = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate())
  if (checkD >= startD && checkD <= endDay) return true
  if (checkD < startD) return false
  const r = ev.recurrence
  if (r === 'daily') return true
  if (r === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5
  if (r === 'weekly') return ev.recurrence_days?.includes(d.getDay())
  if (r === 'biweekly') {
    const days = ev.recurrence_days?.length ? ev.recurrence_days : [start.getDay()]
    if (!days.includes(d.getDay())) return false
    const mon = (x: Date) => new Date(x.getTime() - ((x.getDay() + 6) % 7) * 86400000)
    return Math.round((mon(checkD).getTime() - mon(startD).getTime()) / (7 * 86400000)) % 2 === 0
  }
  if (r === 'monthly') return start.getDate() === d.getDate()
  return false
}

export function useDayDetails(userId: string, day: string, tasks: any[]): DayDetails {
  const [state, setState] = useState<Omit<DayDetails, 'leftOpen' | 'stillToCome' | 'deadlines' | 'reload'> & { examDates: any[] }>({
    loading: true, events: [], hours: [], freeMins: WAKE_MINS, laterMins: 0, focusByCourse: [], nextExam: null, examDates: [],
  })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let off = false
    const lo = new Date(`${day}T00:00:00`), hi = new Date(`${addDays(day, 1)}T00:00:00`)
    ;(async () => {
      const [own, ext, sessions, courses, dates] = await Promise.all([
        supabase.from('calendar_events').select('*').eq('user_id', userId).lt('start_time', hi.toISOString())
          .or(`recurrence.not.is.null,end_time.gte.${lo.toISOString()}`).limit(2000),
        loadExternalEvents({ since: lo.toISOString(), until: hi.toISOString() }).catch(() => null),
        supabase.from('pomodoro_sessions').select('duration_minutes, course_id, completed_at').eq('user_id', userId).eq('mode', 'work')
          .gte('completed_at', lo.toISOString()).lt('completed_at', hi.toISOString()),
        supabase.from('focus_courses').select('id, name, code, color, status').eq('user_id', userId),
        supabase.from('focus_course_dates').select('course_id, title, date, is_final').eq('user_id', userId).gte('date', day).order('date').limit(50),
      ])
      if (off) return
      const events: DayEvent[] = []
      for (const ev of (own.data || []) as any[]) {
        if (ev.description?.startsWith('pmt:') || !ownOccursOn(ev, day)) continue
        // Herhalend item: de tijd van die dag
        const s0 = new Date(ev.start_time), e0 = new Date(ev.end_time), dur = e0.getTime() - s0.getTime()
        const s = ev.recurrence && s0 < lo ? new Date(`${day}T${String(s0.getHours()).padStart(2, '0')}:${String(s0.getMinutes()).padStart(2, '0')}:00`) : s0
        events.push({ id: ev.id, title: ev.title, start: s, end: new Date(s.getTime() + dur), cat: eventCategory(ev), own: true, recurring: !!ev.recurrence, raw: ev })
      }
      for (const ev of (ext || []) as any[]) {
        if (ev.hidden) continue
        events.push({ id: ev.id, title: ev.title, start: new Date(ev.start_time), end: new Date(ev.end_time), cat: eventCategory(ev), own: false, recurring: false, raw: ev })
      }
      events.sort((a, b) => a.start.getTime() - b.start.getTime())

      // Uren per type (alleen met tijd; per item het deel binnen deze dag; overlap telt per type één keer).
      // Vandaag alleen tot nu: wat nog moet komen telt apart (laterMins).
      const cut = Math.min(hi.getTime(), Date.now())
      const byCat = new Map<string, [number, number][]>(), allBusy: [number, number][] = []
      for (const e of events) {
        if (e.raw.all_day) continue
        const s0 = Math.max(e.start.getTime(), lo.getTime()), e0 = Math.min(e.end.getTime(), hi.getTime())
        if (e0 > s0 && !SLEEP_RE.test(e.title || '')) allBusy.push([s0, e0])
        const s = s0, en = Math.min(e0, cut)
        if (en <= s) continue
        // Slaap apart (telt niet als bezig en niet als Persoonlijk)
        const cat = SLEEP_RE.test(e.title || '') ? 'slaap' : e.cat
        const list = byCat.get(cat) || []; list.push([s, en]); byCat.set(cat, list)
      }
      const merge = (list: [number, number][]) => {
        let total = 0, cur: [number, number] | null = null
        for (const [s, e] of list.sort((a, b) => a[0] - b[0])) {
          if (cur && s <= cur[1]) cur[1] = Math.max(cur[1], e)
          else { if (cur) total += cur[1] - cur[0]; cur = [s, e] }
        }
        return (cur ? total + cur[1] - cur[0] : total) / 60000
      }
      const hours = [...byCat.entries()].map(([cat, list]) => ({ cat, label: cat === 'slaap' ? 'Slaap' : categoryLabel(cat), color: cat === 'slaap' ? '#64748B' : categoryColor(cat), mins: Math.round(merge(list)) }))
        .sort((a, b) => (a.cat === 'slaap' ? 1 : 0) - (b.cat === 'slaap' ? 1 : 0) || b.mins - a.mins)
      const busyNow = Math.round(merge([...byCat.entries()].filter(([c]) => c !== 'slaap').flatMap(([, l]) => l)))
      const busy = Math.round(merge(allBusy))

      const courseList = (courses.data || []) as any[]
      const perCourse = new Map<string, number>()
      for (const s of (sessions.data || []) as any[]) perCourse.set(s.course_id || '', (perCourse.get(s.course_id || '') || 0) + (s.duration_minutes || 0))
      const focusByCourse = [...perCourse.entries()].map(([id, mins]) => {
        const c = courseList.find(x => x.id === id)
        return { name: c ? (c.code || c.name) : 'Zonder vak', color: c?.color || 'var(--c-text-3)', mins }
      }).sort((a, b) => b.mins - a.mins)

      const examDates = ((dates.data || []) as any[]).map(d => ({ ...d, course: courseList.find(c => c.id === d.course_id) }))
        .filter(d => d.course && d.course.status !== 'archived')
      const first = examDates[0]
      const nextExam = first ? { course: first.course.code || first.course.name, title: first.title, date: first.date,
        days: Math.round((parseDay(first.date).getTime() - parseDay(day).getTime()) / 86400000) } : null

      setState({ loading: false, events, hours, freeMins: Math.max(0, WAKE_MINS - busy), laterMins: Math.max(0, busy - busyNow), focusByCourse, nextExam, examDates })
    })()
    return () => { off = true }
  }, [userId, day, tick])

  useEffect(() => {
    const on = () => reload()
    window.addEventListener('refreshCalendarEvents', on)
    window.addEventListener('refreshExternalCalendarEvents', on)
    return () => { window.removeEventListener('refreshCalendarEvents', on); window.removeEventListener('refreshExternalCalendarEvents', on) }
  }, [reload])

  // Zelfde regel als de connector (planner.daySummary): blijven liggen = taken van die dag waarvan het moment voorbij is
  // (tijd vóór nu, dagdeel afgelopen, of zonder tijd) + taken die al te laat waren; nog te gaan = later vandaag.
  const today = todayISO()
  const nowHM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
  const passed = (t: any) => {
    if (day < today) return true
    if (day > today) return false
    const st = (t.start_time || t.time || '').slice(0, 5)
    if (st) return st <= nowHM
    if (t.daypart && DAYPART_END[t.daypart]) return DAYPART_END[t.daypart] <= nowHM
    return true
  }
  const lastOf = (t: any) => (t.end_date && t.end_date > t.date ? t.end_date : t.date)
  const open = tasks.filter(t => !t.recurrence && !t.completed && t.date)
  const onDay = open.filter(t => taskOnDay(t, day) && lastOf(t) <= day)
  const leftOpen = [...onDay.filter(passed), ...open.filter(t => lastOf(t) < day)]
  const stillToCome = onDay.filter(t => !passed(t))
  // Deadlines in de 3 dagen na deze dag: taken (deadline of datum met een deadline) + toetsen uit Focus
  const until = addDays(day, 3)
  const deadlines = [
    ...tasks.filter(t => !t.completed && t.due_date && t.due_date > day && t.due_date <= until).map(t => ({ title: t.title, date: t.due_date, kind: 'taak' as const })),
    ...state.examDates.filter(d => d.date > day && d.date <= until).map(d => ({ title: d.title, date: d.date, kind: 'toets' as const, course: d.course.code || d.course.name })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return { ...state, leftOpen, stillToCome, deadlines, reload }
}
