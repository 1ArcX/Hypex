import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { todayISO } from './format'
import type { Course, Session } from '../types'

// Welk vak staat er standaard klaar bij een nieuwe sessie of de timer?
// 1. het vak van de taak die nu (of straks vandaag) gepland staat, herkend aan vakcode of naam in de titel;
// 2. anders het vak dat je het laatst gebruikte;
// 3. anders niets ("Zonder vak").

const norm = (s: string | null | undefined) => String(s || '').toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, '')

/** Vak dat in een tekst genoemd wordt (vakcode als "NET2" / "VHDL TH" of de naam). Langste treffer wint. */
export function courseInText(text: string, courses: Course[]): Course | null {
  const t = norm(text)
  if (!t) return null
  let best: Course | null = null, bestLen = 0
  for (const c of courses) {
    for (const key of [c.code, c.name]) {
      const k = norm(key)
      if (k.length >= 3 && t.includes(k) && k.length > bestLen) { best = c; bestLen = k.length }
    }
  }
  return best
}

export function lastUsedCourse(sessions: Session[], courses: Course[]): string | null {
  const active = new Set(courses.filter(c => c.status === 'active').map(c => c.id))
  return sessions.find(s => s.course_id && active.has(s.course_id))?.course_id || null
}

interface TaskLite { title: string; description: string | null; start_time: string | null; time: string | null; end_time: string | null; completed: boolean }
const toMin = (hm: string | null) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m }

/** Vak van de taak die nu loopt, anders de eerstvolgende met een tijd vandaag, anders een taak van vandaag zonder tijd. */
export function plannedCourse(tasks: TaskLite[], courses: Course[], now = new Date()): string | null {
  const active = courses.filter(c => c.status === 'active')
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const open = tasks.filter(t => !t.completed).map(t => {
    const s = toMin(t.start_time || t.time), e = toMin(t.end_time) ?? (s != null ? s + 60 : null)
    return { t, s, e, course: courseInText(`${t.title} ${t.description || ''}`, active) }
  }).filter(x => x.course)
  const running = open.find(x => x.s != null && x.e != null && x.s <= nowMin && nowMin < x.e)
  const upcoming = open.filter(x => x.s != null && x.s > nowMin).sort((a, b) => a.s! - b.s!)[0]
  const untimed = open.find(x => x.s == null)
  return (running || upcoming || untimed)?.course?.id || null
}

let cache: { day: string; userId: string; tasks: TaskLite[] } | null = null

/** Standaardvak (id of null). Haalt één keer per dag de taken van vandaag op. */
export function useDefaultCourse(userId: string | null, courses: Course[], sessions: Session[]): string | null {
  const day = todayISO()
  const [tasks, setTasks] = useState<TaskLite[] | null>(cache && cache.day === day && cache.userId === userId ? cache.tasks : null)
  useEffect(() => {
    if (!userId || tasks) return
    let off = false
    supabase.from('tasks').select('title, description, start_time, time, end_time, completed').eq('user_id', userId).eq('date', day).limit(200)
      .then(({ data }) => {
        const list = (data || []) as TaskLite[]
        cache = { day, userId, tasks: list }
        if (!off) setTasks(list)
      })
    return () => { off = true }
  }, [userId, day, tasks])
  return (tasks && plannedCourse(tasks, courses)) || lastUsedCourse(sessions, courses)
}
