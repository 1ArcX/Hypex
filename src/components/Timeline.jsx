import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2 } from 'lucide-react'
import { callMagister } from '../utils/magisterApi'
import { callSomtoday, ensureSomtodayCreds } from '../utils/somtodayApi'
import { appliesOn } from '../utils/recurrence'
import { taskCategory, eventCategory, categoryColor, CATEGORIES, CATEGORY_ORDER } from '../utils/category'
import { eventDisplay } from '../utils/eventTitle'
import { loadExternalEvents } from '../utils/externalEvents'
import ExternalEventModal from './agenda/ExternalEventModal'
import { FilterTabs, IconButton } from './ui'
import { useViewport } from '../hooks/useViewport'

const WORK = 'var(--cat-werk)' // = categoryColor('werk')

// v2 event-blok: lichte tint van de categoriekleur, duidelijke rand, dikke linkerrand
function blockStyle(color, extra = {}) {
  return {
    position: 'absolute', overflow: 'hidden', boxSizing: 'border-box', marginLeft: '2px', cursor: 'pointer',
    borderRadius: 6, padding: '3px 7px',
    background: `color-mix(in srgb, ${color} 13%, var(--c-bg))`,
    border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
    borderLeft: `3px solid ${color}`,
    ...extra,
  }
}
// Toetsenbord-toegang voor klikbare blokken (Enter/Spatie = klik)
const kbdClick = (label, fn) => ({
  role: 'button', tabIndex: 0, 'aria-label': label,
  onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e) } },
})
const blockTitle = (color, extra = {}) => ({ fontSize: '11px', fontWeight: 700, color: `color-mix(in srgb, ${color} 55%, white)`, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...extra })
const blockMeta = (color) => ({ fontSize: '10px', color: `color-mix(in srgb, ${color} 45%, var(--c-text-2))`, lineHeight: 1.3, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })

const BASE_HOUR_H = 56 // mobiel; desktop schaalt mee met de vensterhoogte (zie hourHeight)

// Uurhoogte zodat ~15 uur (07–22) in beeld past; hoge schermen krijgen fijnere vakjes
function hourHeight(viewportH) {
  return Math.round(Math.min(140, Math.max(48, (viewportH - 210) / 15)))
}
// Achtergrond van een uurvak: halfuurlijn, en kwartierlijnen als er ruimte is
function slotBackground(hourH) {
  const line = (pct, a) => `linear-gradient(to bottom, transparent calc(${pct}% - 0.5px), rgba(255,255,255,${a}) calc(${pct}% - 0.5px), rgba(255,255,255,${a}) calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px))`
  if (hourH >= 96) return [line(25, 0.014), line(50, 0.03), line(75, 0.014)].join(', ')
  return line(50, 0.018)
}
const TIME_COL = 48
const magisterKey = (userId) => `magister_credentials_${userId}`

const MONTHS_FULL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
const DAYS_SHORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']
const DAYS_FULL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
const EVENT_COLORS = ['#FF6B6B','#FF8C42','#FACC15','#4ADE80','#00FFD1','#38BDF8','#818CF8','#F472B6']

function pad(n) { return String(n).padStart(2, '0') }
function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, ' ').trim()
}
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function getWeekDays(date) {
  const start = new Date(date)
  const day = date.getDay()
  start.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({length:7}, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d })
}
function getMonthRange(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const endDow = (lastDay.getDay() + 6) % 7
  const start = new Date(firstDay); start.setDate(start.getDate() - startDow)
  const end = new Date(lastDay); end.setDate(end.getDate() + (6 - endDow))
  return { start, end }
}
function mergeLessons(prev, next) {
  const keys = new Set(next.map(l => `${l.start}|${l.vak || ''}|${l.lokaal || ''}`))
  return [...prev.filter(l => !keys.has(`${l.start}|${l.vak || ''}|${l.lokaal || ''}`)), ...next]
}
function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return (h||0)*60 + (m||0)
}
function fmtTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Compute side-by-side layout for overlapping items (Apple Calendar style)
function layoutOverlaps(items) {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) =>
    a.startMins !== b.startMins ? a.startMins - b.startMins : b.endMins - a.endMins
  )
  const colEnds = []
  for (const item of sorted) {
    let placed = false
    for (let ci = 0; ci < colEnds.length; ci++) {
      if (colEnds[ci] <= item.startMins) {
        item._col = ci
        colEnds[ci] = item.endMins
        placed = true
        break
      }
    }
    if (!placed) {
      item._col = colEnds.length
      colEnds.push(item.endMins)
    }
  }
  for (const item of sorted) {
    let maxCol = item._col
    for (const other of sorted) {
      if (other.startMins < item.endMins && other.endMins > item.startMins) {
        maxCol = Math.max(maxCol, other._col)
      }
    }
    item._colTotal = maxCol + 1
  }
  return sorted
}

// Hele-dag-item: expliciet (feed/aanpassing) of start om 00:00 (eigen items)
function isAllDayEvent(ev) {
  if (ev.all_day) return true
  const s = new Date(ev.start_time)
  return s.getHours() === 0 && s.getMinutes() === 0
}

const emptyForm = (date, hour, minute = 0) => ({
  title: '', description: '',
  date: toDateStr(date || new Date()),
  endDate: '',
  allDay: false,
  startTime: hour !== undefined ? `${pad(hour)}:${pad(minute)}` : '09:00',
  endTime: hour !== undefined ? (hour >= 23 ? '23:59' : `${pad(hour + 1)}:${pad(minute)}`) : '10:00',
  color: '#818CF8', recurrence: '', recurrence_days: []
})

const SOMTODAY_EMAIL = 'jbrugman.prive@gmail.com'

export default function Timeline({ userId, userEmail, tasks, subjects, onEditTask, onViewDetail, defaultView = 'week', initialDate, isMobile = false, hideToolbar = false, onLessonsChange, onEventsChange, onMagisterError, onDateChange, highlightKey }) {
  const [view, setView] = useState(defaultView)
  const vp = useViewport()
  // Smal maar hoog venster: legenda + mini-maand als strook onder het rooster (zie .agenda-shell in index.css)
  const railBelow = !isMobile && vp.w < 1280 && vp.h >= 1100
  const HOUR_H = isMobile ? BASE_HOUR_H : hourHeight(vp.h - (railBelow ? 250 : 0))
  const quarterSlots = HOUR_H >= 96
  const [current, setCurrent] = useState(initialDate || new Date())
  const [events, setEvents] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm(new Date()))
  const [saving, setSaving] = useState(false)
  const [magisterLessons, setMagisterLessons] = useState([])
  const [somtodayLessons, setSomtodayLessons] = useState([])
  const [lessonDetail, setLessonDetail] = useState(null)
  const [showHidden, setShowHidden] = useState(() => { try { return localStorage.getItem('agenda_show_hidden') === '1' } catch { return false } })
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [magisterSyncing, setMagisterSyncing] = useState(false)
  const [magisterError, setMagisterError] = useState(null)
  const scrollRef = useRef(null)
  const autoScrollKeyRef = useRef('')
  const swipeStartX = useRef(null)
  const swipeStartY = useRef(null)
  const swipeIntent = useRef(null) // 'h' | 'v' | null
  const monthScrollRef = useRef(null)
  const monthItemRefs = useRef({})
  const highlightRef = useRef(null)
  const now = new Date()

  const getItemHighlightKey = (item) => {
    const d = item.data
    if (item.type === 'lesson') return `lesson:${d.start}`
    if (item.type === 'event') return `event:${d.id}`
    if (item.type === 'work') { const t = d.start_time || d.start || ''; return `work:${d.date?.slice(0,10)}:${t}` }
    if (item.type === 'task') return `task:${d.id}`
    return null
  }

  useEffect(() => {
    if (!highlightKey) return
    const timer = setTimeout(() => {
      if (highlightRef.current && scrollRef.current) {
        const el = highlightRef.current
        scrollRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 80), behavior: 'smooth' })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [highlightKey])

  useEffect(() => {
    fetchEvents()
    window.addEventListener('refreshCalendarEvents', fetchEvents)
    window.addEventListener('refreshExternalCalendarEvents', fetchEvents)
    return () => {
      window.removeEventListener('refreshCalendarEvents', fetchEvents)
      window.removeEventListener('refreshExternalCalendarEvents', fetchEvents)
    }
  }, [])
  useEffect(() => { onLessonsChange?.([...magisterLessons, ...somtodayLessons]) }, [magisterLessons, somtodayLessons])
  useEffect(() => { onEventsChange?.(events) }, [events])

  useLayoutEffect(() => {
    if (!scrollRef.current) return
    const isToday = view === 'day' && isSameDay(current, now)
    if (isToday) {
      scrollRef.current.scrollTop = Math.max(0, now.getHours() - 1) * HOUR_H
      return
    }
    // Scroll naar eerste event/les/werk, maar niet opnieuw als data al geladen was
    const dataKey = `${view}-${toDateStr(current)}-${magisterLessons.length}-${somtodayLessons.length}`
    if (autoScrollKeyRef.current === dataKey) return
    autoScrollKeyRef.current = dataKey

    const days = view === 'week' ? getWeekDays(current) : [current]
    let minMins = Infinity
    for (const d of days) {
      for (const les of getMagisterLessonsForDay(d)) {
        const s = new Date(les.start)
        if (s.getHours() === 0 && s.getMinutes() === 0) continue
        minMins = Math.min(minMins, s.getHours() * 60 + s.getMinutes())
      }
      for (const sh of getWorkShiftsForDay(d)) {
        const m = timeStrToMins(sh.start); if (m > 0) minMins = Math.min(minMins, m)
      }
      for (const ev of getEventsForDay(d)) {
        const s = new Date(ev.start_time)
        if (s.getHours() === 0 && s.getMinutes() === 0) continue
        minMins = Math.min(minMins, s.getHours() * 60 + s.getMinutes())
      }
      for (const task of getTasksForDay(d)) {
        const timeStr = task.start_time || task.time
        if (timeStr) minMins = Math.min(minMins, timeStrToMins(timeStr))
      }
    }
    scrollRef.current.scrollTop = minMins === Infinity
      ? 7 * HOUR_H
      : Math.max(0, (minMins / 60 - 0.5) * HOUR_H)
  }, [view, toDateStr(current), magisterLessons.length, somtodayLessons.length])

  // Scroll to current month when in month view
  useLayoutEffect(() => {
    if (view !== 'month') return
    const key = `${current.getFullYear()}-${current.getMonth()}`
    const el = monthItemRefs.current[key]
    if (el && monthScrollRef.current) el.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [view, current.getFullYear(), current.getMonth()])

  const handleSwipeStart = (e) => {
    if (view === 'month') return
    const t = e.touches[0]
    swipeStartX.current = t.clientX
    swipeStartY.current = t.clientY
    swipeIntent.current = null
  }
  const handleSwipeMove = (e) => {
    if (view === 'month' || swipeStartX.current === null) return
    if (swipeIntent.current === null) {
      const dx = Math.abs(e.touches[0].clientX - swipeStartX.current)
      const dy = Math.abs(e.touches[0].clientY - swipeStartY.current)
      if (dx < 6 && dy < 6) return
      swipeIntent.current = dx > dy ? 'h' : 'v'
    }
    if (swipeIntent.current === 'h') e.preventDefault()
  }
  const handleSwipeEnd = (e) => {
    if (view === 'month' || swipeStartX.current === null || swipeIntent.current !== 'h') {
      swipeStartX.current = null; swipeIntent.current = null; return
    }
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null; swipeIntent.current = null
    if (Math.abs(dx) < 40) return
    navigate(dx < 0 ? 1 : -1)
  }

  // Listen for Magister login → clear cache and re-fetch schedule
  useEffect(() => {
    const handler = () => {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('magister_sched_'))
        .forEach(k => sessionStorage.removeItem(k))
      setScheduleVersion(v => v + 1)
    }
    window.addEventListener('magisterLogin', handler)
    return () => window.removeEventListener('magisterLogin', handler)
  }, [])

  // Listen for SOMtoday login → clear cache + re-fetch
  useEffect(() => {
    const handler = () => {
      Object.keys(sessionStorage).filter(k => k.startsWith('somtoday_sched_')).forEach(k => sessionStorage.removeItem(k))
      setScheduleVersion(v => v + 1)
    }
    window.addEventListener('somtodayLogin', handler)
    return () => window.removeEventListener('somtodayLogin', handler)
  }, [])

  // Prefetch multiple weeks on mount / after login so month view is populated
  useEffect(() => {
    const creds = (() => { try { return JSON.parse(localStorage.getItem(magisterKey(userId))) } catch { return null } })()
    if (!creds) return
    const weekStart = getWeekDays(new Date())[0]
    for (let i = 0; i < 5; i++) {
      const ws = new Date(weekStart); ws.setDate(ws.getDate() + i * 7)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      const key = `magister_sched_${toDateStr(ws)}_${toDateStr(we)}`
      if (sessionStorage.getItem(key) && scheduleVersion === 0) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(key))
          if (Array.isArray(cached)) setMagisterLessons(prev => mergeLessons(prev, cached))
        } catch {}
        continue
      }
      callMagister(creds, 'schedule', { start: toDateStr(ws), end: toDateStr(we) })
        .then(d => {
          if (Array.isArray(d)) {
            sessionStorage.setItem(key, JSON.stringify(d))
            setMagisterLessons(prev => mergeLessons(prev, d))
          }
        })
        .catch(() => {})
    }
  }, [scheduleVersion])

  // Fetch Magister schedule for visible range, cached per range in sessionStorage
  useEffect(() => {
    let start, end
    if (view === 'week') {
      const days = getWeekDays(current)
      start = toDateStr(days[0]); end = toDateStr(days[6])
    } else if (view === 'month') {
      const { start: ms, end: me } = getMonthRange(current)
      start = toDateStr(ms); end = toDateStr(me)
    } else {
      start = toDateStr(current); end = toDateStr(current)
    }
    const cacheKey = `magister_sched_${start}_${end}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && scheduleVersion === 0) {
      try { setMagisterLessons(prev => mergeLessons(prev, JSON.parse(cached))) } catch {}
      return
    }
    const creds = (() => { try { return JSON.parse(localStorage.getItem(magisterKey(userId))) } catch { return null } })()
    if (!creds) return
    if (view !== 'month') setMagisterSyncing(true)
    setMagisterError(null)
    callMagister(creds, 'schedule', { start, end }).then(data => {
      if (Array.isArray(data)) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
        setMagisterLessons(prev => mergeLessons(prev, data))
        setMagisterError(null)
        onMagisterError?.(null)
      } else {
        const msg = data?.error || 'Geen lessen ontvangen'
        setMagisterError(msg)
        onMagisterError?.(msg)
      }
    }).catch(() => {
      const msg = 'Verbindingsfout'
      setMagisterError(msg)
      onMagisterError?.(msg)
    }).finally(() => setMagisterSyncing(false))
  }, [view, toDateStr(current), scheduleVersion])

  // Fetch SOMtoday schedule — only for the designated account
  useEffect(() => {
    if (userEmail !== SOMTODAY_EMAIL) return
    const weekDays = getWeekDays(current)
    const from = toDateStr(weekDays[0])
    const to = toDateStr(weekDays[6])
    const cacheKey = `somtoday_sched_v6_${from}_${to}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && scheduleVersion === 0) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) { setSomtodayLessons(parsed); return }
      } catch {}
    }
    ensureSomtodayCreds(userId)
      .then(creds => callSomtoday('schedule', { accessToken: creds.accessToken, somtodayApiUrl: creds.somtodayApiUrl, from, to }))
      .then(data => {
        if (Array.isArray(data)) {
          sessionStorage.setItem(cacheKey, JSON.stringify(data))
          setSomtodayLessons(data)
        }
      })
      .catch(e => console.warn('[SOMtoday schedule]', e.message))
  }, [toDateStr(getWeekDays(current)[0]), scheduleVersion])

  const fetchEvents = async () => {
    const [own, imported] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('user_id', userId),
      loadExternalEvents(),
    ])
    if (own.data) setEvents([...own.data, ...(imported || [])])
  }

  const getWorkShiftsForDay = (date) => {
    try {
      const ds = toDateStr(date)
      return (JSON.parse(localStorage.getItem('pmt_work_shifts')) || []).filter(s => s.date?.slice(0, 10) === ds)
    } catch { return [] }
  }

  const getMagisterLessonsForDay = (date) => [...magisterLessons, ...somtodayLessons].filter(les => {
    if (!les.start) return false
    return isSameDay(new Date(les.start), date)
  })

  const getEventsForDay = (date) => events.filter(ev => !ev.description?.startsWith('pmt:') && (showHidden || !ev.hidden)).filter(ev => {
    const start = new Date(ev.start_time)
    const end = new Date(ev.end_time)
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const checkD = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (checkD >= startD && checkD <= endD) return true
    if (checkD < startD) return false
    const r = ev.recurrence
    if (r === 'daily') return true
    if (r === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5
    if (r === 'weekly') return ev.recurrence_days?.includes(date.getDay())
    if (r === 'biweekly') {
      const targetDays = ev.recurrence_days?.length ? ev.recurrence_days : [start.getDay()]
      if (!targetDays.includes(date.getDay())) return false
      const startDow = startD.getDay() === 0 ? 6 : startD.getDay() - 1
      const startMon = new Date(startD.getTime() - startDow * 86400000)
      const checkDow = checkD.getDay() === 0 ? 6 : checkD.getDay() - 1
      const checkMon = new Date(checkD.getTime() - checkDow * 86400000)
      const weeksDiff = Math.round((checkMon - startMon) / (7 * 86400000))
      return weeksDiff % 2 === 0
    }
    if (r === 'monthly') return start.getDate() === date.getDate()
    if (r === 'yearly') return start.getMonth() === date.getMonth() && start.getDate() === date.getDate()
    return false
  })

  // Alle taken voor een dag: eenmalige taken op die datum + routines die volgens
  // hun patroon op die dag vallen. Getimede taken komen in het raster, taken
  // zonder tijd (hele dag / dagdeel) in de dag-strip bovenaan.
  const getTasksForDay = (date) => {
    const ds = toDateStr(date)
    return (tasks || []).filter(t => {
      if (t.recurrence) return appliesOn(t, ds)
      return t.date === ds
    })
  }

  const openNew = (date, hour, minute) => {
    setForm(emptyForm(date || current, hour, minute))
    setModal({ mode: 'new' })
  }

  const openEditEvent = (ev, e) => {
    e?.stopPropagation()
    // Geïmporteerde items (Google / MyX) zijn read-only: alleen details tonen
    if (ev.external) { setModal({ mode: 'view', event: ev }); return }
    const s = new Date(ev.start_time), en = new Date(ev.end_time)
    const isAllDay = s.getHours() === 0 && s.getMinutes() === 0 && en.getHours() === 23 && en.getMinutes() === 59
    const startDs = toDateStr(s), endDs = toDateStr(en)
    setForm({
      title: ev.title, description: ev.description || '',
      date: startDs,
      endDate: endDs !== startDs ? endDs : '',
      allDay: isAllDay,
      startTime: isAllDay ? '09:00' : `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endTime: isAllDay ? '10:00' : `${pad(en.getHours())}:${pad(en.getMinutes())}`,
      color: ev.color || '#818CF8',
      recurrence: ev.recurrence || '', recurrence_days: ev.recurrence_days || []
    })
    setModal({ mode: 'edit', event: ev })
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const endDateStr = form.endDate || form.date
    let start, end
    if (form.allDay) {
      start = new Date(`${form.date}T00:00`)
      end = new Date(`${endDateStr}T23:59`)
    } else {
      start = new Date(`${form.date}T${form.startTime}`)
      end = new Date(`${endDateStr}T${form.endTime}`)
      if (!form.endDate && end <= start) end.setTime(start.getTime() + 3600000)
    }
    const payload = {
      user_id: userId, title: form.title, description: form.description,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: form.color, recurrence: form.recurrence || null,
      recurrence_days: form.recurrence_days?.length ? form.recurrence_days : null
    }
    if (modal?.mode === 'edit' && modal.event) {
      await supabase.from('calendar_events').update(payload).eq('id', modal.event.id)
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
    setSaving(false); setModal(null); fetchEvents()
  }

  const handleDelete = async () => {
    if (!modal?.event || modal.event.external) return
    await supabase.from('calendar_events').delete().eq('id', modal.event.id)
    setModal(null); fetchEvents()
  }

  const navigate = (dir) => {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
    onDateChange?.(d)
  }

  const headerLabel = () => {
    if (view === 'day') return `${DAYS_FULL[current.getDay()]} ${current.getDate()} ${MONTHS_FULL[current.getMonth()]} ${current.getFullYear()}`
    if (view === 'week') {
      const days = getWeekDays(current)
      const first = days[0], last = days[6]
      if (first.getMonth() === last.getMonth())
        return `${MONTHS_FULL[first.getMonth()]} ${first.getFullYear()}`
      return `${MONTHS_SHORT[first.getMonth()]} – ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`
    }
    return `${MONTHS_FULL[current.getMonth()]} ${current.getFullYear()}`
  }

  // ─── TIME GRID (day + week) ───────────────────────────────────────────
  const TimeGrid = ({ days, hideHeader = false }) => {
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const nowTop = (nowMins / 60) * HOUR_H
    const showNowLine = days.some(d => isSameDay(d, now))
    const isDay = days.length === 1
    const N = days.length

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Day header row */}
        {!hideHeader && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_COL}px repeat(${N}, minmax(0, 1fr))`,
            borderBottom: '1px solid var(--c-border)',
            flexShrink: 0,
          }}>
            <div />
            {days.map((d, i) => {
              const isToday = isSameDay(d, now)
              return (
                <div key={i} style={{ padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '0.06em', color: isToday ? 'var(--accent)' : 'var(--c-text-3)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: isToday ? 700 : 500 }}>
                    {DAYS_SHORT[d.getDay()]}
                  </div>
                  <div
                    onClick={() => { if (!isDay) { setCurrent(d); setView('day') } }}
                    style={{ width: isDay ? '36px' : '28px', height: isDay ? '36px' : '28px', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? 'var(--on-accent)' : 'var(--c-text)', fontSize: isDay ? '18px' : '14px', fontWeight: isToday ? 700 : 500, cursor: isDay ? 'default' : 'pointer', transition: 'background 0.15s', boxShadow: isToday ? '0 0 12px color-mix(in srgb, var(--accent) 40%, transparent)' : 'none' }}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Scrollable grid body — all-day strip is sticky inside this scroller */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>

          {/* All-day events strip — sticky inside scrollRef so it works regardless of outer layout */}
          {(() => {
            const allDayByDay = days.map(d => {
              const allDayEvs = getEventsForDay(d).filter(isAllDayEvent).map(ev => ({ kind: 'event', key: ev.id, color: categoryColor(eventCategory(ev)), title: `${ev.hidden ? '🙈 ' : ''}${eventDisplay(ev).title}`, edited: ev.edited, onClick: e => openEditEvent(ev, e) }))
              const allDayLes = getMagisterLessonsForDay(d).filter(les => {
                const s = new Date(les.start)
                return s.getHours() === 0 && s.getMinutes() === 0
              }).map((les, i) => {
                const isSomtoday = les._source === 'somtoday'
                const somtodayColor = (() => { try { return localStorage.getItem('somtoday_lesson_color') || '#FACC15' } catch { return '#FACC15' } })()
                const color = (les.uitgevallen || les.cancelled) ? 'var(--c-danger)' : isSomtoday ? somtodayColor : categoryColor('school')
                const title = les.vak || les.description || les.title || 'Les'
                return { kind: 'lesson', key: `les-allday-${i}`, color, title, onClick: e => { e.stopPropagation(); setLessonDetail(les) } }
              })
              // Taken zonder tijd (hele dag / dagdeel) + routines op deze dag
              const allDayTasks = getTasksForDay(d)
                .filter(t => !t.start_time && !t.time)
                .filter(t => t.recurrence || !t.completed)
                .map(t => {
                  const color = categoryColor(taskCategory(t))
                  return {
                    kind: 'task', key: `task-allday-${t.id}`, color,
                    title: `${t.recurrence ? '🔁 ' : ''}${t.completed ? '✓ ' : ''}${t.title}`,
                    onClick: e => { e.stopPropagation(); onViewDetail ? onViewDetail(t) : onEditTask?.(t) },
                  }
                })
              return [...allDayEvs, ...allDayLes, ...allDayTasks]
            })
            if (allDayByDay.every(arr => arr.length === 0)) return null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `${TIME_COL}px repeat(${N}, minmax(0, 1fr))`, borderBottom: '1px solid var(--c-border)', padding: '4px 0', position: 'sticky', top: 0, zIndex: 15, background: 'var(--c-surface-solid)', maxHeight: 92, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                  <span style={{ fontSize: 9, color: 'var(--c-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', userSelect: 'none' }}>dag</span>
                </div>
                {allDayByDay.map((items, di) => (
                  <div key={di} style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {items.map(item => (
                      <div key={item.key} onClick={item.onClick}
                        style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', background: `color-mix(in srgb, ${item.color} 16%, var(--c-surface-solid))`, borderLeft: `3px solid ${item.color}`, color: `color-mix(in srgb, ${item.color} 60%, white)`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}{item.edited ? ' ✎' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })()}

          <div style={{ position: 'relative', height: `${24 * HOUR_H}px` }}>

            {/* Today column highlight */}
            {days.map((d, di) => isSameDay(d, now) && N > 1 && (
              <div key={`today-col-${di}`} style={{
                position: 'absolute', top: 0, height: '100%',
                left: `calc(${TIME_COL}px + ${di} * (100% - ${TIME_COL}px) / ${N})`,
                width: `calc((100% - ${TIME_COL}px) / ${N})`,
                background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
                borderLeft: '1px solid color-mix(in srgb, var(--accent) 14%, transparent)',
                borderRight: '1px solid color-mix(in srgb, var(--accent) 14%, transparent)',
                pointerEvents: 'none', zIndex: 0,
              }} />
            ))}

            {/* Hour lines + labels */}
            {Array.from({ length: 24 }, (_, h) => (
              <React.Fragment key={h}>
                <div style={{ position: 'absolute', top: `${h * HOUR_H}px`, left: 0, width: `${TIME_COL}px`, height: `${HOUR_H}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '10px', boxSizing: 'border-box', pointerEvents: 'none', transform: h === 0 ? 'none' : 'translateY(-8px)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--c-text-3)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, userSelect: 'none' }}>
                    {/* verberg het uurlabel als de rode nu-pill er overheen valt */}
                    {h === 0 || (showNowLine && Math.abs(nowMins - h * 60) < 15) ? '' : `${pad(h)}:00`}
                  </span>
                  {quarterSlots && !(showNowLine && Math.abs(nowMins - (h * 60 + 30)) < 15) && (
                    <span style={{ position: 'absolute', top: HOUR_H / 2, right: 10, fontSize: '9px', color: 'var(--c-text-3)', opacity: 0.55, fontVariantNumeric: 'tabular-nums', lineHeight: 1, userSelect: 'none' }}>
                      :30
                    </span>
                  )}
                </div>
                <div style={{ position: 'absolute', top: `${h * HOUR_H}px`, left: `${TIME_COL}px`, right: 0, height: `${HOUR_H}px`, borderTop: '1px solid rgba(255,255,255,0.045)', display: 'grid', gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
                  {days.map((d, di) => (
                    <div key={di}
                      onClick={e => {
                        // Hoge vakken: klik snapt naar het kwartier
                        if (!quarterSlots) return openNew(d, h)
                        const q = Math.min(3, Math.floor((e.nativeEvent.offsetY / HOUR_H) * 4))
                        openNew(d, h, q * 15)
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={async e => {
                        e.preventDefault()
                        const taskId = e.dataTransfer.getData('taskId')
                        if (!taskId) return
                        await supabase.from('tasks').update({ time: `${pad(h)}:00`, date: toDateStr(d) }).eq('id', taskId)
                        window.dispatchEvent(new Event('refreshTasks'))
                      }}
                      style={{ borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.035)' : 'none', cursor: 'pointer', backgroundImage: slotBackground(HOUR_H) }}
                    />
                  ))}
                </div>
              </React.Fragment>
            ))}

            {/* Events + Lessons + Tasks per day, with overlap layout */}
            {days.map((d, di) => {
              const colEvents = getEventsForDay(d)
              const colTasks = getTasksForDay(d)
              const colLessons = getMagisterLessonsForDay(d)
              const colWorkShifts = getWorkShiftsForDay(d)

              // Build unified item list for overlap computation
              const allItems = [
                ...colWorkShifts.map((sh, si) => {
                  const startMins = timeStrToMins(sh.start)
                  const endMins = Math.max(startMins + 30, timeStrToMins(sh.end))
                  return { type: 'work', key: `work-${di}-${si}`, startMins, endMins, data: sh }
                }),
                ...colLessons.filter(les => {
                  const s = new Date(les.start)
                  return !(s.getHours() === 0 && s.getMinutes() === 0)
                }).map((les, li) => {
                  const s = new Date(les.start), en = new Date(les.einde || les.end || les.start)
                  const startMins = s.getHours()*60 + s.getMinutes()
                  const endMins = Math.max(startMins + 30, en.getHours()*60 + en.getMinutes())
                  return { type: 'lesson', key: `les-${di}-${li}`, startMins, endMins, data: les }
                }),
                ...colEvents.filter(ev => !isAllDayEvent(ev)).map(ev => {
                  const s = new Date(ev.start_time), en = new Date(ev.end_time)
                  const startMins = s.getHours()*60 + s.getMinutes()
                  const endMins = Math.max(startMins + 30, en.getHours()*60 + en.getMinutes())
                  return { type: 'event', key: `ev-${ev.id}`, startMins, endMins, data: ev }
                }),
                ...colTasks.filter(task => task.start_time || task.time).map(task => {
                  const timeStr = task.start_time || task.time
                  const startMins = timeStrToMins(timeStr)
                  const endMins = task.end_time ? timeStrToMins(task.end_time) : startMins + 60
                  return { type: 'task', key: `task-${task.id}`, startMins, endMins, data: task }
                }),
              ]

              const laid = layoutOverlaps(allItems)

              return (
                <React.Fragment key={`col-${di}`}>
                  {laid.map(item => {
                    const top = (item.startMins / 60) * HOUR_H
                    const height = Math.max(22, ((item.endMins - item.startMins) / 60) * HOUR_H - 2)
                    const showDetail = height >= 36
                    // Position within this day column, with sub-column for overlaps
                    const dayFrac = 1 / N
                    const subFrac = dayFrac / item._colTotal
                    // Fracties van de dagkolommen-breedte (100% − tijdkolom), niet van de hele breedte
                    const leftFrac = (di + item._col / item._colTotal) * dayFrac
                    const leftStyle = `calc(${TIME_COL}px + (100% - ${TIME_COL}px) * ${leftFrac})`
                    const widthStyle = `calc((100% - ${TIME_COL}px) * ${subFrac} - 4px)`
                    const isHL = highlightKey && getItemHighlightKey(item) === highlightKey
                    const hlStyle = isHL ? { outline: '2px solid rgba(255,255,255,0.9)', outlineOffset: '1px', boxShadow: '0 0 0 4px rgba(255,255,255,0.18), 0 0 18px rgba(255,255,255,0.25)', zIndex: 20, opacity: 1 } : {}

                    if (item.type === 'work') {
                      const sh = item.data
                      return (
                        <div key={item.key} ref={isHL ? highlightRef : undefined} style={blockStyle(WORK, { top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, zIndex: 1, cursor: 'default', ...hlStyle })}>
                          <div style={blockTitle(WORK)}>
                            Jumbo
                          </div>
                          {showDetail && (
                            <div style={blockMeta(WORK)}>
                              {sh.start} – {sh.end}{sh.label ? ` · ${sh.label}` : ''}
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'lesson') {
                      const les = item.data
                      const cancelled = les.uitgevallen || les.cancelled
                      const isSomtoday = les._source === 'somtoday'
                      const somtodayColor = (() => { try { return localStorage.getItem('somtoday_lesson_color') || '#FACC15' } catch { return '#FACC15' } })()
                      const baseColor = isSomtoday ? somtodayColor : categoryColor('school')
                      const color = cancelled ? 'var(--c-danger)' : baseColor
                      const lesTitle = les.vak || les.description || les.title || 'Les'
                      const teachers = isSomtoday
                        ? (les.teachers || []).filter(t => t !== les.title)
                        : null
                      const subLabel = [
                        les.lokaal || les.location,
                        les.docent || (teachers ? teachers.join(', ') : les.teachers?.join(', ')),
                      ].filter(Boolean).join(' · ')
                      return (
                        <div key={item.key}
                          ref={isHL ? highlightRef : undefined}
                          onClick={e => { e.stopPropagation(); setLessonDetail(les) }}
                          {...kbdClick(`Les ${lesTitle}`, e => { e.stopPropagation(); setLessonDetail(les) })}
                          style={blockStyle(color, { top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, zIndex: 1, opacity: cancelled ? 0.55 : 1, ...hlStyle })}>
                          <div style={blockTitle(color, { textDecoration: cancelled ? 'line-through' : 'none' })}>
                            {lesTitle}
                          </div>
                          {showDetail && subLabel && (
                            <div style={blockMeta(color)}>
                              {subLabel}
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'event') {
                      const ev = item.data
                      const s = new Date(ev.start_time), en = new Date(ev.end_time)
                      const color = categoryColor(eventCategory(ev))
                      const disp = eventDisplay(ev)
                      return (
                        <div key={item.key}
                          ref={isHL ? highlightRef : undefined}
                          onClick={e => openEditEvent(ev, e)}
                          {...kbdClick(`${disp.title}, ${fmtTime(s)} tot ${fmtTime(en)}`, e => openEditEvent(ev, e))}
                          title={[disp.title, disp.code, ev.location].filter(Boolean).join(' · ')}
                          style={blockStyle(color, { top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, zIndex: 2, opacity: ev.hidden ? 0.45 : 1, ...hlStyle })}>
                          <div style={blockTitle(color)}>
                            {ev.hidden ? '🙈 ' : ''}{disp.title}{ev.edited ? ' ✎' : ''}
                          </div>
                          {showDetail && (
                            <div style={blockMeta(color)}>
                              {fmtTime(s)} – {fmtTime(en)}
                            </div>
                          )}
                          {height >= 58 && disp.code && (
                            <div style={{ ...blockMeta(color), fontSize: '9px', letterSpacing: '0.02em', opacity: 0.85 }}>{ev.external ? '↗ ' : ''}{disp.code}</div>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'task') {
                      const task = item.data
                      const subject = subjects?.find(s => s.id === task.subject_id)
                      const color = task.completed ? 'var(--c-success)' : categoryColor(taskCategory(task))
                      return (
                        <div key={item.key}
                          ref={isHL ? highlightRef : undefined}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                          onClick={e => { e.stopPropagation(); onViewDetail ? onViewDetail(task) : onEditTask?.(task) }}
                          {...kbdClick(`Taak ${task.title}`, e => { e.stopPropagation(); onViewDetail ? onViewDetail(task) : onEditTask?.(task) })}
                          style={blockStyle(color, { top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, zIndex: 3, opacity: task.completed ? 0.55 : 1, ...hlStyle })}>
                          <div style={blockTitle(color, { textDecoration: task.completed ? 'line-through' : 'none' })}>
                            {task.completed ? '✓ ' : ''}{task.title}
                          </div>
                          {showDetail && subject && (
                            <div style={blockMeta(color)}>
                              {subject.name}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return null
                  })}
                </React.Fragment>
              )
            })}

            {/* Current time line */}
            {showNowLine && (
              <div aria-hidden="true" style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, height: 0, zIndex: 10, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: `${TIME_COL}px`, right: 0, top: -1, height: 2, background: 'var(--c-danger)', boxShadow: '0 0 6px color-mix(in srgb, var(--c-danger) 50%, transparent)' }} />
                <div style={{ position: 'absolute', left: 2, top: -9, height: 18, padding: '0 5px', borderRadius: 5, background: 'var(--c-danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {pad(now.getHours())}:{pad(now.getMinutes())}
                </div>
                <div style={{ position: 'absolute', left: `${TIME_COL - 4}px`, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--c-danger)' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MONTH VIEW ──────────────────────────────────────────────────────
  const renderMonthGrid = (monthDate) => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0)
    const startPad = (firstDay.getDay() + 6) % 7
    const cells = [...Array(startPad).fill(null)]
    for (let d = 1; d <= lastDay.getDate(); d++)
      cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d))
    while (cells.length % 7 !== 0) cells.push(null)
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`
    return (
      <div key={key} ref={el => { monthItemRefs.current[key] = el }} data-month={key}
        style={{ flexShrink: 0 }}>
        {/* Month label */}
        <div style={{ padding: '12px 12px 6px', fontSize: 14, fontWeight: 700, color: 'var(--c-text)', letterSpacing: '0.02em', borderTop: '1px solid var(--c-border)' }}>
          {MONTHS_FULL[monthDate.getMonth()]} {monthDate.getFullYear()}
        </div>
        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
            <div key={d} style={{ padding: '4px', textAlign: 'center', fontSize: '10px', fontWeight: 500, color: 'var(--c-text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} style={{ borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)', minHeight: '64px' }} />
            const evs = getEventsForDay(date)
            const workEvs = events.filter(ev => ev.description?.startsWith('pmt:')).filter(ev => {
              const s = new Date(ev.start_time)
              return s.getFullYear() === date.getFullYear() && s.getMonth() === date.getMonth() && s.getDate() === date.getDate()
            })
            const tsks = getTasksForDay(date)
            const les = getMagisterLessonsForDay(date)
            const all = [...evs, ...workEvs, ...tsks, ...les]
            const isToday = isSameDay(date, now)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div key={i} onClick={() => { setCurrent(date); setView('day') }}
                style={{ padding: '4px 5px', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isToday ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent', minHeight: '64px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? 'var(--on-accent)' : isWeekend ? 'var(--c-text-3)' : 'var(--c-text-2)', fontSize: '11px', fontWeight: isToday ? 700 : 400 }}>
                    {date.getDate()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {all.slice(0, 2).map((item, idx) => {
                    const color = item.vak ? categoryColor('school')
                      : item.start_time ? (item.description?.startsWith('pmt:') ? categoryColor('werk') : categoryColor(eventCategory(item)))
                      : categoryColor(taskCategory(item))
                    const label = item.start_time ? eventDisplay(item).title : (item.title || item.vak || '–')
                    return (
                      <div key={item.id || idx} style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, borderLeft: `2px solid ${color}`, borderRadius: '3px', padding: '1px 5px', fontSize: '9px', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {label}
                      </div>
                    )
                  })}
                  {all.length > 2 && (
                    <div style={{ fontSize: '9px', color: 'var(--c-text-3)', paddingLeft: '5px' }}>+{all.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const MonthView = () => {
    // Render 25 months: 12 before to 12 after current
    const months = []
    for (let i = -12; i <= 12; i++) {
      months.push(new Date(current.getFullYear(), current.getMonth() + i, 1))
    }
    return (
      <div ref={monthScrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {months.map(m => renderMonthGrid(m))}
      </div>
    )
  }

  const weekDays = getWeekDays(current)

  // ─── RECHTER RAIL: legenda + mini-maandkalender (desktop, ≥1280px via CSS) ─────
  const SideRail = () => {
    const m = new Date(current.getFullYear(), current.getMonth(), 1)
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
    const pad0 = (m.getDay() + 6) % 7
    const cells = [...Array(pad0).fill(null), ...Array.from({ length: last }, (_, i) => new Date(m.getFullYear(), m.getMonth(), i + 1))]
    const inView = d => view === 'week' ? weekDays.some(w => isSameDay(w, d)) : isSameDay(d, current)
    const shiftMonth = dir => { const d = new Date(current); d.setDate(1); d.setMonth(d.getMonth() + dir); setCurrent(d); onDateChange?.(d) }
    return (
      <aside className="agenda-rail" aria-label="Legenda en maandoverzicht">
        <div className="card" style={{ padding: 14 }}>
          <p className="t-card" style={{ margin: '0 0 10px' }}>Kleuren</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CATEGORY_ORDER.map(c => (
              <li key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--c-text-2)' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORIES[c].color }} />
                {CATEGORIES[c].label}
              </li>
            ))}
          </ul>
          {events.some(ev => ev.hidden) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-border)', fontSize: 12, color: 'var(--c-text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHidden} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                onChange={e => { setShowHidden(e.target.checked); try { localStorage.setItem('agenda_show_hidden', e.target.checked ? '1' : '0') } catch {} }} />
              Toon verborgen ({events.filter(ev => ev.hidden).length})
            </label>
          )}
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <p className="t-card" style={{ margin: 0, flex: 1 }}>{MONTHS_FULL[m.getMonth()]} {m.getFullYear()}</p>
            <IconButton icon={ChevronLeft} label="Vorige maand" size={24} iconSize={13} onClick={() => shiftMonth(-1)} />
            <IconButton icon={ChevronRight} label="Volgende maand" size={24} iconSize={13} onClick={() => shiftMonth(1)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center' }}>
            {['M','D','W','D','V','Z','Z'].map((d, i) => <span key={i} className="t-meta" style={{ fontSize: 10 }}>{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const today = isSameDay(d, now)
              const sel = inView(d)
              return (
                <button key={i} type="button" onClick={() => { setCurrent(d); onDateChange?.(d) }}
                  aria-label={`${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`} aria-current={today ? 'date' : undefined}
                  className="tnum"
                  style={{
                    height: 24, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, padding: 0,
                    background: today ? 'var(--accent)' : sel ? 'var(--accent-soft)' : 'transparent',
                    color: today ? 'var(--on-accent)' : sel ? 'var(--accent)' : 'var(--c-text-2)',
                    fontWeight: today || sel ? 700 : 400,
                  }}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    )
  }

  const MobileWeekStrip = () => {
    const wDays = getWeekDays(current)
    return (
      <div style={{ display: 'flex', gap: 2, padding: '4px 0 8px', flexShrink: 0 }}>
        {wDays.map((d, i) => {
          const isSel = isSameDay(d, current)
          const isToday = isSameDay(d, now)
          return (
            <button key={i} onClick={() => setCurrent(d)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 2px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isSel ? 'var(--accent)' : isToday ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: isSel ? '#000' : isToday ? 'var(--accent)' : 'var(--c-text-3)',
                transition: 'background 0.15s',
              }}>
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{DAYS_SHORT[d.getDay()]}</span>
              <span style={{ fontSize: 15, fontWeight: isSel || isToday ? 700 : 400, marginTop: 2 }}>{d.getDate()}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="agenda-shell" style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 12 }}>
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: 'var(--r-lg)', background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      {/* Toolbar */}
      {!hideToolbar && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <button onClick={() => setCurrent(new Date())} className="btn-ghost">Vandaag</button>
          <IconButton icon={ChevronLeft} label={view === 'day' ? 'Vorige dag' : view === 'week' ? 'Vorige week' : 'Vorige maand'} onClick={() => navigate(-1)} />
          <IconButton icon={ChevronRight} label={view === 'day' ? 'Volgende dag' : view === 'week' ? 'Volgende week' : 'Volgende maand'} onClick={() => navigate(1)} />
          <span className="t-section" style={{ whiteSpace: 'nowrap', marginLeft: 4 }}>
            {headerLabel()}
          </span>
          {magisterSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FACC15', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 10, color: '#FACC15', fontWeight: 500 }}>Syncing Magister</span>
            </div>
          )}
          {!magisterSyncing && magisterError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)' }}>
              <span style={{ fontSize: 10, color: '#FF6B6B', fontWeight: 500 }}>Magister: {magisterError}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FilterTabs variant="segmented" label="Weergave" value={view} onChange={setView}
            items={(isMobile ? [['week','Week'], ['month','Maand']] : [['day','Dag'], ['week','Week'], ['month','Maand']]).map(([value, label]) => ({ value, label }))} />
          <button onClick={() => openNew(current)} className="btn-primary">
            <Plus size={14} aria-hidden="true" /> Nieuw
          </button>
        </div>
      </div>}

      {/* Magister sync badge — shown when toolbar is hidden (mobile dag view) */}
      {hideToolbar && (magisterSyncing || magisterError) && (
        <div style={{ flexShrink: 0, padding: '6px 12px', display: 'flex', justifyContent: 'center' }}>
          {magisterSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FACC15', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 11, color: '#FACC15', fontWeight: 500 }}>Syncing Magister</span>
            </div>
          )}
          {!magisterSyncing && magisterError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)' }}>
              <span style={{ fontSize: 11, color: '#FF6B6B', fontWeight: 500 }}>Magister: {magisterError}</span>
            </div>
          )}
        </div>
      )}

      {/* View content — call as functions to prevent remount on re-render */}
      <div
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        {view === 'month' && MonthView({})}
        {view === 'week' && !isMobile && TimeGrid({ days: weekDays })}
        {view === 'week' && isMobile && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {MobileWeekStrip({})}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              {TimeGrid({ days: [current], hideHeader: true })}
            </div>
          </div>
        )}
        {view === 'day'   && TimeGrid({ days: [current], hideHeader: isMobile })}
      </div>

    </div>
    {!isMobile && !hideToolbar && SideRail()}

      {/* Lesson detail popup (fixed, dus positie in de flex-rij maakt niet uit) */}
      {lessonDetail && (
        <div className="modal-overlay" style={{ padding: '16px' }}
          onClick={() => setLessonDetail(null)}>
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '340px', padding: '20px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🎓</span>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>
                  {lessonDetail.description || lessonDetail.vak || lessonDetail.title || 'Les'}
                </span>
                {(lessonDetail.uitgevallen || lessonDetail.cancelled) && (
                  <span style={{ fontSize: '10px', color: '#FF6B6B', background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '6px', padding: '1px 6px' }}>
                    Uitgevallen
                  </span>
                )}
              </div>
              <button onClick={() => setLessonDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Tijd */}
              {lessonDetail.start && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)', width: '60px', flexShrink: 0 }}>Tijd</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>
                    {fmtTime(new Date(lessonDetail.start))}
                    {(lessonDetail.einde || lessonDetail.end) ? ` – ${fmtTime(new Date(lessonDetail.einde || lessonDetail.end))}` : ''}
                  </span>
                </div>
              )}
              {/* Lokaal */}
              {(lessonDetail.lokaal || lessonDetail.location) && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)', width: '60px', flexShrink: 0 }}>Lokaal</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{lessonDetail.lokaal || lessonDetail.location}</span>
                </div>
              )}
              {/* Docent */}
              {(lessonDetail.docent || lessonDetail.teachers?.length > 0) && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)', width: '60px', flexShrink: 0 }}>Docent</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{lessonDetail.docent || lessonDetail.teachers?.join(', ')}</span>
                </div>
              )}
              {/* Huiswerk */}
              {lessonDetail.huiswerk && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)', width: '60px', flexShrink: 0, paddingTop: '2px' }}>Huiswerk</span>
                  <span style={{ fontSize: '12px', color: '#FACC15', fontWeight: 500, lineHeight: 1.4 }}>{stripHtml(lessonDetail.huiswerk)}</span>
                </div>
              )}
              {/* Omschrijving */}
              {lessonDetail.omschrijving && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)', width: '60px', flexShrink: 0, paddingTop: '2px' }}>Info</span>
                  <span style={{ fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.4 }}>{stripHtml(lessonDetail.omschrijving)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geïmporteerd item (Google / MijnX): bekijken + aanpassen */}
      {modal?.mode === 'view' && <ExternalEventModal ev={modal.event} onClose={() => setModal(null)} />}

      {/* Event modal */}
      {modal && modal.mode !== 'view' && (
        <div className="modal-overlay" style={{ padding: '16px' }}
          onClick={() => setModal(null)}>
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '400px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '16px', margin: 0 }}>
                {modal.mode === 'edit' ? 'Bewerk event' : 'Nieuw event'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="glass-input" placeholder="Titel *" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={{ fontSize: '16px' }} />
              <textarea className="glass-input" placeholder="Beschrijving" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                style={{ resize: 'vertical', minHeight: '56px' }} />
              {/* Hele dag toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => setForm(p => ({ ...p, allDay: !p.allDay }))}
                  style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: form.allDay ? 'var(--accent, #00FFD1)' : 'rgba(255,255,255,0.14)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: form.allDay ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: form.allDay ? '#000' : 'rgba(255,255,255,0.7)', transition: 'left 0.2s' }} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>Hele dag</span>
              </div>
              {/* Date range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginBottom: 4, letterSpacing: '0.05em' }}>Van</div>
                  <input type="date" className="glass-input" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-3)', marginBottom: 4, letterSpacing: '0.05em' }}>Tot</div>
                  <input type="date" className="glass-input" value={form.endDate || form.date} min={form.date}
                    onChange={e => { const v = e.target.value; setForm(p => ({ ...p, endDate: v === p.date ? '' : v })) }} />
                </div>
              </div>
              {/* Times (only when not all-day) */}
              {!form.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="time" className="glass-input" value={form.startTime}
                    onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
                  <input type="time" className="glass-input" value={form.endTime}
                    onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
                </div>
              )}
              <select className="glass-input" value={form.recurrence}
                onChange={e => setForm(p => ({ ...p, recurrence: e.target.value, recurrence_days: [] }))}>
                <option value="">Geen herhaling</option>
                <option value="daily">Dagelijks</option>
                <option value="weekdays">Elke werkdag (ma–vr)</option>
                <option value="weekly">Wekelijks</option>
                <option value="biweekly">Om de week</option>
                <option value="monthly">Maandelijks</option>
                <option value="yearly">Jaarlijks</option>
              </select>
              {(form.recurrence === 'weekly' || form.recurrence === 'biweekly') && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Ma','Di','Wo','Do','Vr','Za','Zo'].map((d, i) => {
                    const dayNum = (i + 1) % 7
                    const sel = form.recurrence_days.includes(dayNum)
                    return (
                      <button key={i} type="button"
                        onClick={() => setForm(p => ({ ...p, recurrence_days: sel ? p.recurrence_days.filter(x => x !== dayNum) : [...p.recurrence_days, dayNum] }))}
                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid', borderColor: sel ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)', background: sel ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent', color: sel ? 'var(--accent)' : 'var(--c-text-3)' }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {EVENT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', boxSizing: 'border-box', transform: form.color === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s', flexShrink: 0 }} />
                ))}
                {/* Custom color picker */}
                <label title="Eigen kleur" style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, border: !EVENT_COLORS.includes(form.color) ? '2px solid white' : '2px solid transparent', boxSizing: 'border-box', transform: !EVENT_COLORS.includes(form.color) ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s', background: form.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    style={{ opacity: 0, position: 'absolute', width: 1, height: 1, pointerEvents: 'none' }} />
                  {EVENT_COLORS.includes(form.color) && <span style={{ fontSize: 12, lineHeight: 1, color: 'var(--c-text-2)', pointerEvents: 'none' }}>+</span>}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              {modal.mode === 'edit' && (
                <button onClick={handleDelete}
                  style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '9px', borderRadius: '10px', border: '1px solid var(--c-border-strong)', background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer', fontSize: '12px' }}>
                Annuleer
              </button>
              <button onClick={handleSave} disabled={!form.title.trim() || saving}
                style={{ flex: 2, padding: '9px', borderRadius: '10px', border: 'none', background: 'var(--accent, #00FFD1)', color: '#000', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: !form.title.trim() ? 0.4 : 1 }}>
                <Save size={13} /> {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
