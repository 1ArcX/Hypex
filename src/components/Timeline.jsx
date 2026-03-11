import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2 } from 'lucide-react'

const HOUR_H = 56
const TIME_COL = 48
const MAGISTER_KEY = 'magister_credentials'

const MONTHS_FULL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
const DAYS_SHORT = ['Zo','Ma','Di','Wo','Do','Vr','Za']
const DAYS_FULL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
const EVENT_COLORS = ['#FF6B6B','#FF8C42','#FACC15','#4ADE80','#00FFD1','#38BDF8','#818CF8','#F472B6']

function pad(n) { return String(n).padStart(2, '0') }
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

const emptyForm = (date, hour) => ({
  title: '', description: '',
  date: toDateStr(date || new Date()),
  startTime: hour !== undefined ? `${pad(hour)}:00` : '09:00',
  endTime: hour !== undefined ? `${pad(Math.min(hour+1,23))}:00` : '10:00',
  color: '#818CF8', recurrence: '', recurrence_days: []
})

export default function Timeline({ userId, tasks, subjects, onEditTask }) {
  const [view, setView] = useState('week')
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm(new Date()))
  const [saving, setSaving] = useState(false)
  const [magisterLessons, setMagisterLessons] = useState([])
  const [lessonDetail, setLessonDetail] = useState(null)
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const scrollRef = useRef(null)
  const now = new Date()

  useEffect(() => { fetchEvents() }, [])

  useEffect(() => {
    if (scrollRef.current) {
      const targetHour = Math.max(0, now.getHours() - 1)
      scrollRef.current.scrollTop = targetHour * HOUR_H
    }
  }, [view])

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

  // Fetch Magister schedule for visible range, cached per range in sessionStorage
  useEffect(() => {
    const days = view === 'week' ? getWeekDays(current) : [current]
    const start = toDateStr(days[0])
    const end = toDateStr(days[days.length - 1])
    const cacheKey = `magister_sched_${start}_${end}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && scheduleVersion === 0) {
      try { setMagisterLessons(JSON.parse(cached)) } catch {}
      return
    }
    const creds = (() => { try { return JSON.parse(localStorage.getItem(MAGISTER_KEY)) } catch { return null } })()
    if (!creds) return
    fetch('/.netlify/functions/magister', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...creds, action: 'schedule', start, end })
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data)) {
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
        setMagisterLessons(data)
      }
    }).catch(() => {})
  }, [view, toDateStr(current), scheduleVersion])

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId)
    if (data) setEvents(data)
  }

  const getMagisterLessonsForDay = (date) => magisterLessons.filter(les => {
    if (!les.start) return false
    return isSameDay(new Date(les.start), date)
  })

  const getEventsForDay = (date) => events.filter(ev => {
    const start = new Date(ev.start_time)
    if (isSameDay(start, date)) return true
    if (ev.recurrence === 'daily') return start <= date
    if (ev.recurrence === 'weekly' && ev.recurrence_days?.includes(date.getDay())) return start <= date
    if (ev.recurrence === 'monthly' && start.getDate() === date.getDate()) return start <= date
    return false
  })

  const getTasksForDay = (date) => (tasks || []).filter(t => {
    if (!t.start_time && !t.time) return false
    const taskDate = t.date ? new Date(t.date + 'T00:00:00') : now
    return isSameDay(taskDate, date)
  })

  const openNew = (date, hour) => {
    setForm(emptyForm(date || current, hour))
    setModal({ mode: 'new' })
  }

  const openEditEvent = (ev, e) => {
    e?.stopPropagation()
    const s = new Date(ev.start_time), en = new Date(ev.end_time)
    setForm({
      title: ev.title, description: ev.description || '',
      date: toDateStr(s),
      startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endTime: `${pad(en.getHours())}:${pad(en.getMinutes())}`,
      color: ev.color || '#818CF8',
      recurrence: ev.recurrence || '', recurrence_days: ev.recurrence_days || []
    })
    setModal({ mode: 'edit', event: ev })
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    if (end <= start) end.setTime(start.getTime() + 3600000)
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
    if (!modal?.event) return
    await supabase.from('calendar_events').delete().eq('id', modal.event.id)
    setModal(null); fetchEvents()
  }

  const navigate = (dir) => {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
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
  const TimeGrid = ({ days }) => {
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const nowTop = (nowMins / 60) * HOUR_H
    const showNowLine = days.some(d => isSameDay(d, now))
    const isDay = days.length === 1
    const N = days.length

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Day header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_COL}px repeat(${N}, 1fr)`,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div />
          {days.map((d, i) => {
            const isToday = isSameDay(d, now)
            return (
              <div key={i} style={{ padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', color: isToday ? 'var(--accent, #00FFD1)' : 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  {DAYS_SHORT[d.getDay()]}
                </div>
                <div
                  onClick={() => { if (!isDay) { setCurrent(d); setView('day') } }}
                  style={{ width: isDay ? '36px' : '28px', height: isDay ? '36px' : '28px', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent, #00FFD1)' : 'transparent', color: isToday ? '#000' : 'rgba(255,255,255,0.85)', fontSize: isDay ? '18px' : '13px', fontWeight: isToday ? 700 : 400, cursor: isDay ? 'default' : 'pointer', transition: 'background 0.15s' }}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Scrollable grid body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          <div style={{ position: 'relative', height: `${24 * HOUR_H}px` }}>

            {/* Hour lines + labels */}
            {Array.from({ length: 24 }, (_, h) => (
              <React.Fragment key={h}>
                <div style={{ position: 'absolute', top: `${h * HOUR_H}px`, left: 0, width: `${TIME_COL}px`, height: `${HOUR_H}px`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '10px', boxSizing: 'border-box', pointerEvents: 'none', transform: h === 0 ? 'none' : 'translateY(-8px)' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, userSelect: 'none' }}>
                    {h === 0 ? '' : `${pad(h)}:00`}
                  </span>
                </div>
                <div style={{ position: 'absolute', top: `${h * HOUR_H}px`, left: `${TIME_COL}px`, right: 0, height: `${HOUR_H}px`, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)` }}>
                  {days.map((d, di) => (
                    <div key={di}
                      onClick={() => openNew(d, h)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={async e => {
                        e.preventDefault()
                        const taskId = e.dataTransfer.getData('taskId')
                        if (!taskId) return
                        await supabase.from('tasks').update({ time: `${pad(h)}:00`, date: toDateStr(d) }).eq('id', taskId)
                        window.dispatchEvent(new Event('refreshTasks'))
                      }}
                      style={{ borderLeft: di > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer', backgroundImage: 'linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(255,255,255,0.03) calc(50% - 0.5px), rgba(255,255,255,0.03) calc(50% + 0.5px), transparent calc(50% + 0.5px))' }}
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

              // Build unified item list for overlap computation
              const allItems = [
                ...colLessons.map((les, li) => {
                  const s = new Date(les.start), en = new Date(les.einde || les.start)
                  const startMins = s.getHours()*60 + s.getMinutes()
                  const endMins = Math.max(startMins + 30, en.getHours()*60 + en.getMinutes())
                  return { type: 'lesson', key: `les-${di}-${li}`, startMins, endMins, data: les }
                }),
                ...colEvents.map(ev => {
                  const s = new Date(ev.start_time), en = new Date(ev.end_time)
                  const startMins = s.getHours()*60 + s.getMinutes()
                  const endMins = Math.max(startMins + 30, en.getHours()*60 + en.getMinutes())
                  return { type: 'event', key: `ev-${ev.id}`, startMins, endMins, data: ev }
                }),
                ...colTasks.map(task => {
                  const timeStr = task.start_time || task.time || '08:00'
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
                    const leftPct = (di + item._col / item._colTotal) * dayFrac * 100
                    const widthPct = subFrac * 100
                    const leftStyle = `calc(${TIME_COL}px + ${leftPct}%)`
                    const widthStyle = `calc(${widthPct}% - 4px)`

                    if (item.type === 'lesson') {
                      const les = item.data
                      const cancelled = les.uitgevallen
                      const color = cancelled ? '#FF6B6B' : '#FACC15'
                      return (
                        <div key={item.key}
                          onClick={e => { e.stopPropagation(); setLessonDetail(les) }}
                          style={{ position: 'absolute', top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, background: color + '18', borderLeft: `3px solid ${cancelled ? '#FF6B6B99' : '#FACC1599'}`, borderRadius: '5px', padding: '3px 7px', overflow: 'hidden', cursor: 'pointer', zIndex: 1, boxSizing: 'border-box', marginLeft: '2px', opacity: cancelled ? 0.5 : 0.85 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: cancelled ? 'line-through' : 'none' }}>
                            🎓 {les.vak || 'Les'}
                          </div>
                          {showDetail && (
                            <div style={{ fontSize: '10px', color: color + 'aa', lineHeight: 1.3, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[les.lokaal, les.docent].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'event') {
                      const ev = item.data
                      const s = new Date(ev.start_time), en = new Date(ev.end_time)
                      return (
                        <div key={item.key}
                          onClick={e => openEditEvent(ev, e)}
                          style={{ position: 'absolute', top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, background: ev.color + '22', borderLeft: `3px solid ${ev.color}`, borderRadius: '5px', padding: '3px 7px', overflow: 'hidden', cursor: 'pointer', zIndex: 2, boxSizing: 'border-box', marginLeft: '2px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: ev.color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.title}
                          </div>
                          {showDetail && (
                            <div style={{ fontSize: '10px', color: ev.color + 'bb', lineHeight: 1.2, marginTop: '1px' }}>
                              {fmtTime(s)} – {fmtTime(en)}
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (item.type === 'task') {
                      const task = item.data
                      const subject = subjects?.find(s => s.id === task.subject_id)
                      const color = task.completed ? '#4ADE80' : (subject?.color || '#818CF8')
                      return (
                        <div key={item.key}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                          onClick={e => { e.stopPropagation(); onEditTask?.(task) }}
                          style={{ position: 'absolute', top: `${top}px`, height: `${height}px`, left: leftStyle, width: widthStyle, background: color + '18', borderLeft: `3px solid ${color}`, borderRadius: '5px', padding: '3px 7px', overflow: 'hidden', cursor: 'pointer', zIndex: 3, boxSizing: 'border-box', marginLeft: '2px', opacity: task.completed ? 0.55 : 1 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.completed ? 'line-through' : 'none' }}>
                            {task.completed ? '✓ ' : ''}{task.title}
                          </div>
                          {showDetail && subject && (
                            <div style={{ fontSize: '10px', color: color + 'aa', lineHeight: 1.2, marginTop: '1px' }}>
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
              <div style={{ position: 'absolute', top: `${nowTop}px`, left: `${TIME_COL - 6}px`, right: 0, height: '2px', background: '#FF453A', zIndex: 10, pointerEvents: 'none' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF453A', position: 'absolute', left: '-1px', top: '-4px' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── MONTH VIEW ──────────────────────────────────────────────────────
  const MonthView = () => {
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1)
    const lastDay = new Date(current.getFullYear(), current.getMonth()+1, 0)
    const startPad = (firstDay.getDay() + 6) % 7
    const cells = [...Array(startPad).fill(null)]
    for (let d = 1; d <= lastDay.getDate(); d++)
      cells.push(new Date(current.getFullYear(), current.getMonth(), d))
    while (cells.length % 7 !== 0) cells.push(null)

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} style={{ borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)' }} />
            const evs = getEventsForDay(date)
            const tsks = getTasksForDay(date)
            const les = getMagisterLessonsForDay(date)
            const all = [...evs, ...tsks, ...les]
            const isToday = isSameDay(date, now)
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div key={i} onClick={() => { setCurrent(date); setView('day') }}
                style={{ padding: '4px 5px', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isToday ? 'rgba(0,255,209,0.04)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent', minHeight: '72px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent, #00FFD1)' : 'transparent', color: isToday ? '#000' : isWeekend ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: isToday ? 700 : 400 }}>
                    {date.getDate()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {all.slice(0, 3).map((item, idx) => {
                    const color = item.color || (item.vak ? '#FACC15' : subjects?.find(s => s.id === item.subject_id)?.color || '#818CF8')
                    const label = item.title || item.vak || '–'
                    return (
                      <div key={item.id || idx} style={{ background: color + '28', borderLeft: `2px solid ${color}`, borderRadius: '3px', padding: '1px 5px', fontSize: '10px', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {label}
                      </div>
                    )
                  })}
                  {all.length > 3 && (
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', paddingLeft: '5px' }}>+{all.length - 3} meer</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays(current)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRadius: '16px', background: 'rgba(255,255,255,0.015)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setCurrent(new Date())}
            style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}>
            Vandaag
          </button>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px', display: 'flex', borderRadius: '6px' }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px', display: 'flex', borderRadius: '6px' }}>
            <ChevronRight size={16} />
          </button>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}>
            {headerLabel()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[['day','Dag'], ['week','Week'], ['month','Maand']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: 'none', background: view === v ? 'rgba(255,255,255,0.15)' : 'transparent', color: view === v ? 'white' : 'rgba(255,255,255,0.4)', fontWeight: view === v ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => openNew(current)}
            style={{ background: 'var(--accent, #00FFD1)', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}>
            <Plus size={13} /> Nieuw
          </button>
        </div>
      </div>

      {/* View content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {view === 'month' && <MonthView />}
        {view === 'week'  && <TimeGrid days={weekDays} />}
        {view === 'day'   && <TimeGrid days={[current]} />}
      </div>

      {/* Lesson detail popup */}
      {lessonDetail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', padding: '16px' }}
          onClick={() => setLessonDetail(null)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '340px', padding: '20px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🎓</span>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>
                  {lessonDetail.vak || 'Les'}
                </span>
                {lessonDetail.uitgevallen && (
                  <span style={{ fontSize: '10px', color: '#FF6B6B', background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '6px', padding: '1px 6px' }}>
                    Uitgevallen
                  </span>
                )}
              </div>
              <button onClick={() => setLessonDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Tijd */}
              {lessonDetail.start && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '60px', flexShrink: 0 }}>Tijd</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>
                    {fmtTime(new Date(lessonDetail.start))}
                    {lessonDetail.einde ? ` – ${fmtTime(new Date(lessonDetail.einde))}` : ''}
                  </span>
                </div>
              )}
              {/* Lokaal */}
              {lessonDetail.lokaal && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '60px', flexShrink: 0 }}>Lokaal</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{lessonDetail.lokaal}</span>
                </div>
              )}
              {/* Docent */}
              {lessonDetail.docent && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '60px', flexShrink: 0 }}>Docent</span>
                  <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{lessonDetail.docent}</span>
                </div>
              )}
              {/* Huiswerk */}
              {lessonDetail.huiswerk && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '60px', flexShrink: 0, paddingTop: '2px' }}>Huiswerk</span>
                  <span style={{ fontSize: '12px', color: '#FACC15', fontWeight: 500, lineHeight: 1.4 }}>{lessonDetail.huiswerk}</span>
                </div>
              )}
              {/* Omschrijving */}
              {lessonDetail.omschrijving && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', width: '60px', flexShrink: 0, paddingTop: '2px' }}>Info</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{lessonDetail.omschrijving}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', padding: '16px' }}
          onClick={() => setModal(null)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '16px', margin: 0 }}>
                {modal.mode === 'edit' ? 'Bewerk event' : 'Nieuw event'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="glass-input" placeholder="Titel *" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
              <textarea className="glass-input" placeholder="Beschrijving" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                style={{ resize: 'vertical', minHeight: '56px' }} />
              <input type="date" className="glass-input" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input type="time" className="glass-input" value={form.startTime}
                  onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
                <input type="time" className="glass-input" value={form.endTime}
                  onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
              <select className="glass-input" value={form.recurrence}
                onChange={e => setForm(p => ({ ...p, recurrence: e.target.value }))}>
                <option value="">Geen herhaling</option>
                <option value="daily">Dagelijks</option>
                <option value="weekly">Wekelijks</option>
                <option value="monthly">Maandelijks</option>
              </select>
              {form.recurrence === 'weekly' && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Ma','Di','Wo','Do','Vr','Za','Zo'].map((d, i) => {
                    const dayNum = (i + 1) % 7
                    const sel = form.recurrence_days.includes(dayNum)
                    return (
                      <button key={i} type="button"
                        onClick={() => setForm(p => ({ ...p, recurrence_days: sel ? p.recurrence_days.filter(x => x !== dayNum) : [...p.recurrence_days, dayNum] }))}
                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid', borderColor: sel ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: sel ? 'rgba(0,255,209,0.15)' : 'transparent', color: sel ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EVENT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', boxSizing: 'border-box', transform: form.color === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s' }} />
                ))}
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
                style={{ flex: 1, padding: '9px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>
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
