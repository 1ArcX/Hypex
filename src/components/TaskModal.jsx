import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Trash2, Save } from 'lucide-react'

const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']
const DURATION_PRESETS = [15, 30, 45, 60, 90]

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

function suggestFreeDay(durationMins, tasks, calendarEvents) {
  const today = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const slots = getFreeSlots(dateStr, durationMins, tasks, calendarEvents)
    if (slots.length > 0) return { dateStr, slot: slots[0], d }
  }
  return null
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
    } else {
      setNoDate(false)
      setDate(defaultDate || new Date().toISOString().slice(0, 10))
      setStartTime(defaultTime || '09:00')
      setEndTime(defaultTime ? (defaultTime.slice(0, 2) < '23' ? `${String(parseInt(defaultTime) + 1).padStart(2, '0')}:00` : '23:59') : '10:00')
      setAllDay(false)
      setPriority(2)
      setDurationMinutes(30)
      setDueDate('')
      setGroupName('')
    }
  }, [task, defaultTime, defaultDate])

  // Pas eindtijd aan als duur verandert
  useEffect(() => {
    if (allDay || noDate) return
    setEndTime(minsToTimeStr(timeStrToMins(startTime) + durationMinutes))
  }, [durationMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedSlots = useMemo(() => {
    if (noDate || allDay || !date) return []
    return getFreeSlots(date, durationMinutes, tasks, calendarEvents)
  }, [date, durationMinutes, noDate, allDay, tasks, calendarEvents])

  const daySuggestion = useMemo(() => {
    if (!noDate) return null
    return suggestFreeDay(durationMinutes, tasks, calendarEvents)
  }, [noDate, durationMinutes, tasks, calendarEvents])

  const overlapConflicts = useMemo(() => {
    if (noDate || allDay || !date || !startTime || !endTime) return []
    return getConflicts(date, timeStrToMins(startTime), timeStrToMins(endTime), tasks, calendarEvents, task?.id)
  }, [date, startTime, endTime, noDate, allDay, tasks, calendarEvents, task?.id])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      id: task?.id, title, description,
      date:       noDate ? null : date,
      start_time: (noDate || allDay) ? null : startTime,
      end_time:   (noDate || allDay) ? null : endTime,
      time:       (noDate || allDay) ? null : startTime,
      subject_id: subjectId || null, color, completed,
      priority,
      duration_minutes: durationMinutes,
      due_date: dueDate || null,
      group_name: groupName.trim() || null,
    })
  }

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
            onChange={e => setTitle(e.target.value)} style={{ fontSize: '16px' }} />

          {/* Beschrijving */}
          <textarea className="glass-input" placeholder="Beschrijving (optioneel)" value={description}
            onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: '60px' }} />

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

          {/* Nog in te plannen */}
          <button type="button" onClick={() => { setNoDate(v => !v); if (!noDate) setAllDay(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: noDate ? '#FACC15' : 'rgba(255,255,255,0.4)', fontSize: 13, padding: 0, width: 'fit-content' }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: noDate ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${noDate ? 'rgba(250,204,21,0.4)' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
              {noDate && <span style={{ fontSize: 12 }}>✓</span>}
            </div>
            Nog in te plannen
          </button>

          {/* Dagvoorstel bij "nog in te plannen" */}
          {noDate && daySuggestion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.22)' }}>
              <span style={{ fontSize: 13 }}>📅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'rgba(250,204,21,0.9)', fontWeight: 600 }}>
                  {formatDutchDate(daySuggestion.d)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(250,204,21,0.55)', marginTop: 1 }}>
                  {daySuggestion.slot.startStr}–{daySuggestion.slot.endStr} · geen overlap
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDate(daySuggestion.dateStr)
                  setStartTime(daySuggestion.slot.startStr)
                  setEndTime(daySuggestion.slot.endStr)
                  setNoDate(false)
                }}
                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.12)', color: '#FACC15', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              >
                Inplannen
              </button>
            </div>
          )}

          {/* Duur presets — altijd zichtbaar */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>Duur</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DURATION_PRESETS.map(d => {
                const active = durationMinutes === d
                return (
                  <button key={d} type="button" onClick={() => setDurationMinutes(d)}
                    style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent', color: active ? 'var(--accent)' : 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {d < 60 ? `${d}m` : `${d / 60}u`}
                  </button>
                )
              })}
            </div>
          </div>

          {!noDate && (
            <>
              {/* Datum */}
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Datum</label>
                <input type="date" className="glass-input" value={date} style={{ colorScheme: 'dark' }}
                  onChange={e => setDate(e.target.value)} />
              </div>

              {/* Hele dag toggle */}
              <button type="button" onClick={() => setAllDay(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: allDay ? 'var(--accent)' : 'rgba(255,255,255,0.4)', fontSize: 13, padding: 0, width: 'fit-content' }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: allDay ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'rgba(255,255,255,0.05)', border: `1px solid ${allDay ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                  {allDay && <span style={{ fontSize: 12 }}>✓</span>}
                </div>
                Hele dag
              </button>

              {!allDay && (
                <>
                  {/* Voorgestelde tijden */}
                  {suggestedSlots.length > 0 && (
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '6px' }}>⚡ Voorgestelde tijden</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {suggestedSlots.map((slot, i) => (
                          <button key={i} type="button"
                            onClick={() => { setStartTime(slot.startStr); setEndTime(slot.endStr) }}
                            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(250,204,21,0.3)', background: 'rgba(250,204,21,0.07)', color: '#FACC15', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {slot.startStr}–{slot.endStr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Start- en eindtijd */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Starttijd</label>
                      <input type="time" className="glass-input" value={startTime} style={{ colorScheme: 'dark', width: '100%' }}
                        onChange={e => { setStartTime(e.target.value); setEndTime(minsToTimeStr(timeStrToMins(e.target.value) + durationMinutes)) }} />
                    </div>
                    <div>
                      <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Eindtijd</label>
                      <input type="time" className="glass-input" value={endTime} style={{ colorScheme: 'dark', width: '100%' }}
                        onChange={e => setEndTime(e.target.value)} />
                    </div>
                  </div>

                  {/* Overlap waarschuwing */}
                  {overlapConflicts.length > 0 && (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 9, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.22)' }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
                      <span style={{ fontSize: 12, color: 'rgba(250,204,21,0.85)', lineHeight: 1.4 }}>
                        Overlapt met: <strong>{overlapConflicts.join(', ')}</strong>
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Deadline */}
              <div>
                <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Deadline (optioneel)</label>
                <input type="date" className="glass-input" value={dueDate} style={{ colorScheme: 'dark' }}
                  onChange={e => setDueDate(e.target.value)} />
              </div>
            </>
          )}

          {/* Deadline ook zichtbaar bij "nog in te plannen" */}
          {noDate && (
            <div>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Deadline (optioneel)</label>
              <input type="date" className="glass-input" value={dueDate} style={{ colorScheme: 'dark' }}
                onChange={e => setDueDate(e.target.value)} />
            </div>
          )}

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
