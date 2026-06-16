import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Trash2, Save, Repeat, Clock } from 'lucide-react'
import { RECURRENCE, recurrenceLabel, snapToPattern } from '../utils/recurrence'

const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']
const DURATION_PRESETS = [15, 30, 45, 60, 90]

const RECURRENCE_OPTIONS = [
  { value: RECURRENCE.NONE,     label: 'Eenmalig' },
  { value: RECURRENCE.DAILY,    label: 'Elke dag' },
  { value: RECURRENCE.WEEKDAYS, label: 'Ma–Vr' },
  { value: RECURRENCE.WEEKLY,   label: 'Weekdagen' },
  { value: RECURRENCE.MONTHLY,  label: 'Maandelijks' },
]
const WEEKDAY_PILLS = [
  { iso: 1, label: 'Ma' }, { iso: 2, label: 'Di' }, { iso: 3, label: 'Wo' },
  { iso: 4, label: 'Do' }, { iso: 5, label: 'Vr' }, { iso: 6, label: 'Za' }, { iso: 7, label: 'Zo' },
]
function isoDowOf(dateStr) {
  if (!dateStr) return 1
  const x = new Date(dateStr + 'T00:00:00').getDay()
  return x === 0 ? 7 : x
}

const PRIORITY_CFG = {
  1: { label: 'Urgent',  color: '#FF6B6B',               bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.35)' },
  2: { label: 'Normaal', color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)' },
  3: { label: 'Later',   color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)' },
}

function pad(n) { return String(n).padStart(2, '0') }
function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function minsToTimeStr(mins) {
  const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59)
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

const TRAVEL_MINS = 30 // reistijd buffer voor school en werk

const NL_DAYS   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const NL_MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
function formatDutchDate(d) {
  return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
}

function suggestFreeSlots(durationMins, tasks, calendarEvents, maxResults = 8) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30 // 30 min buffer
  const results = []
  for (let i = 0; i < 14 && results.length < maxResults; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const slots = getFreeSlots(dateStr, durationMins, tasks, calendarEvents)
    for (const slot of slots) {
      if (dateStr === todayStr && timeStrToMins(slot.startStr) < nowMins) continue
      results.push({ dateStr, slot, d: new Date(d) })
      if (results.length >= maxResults) break
    }
  }
  return results
}

function getFreeSlots(dateStr, durationMins, tasks, calendarEvents) {
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
            if (new Date(l.start).toISOString().slice(0, 10) !== dateStr) return false
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
      if (s.toISOString().slice(0, 10) !== dateStr) return
      const e = new Date(ev.end_time)
      bezet.push({ start: s.getHours() * 60 + s.getMinutes(), end: e.getHours() * 60 + e.getMinutes() })
    } catch {}
  })

  // 4. Al geplande taken (geen reistijd)
  ;(tasks || []).filter(t => t.date === dateStr && t.start_time && t.end_time).forEach(t => {
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

function getConflicts(dateStr, startMins, endMins, tasks, calendarEvents, excludeId) {
  if (!dateStr || startMins >= endMins) return []
  const hits = []

  Object.keys(sessionStorage)
    .filter(k => k.startsWith('magister_sched_'))
    .forEach(k => {
      try {
        const lessons = JSON.parse(sessionStorage.getItem(k)) || []
        lessons.forEach(l => {
          if (!l.start || l.uitgevallen) return
          if (new Date(l.start).toISOString().slice(0, 10) !== dateStr) return
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
      if (s.toISOString().slice(0, 10) !== dateStr) return
      const e = new Date(ev.end_time)
      const es = s.getHours() * 60 + s.getMinutes()
      const ee = e.getHours() * 60 + e.getMinutes()
      if (startMins < ee && endMins > es) hits.push(ev.title || 'Event')
    } catch {}
  })

  ;(tasks || []).filter(t => t.date === dateStr && t.id !== excludeId && t.start_time && t.end_time).forEach(t => {
    const ts = timeStrToMins(t.start_time), te = timeStrToMins(t.end_time)
    if (startMins < te && endMins > ts) hits.push(t.title || 'Taak')
  })

  return [...new Set(hits)]
}

export default function TaskModal({ task, defaultTime, defaultDate, subjects, calendarEvents, tasks, allTasks, onSave, onDelete, onClose }) {
  const [closing, setClosing] = useState(false)
  const mouseDownOnOverlay = useRef(false)
  const handleClose = () => {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 200)
  }

  const [title,           setTitle]           = useState('')
  const [description,     setDescription]     = useState('')
  const [date,            setDate]            = useState('')
  const [startTime,       setStartTime]       = useState('09:00')
  const [endTime,         setEndTime]         = useState('10:00')
  const [subjectId,       setSubjectId]       = useState('')
  const [color,           setColor]           = useState(EVENT_COLORS[0])
  const [completed,       setCompleted]       = useState(false)
  const [allDay,          setAllDay]          = useState(false)
  const [noDate,          setNoDate]          = useState(false)
  const [priority,        setPriority]        = useState(2)
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [dueDate,         setDueDate]         = useState('')
  const [groupName,       setGroupName]       = useState('')
  const [recurrence,      setRecurrence]      = useState(RECURRENCE.NONE)
  const [recurrenceDays,  setRecurrenceDays]  = useState([])
  const [showMore,        setShowMore]        = useState(false)

  // Standaard compact; uitklappen bij bewerken-met-details of bij aanmaken vanuit
  // een tijdslot (defaultTime), zodat snel-toevoegen kort blijft.
  useEffect(() => {
    if (defaultTime) { setShowMore(true); return }
    const hasDetails = task && (task.description || task.subject_id || task.due_date || task.group_name || (task.start_time || task.time))
    setShowMore(!!hasDetails)
  }, [task, defaultTime])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      const hasNoDate = !task.date
      setNoDate(hasNoDate)
      setDate(task.date || new Date().toISOString().slice(0, 10))
      const isAllDay = !task.start_time && !task.time && !task.end_time
      setAllDay(hasNoDate ? false : isAllDay)
      setStartTime(task.start_time || task.time || '09:00')
      setEndTime(task.end_time || '10:00')
      setSubjectId(task.subject_id || '')
      setColor(task.color || EVENT_COLORS[0])
      setCompleted(task.completed || false)
      setPriority(task.priority ?? 2)
      setDurationMinutes(task.duration_minutes ?? 30)
      setDueDate(task.due_date || '')
      setGroupName(task.group_name || '')
      setRecurrence(task.recurrence || RECURRENCE.NONE)
      setRecurrenceDays(task.recurrence_days || [])
    } else {
      setNoDate(false)
      setDate(defaultDate || new Date().toISOString().slice(0, 10))
      setStartTime(defaultTime || '09:00')
      setEndTime(defaultTime ? (defaultTime.slice(0, 2) < '23' ? `${String(parseInt(defaultTime) + 1).padStart(2, '0')}:00` : '23:59') : '10:00')
      // Standaard hele dag; alleen met een echt tijdslot (defaultTime) een tijd
      setAllDay(!defaultTime)
      setPriority(2)
      setDurationMinutes(30)
      setDueDate('')
      setGroupName('')
      setRecurrence(RECURRENCE.NONE)
      setRecurrenceDays([])
    }
  }, [task, defaultTime, defaultDate])

  // Bij "Weekdagen": standaard de weekdag van de gekozen datum selecteren.
  // Een herhalende taak heeft altijd een datum, dus "nog in te plannen" uit.
  useEffect(() => {
    if (recurrence === RECURRENCE.WEEKLY && recurrenceDays.length === 0) {
      setRecurrenceDays([isoDowOf(date)])
    }
    if (recurrence) setNoDate(false)
  }, [recurrence]) // eslint-disable-line react-hooks/exhaustive-deps

  const isRecurring = !!recurrence
  const toggleRecDay = (iso) => {
    setRecurrenceDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso].sort((a, b) => a - b))
  }

  // Pas eindtijd aan als duur verandert
  useEffect(() => {
    if (allDay || noDate) return
    setEndTime(minsToTimeStr(timeStrToMins(startTime) + durationMinutes))
  }, [durationMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedSlots = useMemo(() => {
    if (noDate || allDay || !date) return []
    return getFreeSlots(date, durationMinutes, tasks, calendarEvents)
  }, [date, durationMinutes, noDate, allDay, tasks, calendarEvents])

  const [showSuggestCount, setShowSuggestCount] = useState(2)
  const daySuggestions = useMemo(() => {
    if (!noDate) return []
    return suggestFreeSlots(durationMinutes, tasks, calendarEvents)
  }, [noDate, durationMinutes, tasks, calendarEvents])
  useEffect(() => { setShowSuggestCount(2) }, [noDate, durationMinutes])

  const overlapConflicts = useMemo(() => {
    if (noDate || allDay || !date || !startTime || !endTime) return []
    return getConflicts(date, timeStrToMins(startTime), timeStrToMins(endTime), tasks, calendarEvents, task?.id)
  }, [date, startTime, endTime, noDate, allDay, tasks, calendarEvents, task?.id])

  const handleSave = () => {
    if (!title.trim()) return
    // Een herhalende taak heeft altijd een (start)datum; "nog in te plannen" geldt niet.
    const effectiveNoDate = isRecurring ? false : noDate
    const recDays = (recurrence === RECURRENCE.WEEKLY && recurrenceDays.length) ? recurrenceDays : null
    // Snap de startdatum naar de eerste echte patroon-dag (bv. eerstvolgende vrijdag).
    const effectiveDate = effectiveNoDate ? null : (recurrence ? snapToPattern(date, recurrence, recDays) : date)
    onSave({
      id: task?.id, title, description,
      date:       effectiveDate,
      start_time: (effectiveNoDate || allDay) ? null : startTime,
      end_time:   (effectiveNoDate || allDay) ? null : endTime,
      time:       (effectiveNoDate || allDay) ? null : startTime,
      subject_id: subjectId || null, color, completed,
      priority,
      duration_minutes: durationMinutes,
      due_date: dueDate || null,
      group_name: groupName.trim() || null,
      recurrence: recurrence || null,
      recurrence_days: recDays,
    })
  }

  const quickToday = new Date().toISOString().slice(0, 10)
  const quickTomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
  const chipStyle = (active, accent) => ({
    padding: '6px 12px', borderRadius: 9,
    border: `1px solid ${active ? (accent ? `${accent}66` : 'color-mix(in srgb, var(--accent) 50%, transparent)') : 'rgba(255,255,255,0.1)'}`,
    background: active ? (accent ? `${accent}1f` : 'color-mix(in srgb, var(--accent) 12%, transparent)') : 'transparent',
    color: active ? (accent || 'var(--accent)') : 'rgba(255,255,255,0.35)',
    fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
  })

  return (
    <div className={closing ? 'modal-overlay modal-closing' : 'modal-overlay'}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', padding: '16px' }}
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget }}
      onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) handleClose(); mouseDownOnOverlay.current = false }}>
      <div className={`glass-card modal-content${closing ? ' modal-closing' : ''}`}
        style={{ width: '100%', maxWidth: '440px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ color: 'white', fontWeight: 700, fontSize: '16px', margin: 0 }}>
            {task ? '✏️ Taak bewerken' : '📝 Nieuwe taak'}
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Titel */}
          <input className="glass-input" placeholder="Titel *" value={title}
            onChange={e => setTitle(e.target.value)} style={{ fontSize: '16px' }} autoFocus />

          {/* Wanneer — snelle datumkeuze */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>Wanneer</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => { setNoDate(false); setDate(quickToday) }}
                style={chipStyle(!noDate && date === quickToday)}>Vandaag</button>
              <button type="button" onClick={() => { setNoDate(false); setDate(quickTomorrow) }}
                style={chipStyle(!noDate && date === quickTomorrow)}>Morgen</button>
              {!isRecurring && (
                <button type="button" onClick={() => { setNoDate(true); setAllDay(false) }}
                  style={chipStyle(noDate, '#FACC15')}>Geen datum</button>
              )}
            </div>
            {!noDate && (
              <input type="date" className="glass-input" value={date} style={{ colorScheme: 'dark', marginTop: 8, fontSize: 13 }}
                onChange={e => { setNoDate(false); setDate(e.target.value) }} />
            )}

            {/* Tijdslot — standaard hele dag; optioneel een tijd toevoegen */}
            {!noDate && allDay && (
              <button type="button" onClick={() => setAllDay(false)}
                style={{ ...chipStyle(false), marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={12} /> + Tijdslot toevoegen
              </button>
            )}
            {!noDate && !allDay && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Voorgestelde tijden */}
                {suggestedSlots.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {suggestedSlots.map((slot, i) => (
                      <button key={i} type="button"
                        onClick={() => { setStartTime(slot.startStr); setEndTime(slot.endStr) }}
                        style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(250,204,21,0.3)', background: 'rgba(250,204,21,0.07)', color: '#FACC15', fontSize: '12px', cursor: 'pointer' }}>
                        ⚡ {slot.startStr}–{slot.endStr}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="time" className="glass-input" value={startTime} style={{ colorScheme: 'dark', flex: 1 }}
                    onChange={e => { setStartTime(e.target.value); setEndTime(minsToTimeStr(timeStrToMins(e.target.value) + durationMinutes)) }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>–</span>
                  <input type="time" className="glass-input" value={endTime} style={{ colorScheme: 'dark', flex: 1 }}
                    onChange={e => setEndTime(e.target.value)} />
                </div>
                {/* Duur-presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DURATION_PRESETS.map(d => {
                    const active = durationMinutes === d
                    return (
                      <button key={d} type="button" onClick={() => setDurationMinutes(d)}
                        style={{ padding: '4px 9px', borderRadius: '8px', border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent', color: active ? 'var(--accent)' : 'rgba(255,255,255,0.35)', fontSize: '11px', cursor: 'pointer' }}>
                        {d < 60 ? `${d}m` : `${d / 60}u`}
                      </button>
                    )
                  })}
                </div>
                {/* Overlap-waarschuwing */}
                {overlapConflicts.length > 0 && (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 9, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.22)' }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: 'rgba(250,204,21,0.85)', lineHeight: 1.4 }}>
                      Overlapt met: <strong>{overlapConflicts.join(', ')}</strong>
                    </span>
                  </div>
                )}
                <button type="button" onClick={() => setAllDay(true)}
                  style={{ alignSelf: 'flex-start', fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  × Tijdslot verwijderen (hele dag)
                </button>
              </div>
            )}
          </div>

          {/* Prioriteit */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>Prioriteit</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3].map(p => {
                const cfg = PRIORITY_CFG[p]
                const active = priority === p
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: '8px', border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`, background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'rgba(255,255,255,0.25)', fontSize: '12px', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s' }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Herhaling */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 5, marginBottom: '6px' }}>
              <Repeat size={11} /> Herhaling
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {RECURRENCE_OPTIONS.map(opt => {
                const active = recurrence === opt.value
                return (
                  <button key={opt.label} type="button" onClick={() => setRecurrence(opt.value)}
                    style={{ padding: '6px 11px', borderRadius: '9px', border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent', color: active ? 'var(--accent)' : 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s' }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {/* Weekdag-keuze bij "Weekdagen" */}
            {recurrence === RECURRENCE.WEEKLY && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                {WEEKDAY_PILLS.map(d => {
                  const active = recurrenceDays.includes(d.iso)
                  return (
                    <button key={d.iso} type="button" onClick={() => toggleRecDay(d.iso)}
                      style={{ flex: 1, padding: '7px 0', borderRadius: '8px', border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent', color: active ? 'var(--accent)' : 'rgba(255,255,255,0.3)', fontSize: '11px', cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
                      {d.label}
                    </button>
                  )
                })}
              </div>
            )}
            {isRecurring && (
              <p style={{ fontSize: 11, color: 'color-mix(in srgb, var(--accent) 70%, white)', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                🔁 {recurrenceLabel(recurrence, recurrenceDays)} · vanaf {new Date(date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · bouwt een streak op 🔥
              </p>
            )}
          </div>

          {/* Meer opties — uitklapbaar zodat snel-toevoegen kort blijft */}
          <button type="button" onClick={() => setShowMore(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '2px 0', width: 'fit-content' }}>
            <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: showMore ? 'rotate(90deg)' : 'none' }}>▸</span>
            {showMore ? 'Minder opties' : 'Meer opties'}
          </button>

          {showMore && (<>

          {/* Beschrijving */}
          <textarea className="glass-input" placeholder="Beschrijving (optioneel)" value={description}
            onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: '60px' }} />

          {/* Groep */}
          {(() => {
            const existingGroups = [...new Set((allTasks || tasks || []).map(t => t.group_name).filter(Boolean))]
            return (
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Groep (optioneel)</label>
                <input
                  className="glass-input"
                  list="task-groups-list"
                  placeholder="Bijv. Trading, School..."
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
                {existingGroups.length > 0 && (
                  <datalist id="task-groups-list">
                    {existingGroups.map(g => <option key={g} value={g} />)}
                  </datalist>
                )}
                {groupName && (
                  <button type="button" onClick={() => setGroupName('')}
                    style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
                    × Groep verwijderen
                  </button>
                )}
              </div>
            )
          })()}

          {/* Dagvoorstellen bij "nog in te plannen" */}
          {!isRecurring && noDate && daySuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>📅 Beschikbare momenten</label>
              {daySuggestions.slice(0, showSuggestCount).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.18)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'rgba(250,204,21,0.9)', fontWeight: 600 }}>
                      {formatDutchDate(s.d)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(250,204,21,0.5)', marginTop: 1 }}>
                      {s.slot.startStr}–{s.slot.endStr} · geen overlap
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDate(s.dateStr); setStartTime(s.slot.startStr); setEndTime(s.slot.endStr); setNoDate(false) }}
                    style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.12)', color: '#FACC15', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Inplannen
                  </button>
                </div>
              ))}
              {showSuggestCount < daySuggestions.length && (
                <button
                  type="button"
                  onClick={() => setShowSuggestCount(v => v + 2)}
                  style={{ fontSize: 11, color: 'rgba(250,204,21,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
                >
                  + Laad meer momenten
                </button>
              )}
            </div>
          )}

          {/* Deadline */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Deadline (optioneel)</label>
            <input type="date" className="glass-input" value={dueDate} style={{ colorScheme: 'dark' }}
              onChange={e => setDueDate(e.target.value)} />
          </div>

          {/* Vak */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Vak</label>
            <select className="glass-input" value={subjectId} style={{ colorScheme: 'dark' }}
              onChange={e => setSubjectId(e.target.value)}>
              <option value="">Geen vak</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Kleur */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>Kleur</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {EVENT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          </>)}

          {/* Afgerond */}
          {task && (
            <button onClick={() => setCompleted(!completed)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: completed ? '#00FFD1' : 'rgba(255,255,255,0.4)', fontSize: '13px', padding: 0 }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: completed ? 'rgba(0,255,209,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${completed ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                {completed && <span style={{ fontSize: '12px' }}>✓</span>}
              </div>
              Afgerond
            </button>
          )}
        </div>

        {/* Actieknoppen */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          {task && (
            <button onClick={() => onDelete(task.id)}
              style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255,80,80,0.3)', background: 'rgba(255,80,80,0.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trash2 size={13} /> Verwijder
            </button>
          )}
          <button onClick={handleClose}
            style={{ flex: 1, padding: '9px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px' }}>
            Annuleer
          </button>
          <button onClick={handleSave} disabled={!title.trim()}
            style={{ flex: 2, padding: '9px', borderRadius: '10px', border: '1px solid rgba(0,255,209,0.4)', background: 'rgba(0,255,209,0.12)', color: '#00FFD1', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Save size={13} /> Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}
