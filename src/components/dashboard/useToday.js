import { useMemo, useState, useEffect } from 'react'
import { taskCategory, eventCategory, categoryColor } from '../../utils/category'
import { eventDisplay } from '../../utils/eventTitle'
import { buildUpcoming } from '../../utils/upcoming'
import { taskOnDay } from '../../utils/taskStatus'
import { toISO } from '../../utils/recurrence'

// Data-hooks voor het dashboard: het schema van vandaag (met tijd), het volgende item en "nu bezig".

const pad2 = n => String(n).padStart(2, '0')
const hhmm = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/** Alles met een tijd vandaag (lessen, eigen/geïmporteerde events, getimede taken, werk), op tijd gesorteerd. */
export function useTodayItems(tasks, magisterLessons, calendarEvents) {
  return useMemo(() => {
    const today = toISO(new Date())
    const items = []

    // Magister lessen (cache van deze week, anders wat de agenda al geladen heeft)
    const now = new Date()
    const weekStart = (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0, 0, 0, 0); return d })()
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
    const cacheKey = `magister_sched_${toISO(weekStart)}_${toISO(weekEnd)}`
    const lessons = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey)) || [] } catch { return [] } })()
    for (const l of (lessons.length ? lessons : (magisterLessons || []))) {
      if (!l.start || l.uitgevallen) continue
      if (toISO(new Date(l.start)) !== today) continue
      const s = new Date(l.start), e = l.einde ? new Date(l.einde) : null
      items.push({ sortMins: s.getHours() * 60 + s.getMinutes(), time: hhmm(s), end: e ? hhmm(e) : null, label: l.vak || 'Les',
        sub: l.lokaal || l.location || null, color: categoryColor('school'), type: 'lesson', highlightKey: `lesson:${l.start}` })
    }

    // Eenmalige taken met tijd (routines staan apart op het dashboard)
    for (const t of tasks) {
      if (t.recurrence || t.completed || !taskOnDay(t, today)) continue
      const ts = t.start_time || t.time
      if (!ts) continue
      const [h, m] = ts.split(':').map(Number)
      items.push({ sortMins: h * 60 + m, time: ts.slice(0, 5), end: t.end_time?.slice(0, 5) || null, label: t.title,
        color: categoryColor(taskCategory(t)), type: 'task', raw: t, travelBefore: t.travel_before || 0, highlightKey: `task:${t.id}` })
    }

    // Agenda-items (eigen + geïmporteerd), niet hele-dag
    for (const ev of calendarEvents || []) {
      if (!ev.start_time || ev.all_day || ev.hidden) continue
      const s = new Date(ev.start_time)
      if (toISO(s) !== today || (s.getHours() === 0 && s.getMinutes() === 0)) continue
      const e = ev.end_time ? new Date(ev.end_time) : null
      items.push({ sortMins: s.getHours() * 60 + s.getMinutes(), time: hhmm(s), end: e ? hhmm(e) : null, label: eventDisplay(ev).title,
        sub: ev.location || null, color: categoryColor(eventCategory(ev)), type: 'event', raw: ev, travelBefore: ev.travel_before || 0, highlightKey: `event:${ev.id}` })
    }

    // Werkdiensten
    try {
      for (const s of JSON.parse(localStorage.getItem('pmt_work_shifts')) || []) {
        if (s.date?.slice(0, 10) !== today || !s.start_time) continue
        const [h, m] = s.start_time.split(':').map(Number)
        items.push({ sortMins: h * 60 + m, time: s.start_time.slice(0, 5), end: s.end_time?.slice(0, 5) || null, label: 'Werk',
          sub: s.label || null, color: categoryColor('werk'), type: 'work', highlightKey: `work:${today}:${s.start_time}` })
      }
    } catch {}

    return items.sort((a, b) => a.sortMins - b.sortMins)
  }, [tasks, magisterLessons, calendarEvents])
}

/** Eerstvolgende item (met ‹ › om verder te bladeren en een soortfilter). */
export function useNextEvent({ tasks, calendarEvents, magisterLessons, skip, typeFilter }) {
  return useMemo(() => {
    let items = buildUpcoming({ tasks, calendarEvents: (calendarEvents || []).filter(ev => !ev.hidden), magisterLessons })
    if (typeFilter && typeFilter !== 'alle') {
      const typeMap = { school: 'lesson', event: 'event', werk: 'work', taak: 'task' }
      items = items.filter(i => i.type === (typeMap[typeFilter] || typeFilter))
    }
    const idx = Math.min(skip, items.length - 1)
    const next = items[Math.max(0, idx)] || null
    if (!next) return { item: null, hasMore: false }
    return { item: next, hasMore: idx < items.length - 1 }
  }, [tasks, calendarEvents, magisterLessons, skip, typeFilter])
}

/** Loopt er op dit moment iets (les, taak met tijd, dienst, event)? */
export function useCurrentItem(todayItems) {
  return useMemo(() => {
    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const current = todayItems.find(item => {
      if (!item.end) return false
      const [eh, em] = item.end.split(':').map(Number)
      return item.sortMins <= nowMins && (eh * 60 + em) >= nowMins
    })
    if (!current) return null
    const [eh, em] = current.end.split(':').map(Number)
    return { ...current, minsLeft: Math.max(1, (eh * 60 + em) - nowMins) }
  }, [todayItems])
}

/** Minuutticker zodat countdowns ("Over 14 min") actueel blijven. */
export function useMinuteTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setT(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])
}
