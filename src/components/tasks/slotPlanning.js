// Planningshulp voor ItemModal: vrije momenten voorstellen en overlap met lessen, werk,
// agenda-items en andere taken melden. Lessen komen uit de Magister-cache (sessionStorage),
// werkdiensten uit pmt_work_shifts (localStorage).
import { toISO } from '../../utils/recurrence'
import { taskOnDay } from '../../utils/taskStatus'

const pad = n => String(n).padStart(2, '0')
export function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export function minsToTimeStr(mins) {
  const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59)
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

const TRAVEL_MINS = 30 // reistijd buffer voor school en werk

const NL_DAYS   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const NL_MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
export function formatDutchDate(d) {
  return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
}

export function suggestFreeSlots(durationMins, tasks, calendarEvents, maxResults = 8) {
  const now = new Date()
  const todayStr = toISO(now)
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30 // 30 min buffer
  const results = []
  for (let i = 0; i < 14 && results.length < maxResults; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const dateStr = toISO(d)
    const slots = getFreeSlots(dateStr, durationMins, tasks, calendarEvents)
    for (const slot of slots) {
      if (dateStr === todayStr && timeStrToMins(slot.startStr) < nowMins) continue
      results.push({ dateStr, slot, d: new Date(d) })
      if (results.length >= maxResults) break
    }
  }
  return results
}

export function getFreeSlots(dateStr, durationMins, tasks, calendarEvents) {
  const bezet = []

  // 1. Magister lessen + reistijd aan beide kanten
  Object.keys(sessionStorage)
    .filter(k => k.startsWith('magister_sched_'))
    .forEach(k => {
      try {
        const lessons = JSON.parse(sessionStorage.getItem(k)) || []
        lessons
          .filter(l => {
            if (!l.start || l.uitgevallen) return false
            if (toISO(new Date(l.start)) !== dateStr) return false
            const vak = (l.vak || '').toUpperCase().trim()
            if (vak === 'LNK' || vak.startsWith('LNK ')) return false // keuze werktijd
            return true
          })
          .forEach(l => {
            const s = new Date(l.start)
            const e = new Date(l.einde || l.start)
            bezet.push({
              start: s.getHours() * 60 + s.getMinutes() - TRAVEL_MINS,
              end:   e.getHours() * 60 + e.getMinutes() + TRAVEL_MINS,
            })
          })
      } catch {}
    })

  // 2. Werkdiensten + reistijd aan beide kanten
  try {
    const shifts = JSON.parse(localStorage.getItem('pmt_work_shifts')) || []
    shifts.filter(s => s.date?.slice(0, 10) === dateStr).forEach(s => {
      if (s.start_time && s.end_time)
        bezet.push({
          start: timeStrToMins(s.start_time) - TRAVEL_MINS,
          end:   timeStrToMins(s.end_time)   + TRAVEL_MINS,
        })
    })
  } catch {}

  // 3. Agenda-events (geen reistijd)
  ;(calendarEvents || []).forEach(ev => {
    try {
      const s = new Date(ev.start_time)
      if (toISO(s) !== dateStr) return
      const e = new Date(ev.end_time)
      bezet.push({ start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() })
    } catch {}
  })

  // 4. Al geplande taken (geen reistijd)
  ;(tasks || []).filter(t => !t.recurrence && taskOnDay(t, dateStr) && t.start_time && t.end_time).forEach(t => {
    bezet.push({ start: timeStrToMins(t.start_time), end: timeStrToMins(t.end_time) })
  })

  // Merge bezette blokken
  bezet.sort((a, b) => a.start - b.start)
  const merged = []
  for (const b of bezet) {
    if (merged.length && b.start <= merged[merged.length - 1].end)
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end)
    else
      merged.push({ ...b })
  }

  // Bouw vrije periodes op (07:00–22:00)
  const DAY_START = 420, DAY_END = 1320
  const freePeriods = []
  let cursor = DAY_START
  for (const b of merged) {
    const bStart = Math.max(b.start, DAY_START)
    if (bStart > cursor && bStart - cursor >= durationMins)
      freePeriods.push({ start: cursor, end: bStart })
    if (b.end > cursor) cursor = b.end
  }
  if (DAY_END - cursor >= durationMins)
    freePeriods.push({ start: cursor, end: DAY_END })

  // Genereer kandidaattijden op 30-min grenzen binnen vrije periodes
  const candidates = []
  for (const p of freePeriods) {
    const roundedStart = Math.ceil(p.start / 30) * 30
    for (let t = roundedStart; t + durationMins <= Math.min(p.end, DAY_END); t += 30)
      candidates.push(t)
  }
  if (!candidates.length) return []

  // Geef voorkeur aan tijden vanaf 09:00
  const afterNine  = candidates.filter(t => t >= 540) // 09:00
  const afterEight = candidates.filter(t => t >= 480) // 08:00
  const pool = afterNine.length >= 2 ? afterNine : afterEight.length > 0 ? afterEight : candidates

  // Kies 3: eerste, midden en laatste van de pool (max spreiding)
  let picks
  if (pool.length <= 3) {
    picks = pool
  } else {
    const n = pool.length
    picks = [pool[0], pool[Math.floor(n / 2)], pool[n - 1]]
  }

  return picks.map(t => ({
    startStr: minsToTimeStr(t),
    endStr:   minsToTimeStr(t + durationMins),
  }))
}

export function getConflicts(dateStr, startMins, endMins, tasks, calendarEvents, excludeId) {
  if (!dateStr || startMins >= endMins) return []
  const hits = []

  Object.keys(sessionStorage)
    .filter(k => k.startsWith('magister_sched_'))
    .forEach(k => {
      try {
        const lessons = JSON.parse(sessionStorage.getItem(k)) || []
        lessons.forEach(l => {
          if (!l.start || l.uitgevallen) return
          if (toISO(new Date(l.start)) !== dateStr) return
          const vak = (l.vak || '').toUpperCase().trim()
          if (vak === 'LNK' || vak.startsWith('LNK ')) return
          const s = new Date(l.start), e = new Date(l.einde || l.start)
          const ls = s.getHours() * 60 + s.getMinutes()
          const le = e.getHours() * 60 + e.getMinutes()
          if (startMins < le && endMins > ls) hits.push(l.vak || 'Les')
        })
      } catch {}
    })

  try {
    const shifts = JSON.parse(localStorage.getItem('pmt_work_shifts')) || []
    shifts.filter(s => s.date?.slice(0, 10) === dateStr && s.start_time && s.end_time).forEach(s => {
      const ss = timeStrToMins(s.start_time), se = timeStrToMins(s.end_time)
      if (startMins < se && endMins > ss) hits.push('Werk')
    })
  } catch {}

  ;(calendarEvents || []).forEach(ev => {
    try {
      const s = new Date(ev.start_time)
      if (ev.id === excludeId || ev.hidden || toISO(s) !== dateStr) return
      const e = new Date(ev.end_time)
      const es = s.getHours() * 60 + s.getMinutes()
      const ee = e.getHours() * 60 + e.getMinutes()
      if (startMins < ee && endMins > es) hits.push(ev.title || 'Event')
    } catch {}
  })

  ;(tasks || []).filter(t => !t.recurrence && taskOnDay(t, dateStr) && t.id !== excludeId && t.start_time && t.end_time).forEach(t => {
    const ts = timeStrToMins(t.start_time), te = timeStrToMins(t.end_time)
    if (startMins < te && endMins > ts) hits.push(t.title || 'Taak')
  })

  return [...new Set(hits)]
}
