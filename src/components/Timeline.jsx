import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, ChevronLeft, ChevronRight, Repeat, X, Save } from 'lucide-react'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MONTHS = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
const DAYS_NL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']

function formatTime(h, m = 0) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getWeekDays(date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay() + 1) // start op maandag
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export default function Timeline({ userId, tasks, subjects, onToggleTask }) {
  const [view, setView] = useState('day')
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [dragOverHour, setDragOverHour] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '', date: '', startTime: '09:00', endTime: '10:00',
    color: '#818CF8', type: 'event', recurrence: '', recurrence_days: []
  })
  const scrollRef = useRef(null)
  const now = new Date()

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    // Scroll naar huidige tijd bij laden
    if (scrollRef.current) {
      const hour = now.getHours()
      scrollRef.current.scrollTop = Math.max(0, (hour - 2) * 60)
    }
  }, [view])

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId)
    if (data) setEvents(data)
  }

  const getEventsForDay = (date) => {
    return events.filter(ev => {
      const start = new Date(ev.start_time)
      if (isSameDay(start, date)) return true
      if (ev.recurrence === 'daily' && start <= date) return true
      if (ev.recurrence === 'weekly' && ev.recurrence_days?.includes(date.getDay()) && start <= date) return true
      if (ev.recurrence === 'monthly' && start.getDate() === date.getDate() && start <= date) return true
      return false
    })
  }

  const getTasksForDay = (date) => {
    return tasks.filter(t => {
      if (!t.time) return false
      // Toon taken op de huidige dag als ze geen specifieke datum hebben
      if (!t.date) return isSameDay(date, now)
      return isSameDay(new Date(t.date), date)
    })
  }

  const openNew = (date, hour) => {
    const d = date || current
    setEditEvent(null)
    setForm({
      title: '', description: '',
      date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      startTime: hour !== undefined ? formatTime(hour) : '09:00',
      endTime: hour !== undefined ? formatTime(Math.min(hour + 1, 23)) : '10:00',
      color: '#818CF8', type: 'event', recurrence: '', recurrence_days: []
    })
    setShowModal(true)
  }

  const openEdit = (ev) => {
    const start = new Date(ev.start_time)
    const end = new Date(ev.end_time)
    setEditEvent(ev)
    setForm({
      title: ev.title, description: ev.description || '',
      date: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
      startTime: formatTime(start.getHours(), start.getMinutes()),
      endTime: formatTime(end.getHours(), end.getMinutes()),
      color: ev.color || '#818CF8', type: ev.type || 'event',
      recurrence: ev.recurrence || '', recurrence_days: ev.recurrence_days || []
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    const payload = {
      user_id: userId, title: form.title, description: form.description,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: form.color, type: form.type,
      recurrence: form.recurrence || null,
      recurrence_days: form.recurrence_days.length ? form.recurrence_days : null
    }
    if (editEvent) {
      await supabase.from('calendar_events').update(payload).eq('id', editEvent.id)
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
    setShowModal(false)
    fetchEvents()
  }

  const handleDelete = async () => {
    if (!editEvent) return
    await supabase.from('calendar_events').delete().eq('id', editEvent.id)
    setShowModal(false)
    fetchEvents()
  }

  // Drag & drop taak naar tijdlijn
  const handleDrop = async (e, date, hour) => {
    e.preventDefault()
    setDragOverHour(null)
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    await supabase.from('tasks').update({ time: formatTime(hour), date: dateStr }).eq('id', taskId)
    // Refresh tasks via parent — trigger een custom event
    window.dispatchEvent(new Event('refreshTasks'))
  }

  const navigate = (dir) => {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
  }

  const headerLabel = () => {
    if (view === 'day') return `${DAYS_NL[current.getDay()]} ${current.getDate()} ${MONTHS[current.getMonth()]}`
    if (view === 'week') {
      const days = getWeekDays(current)
      return `${days[0].getDate()} – ${days[6].getDate()} ${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    }
    return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
  }

  // ---- MONTH VIEW ----
  const MonthView = () => {
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1)
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0)
    const startPad = (firstDay.getDay() + 6) % 7 // maandag = 0
    const cells = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(current.getFullYear(), current.getMonth(), d))
    const dayLabels = ['Ma','Di','Wo','Do','Vr','Za','Zo']

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {dayLabels.map(d => (
            <div key={d} style={{ padding: '6px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((date, i) => {
            const dayEvents = date ? [...getEventsForDay(date), ...getTasksForDay(date)] : []
            const isToday = date && isSameDay(date, now)
            return (
              <div key={i}
                onClick={() => { if (date) { setCurrent(date); setView('day') } }}
                style={{ minHeight: '70px', padding: '4px', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: date ? 'pointer' : 'default', background: isToday ? 'rgba(0,255,209,0.04)' : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (date) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'rgba(0,255,209,0.04)' : 'transparent' }}>
                {date && (
                  <>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? '#00FFD1' : 'transparent', color: isToday ? '#000' : 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: isToday ? 700 : 400, marginBottom: '3px' }}>
                      {date.getDate()}
                    </div>
                    {dayEvents.slice(0, 2).map((ev, idx) => (
                      <div key={ev.id || idx}
                        style={{ background: (ev.color || '#818CF8') + '33', border: `1px solid ${ev.color || '#818CF8'}66`, borderRadius: '3px', padding: '1px 4px', fontSize: '9px', color: ev.color || '#818CF8', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>+{dayEvents.length - 2}</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- TIME GRID (dag + week) ----
  const TimeGridView = ({ days }) => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const todayIndex = days.findIndex(d => isSameDay(d, now))
    const dayLabels = ['Ma','Di','Wo','Do','Vr','Za','Zo']

    return (
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }} ref={scrollRef}>
        {/* Dag headers (alleen bij week view) */}
        {days.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'rgba(10,10,26,0.97)', zIndex: 10 }}>
            <div />
            {days.map((d, i) => {
              const isToday = isSameDay(d, now)
              return (
                <div key={i} style={{ padding: '6px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{dayLabels[(d.getDay() + 6) % 7]}</div>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0', background: isToday ? '#00FFD1' : 'transparent', color: isToday ? '#000' : 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: isToday ? 700 : 400 }}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Time grid */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
          {HOURS.map(h => (
            <React.Fragment key={h}>
              {/* Uur label */}
              <div style={{ height: '60px', display: 'flex', alignItems: 'flex-start', paddingTop: '4px', paddingRight: '8px', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>{formatTime(h)}</span>
              </div>

              {/* Kolommen per dag */}
              {days.map((d, di) => {
                const dayEvs = getEventsForDay(d).filter(ev => new Date(ev.start_time).getHours() === h)
                const dayTasks = getTasksForDay(d).filter(t => t.time && parseInt(t.time.split(':')[0]) === h)
                const isDropTarget = dragOverHour?.hour === h && dragOverHour?.dayIndex === di

                return (
                  <div key={di}
                    onClick={() => openNew(d, h)}
                    onDragOver={e => { e.preventDefault(); setDragOverHour({ hour: h, dayIndex: di }) }}
                    onDragLeave={() => setDragOverHour(null)}
                    onDrop={e => handleDrop(e, d, h)}
                    style={{ height: '60px', borderLeft: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', cursor: 'pointer', background: isDropTarget ? 'rgba(0,255,209,0.08)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isDropTarget) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isDropTarget) e.currentTarget.style.background = 'transparent' }}>

                    {/* Calendar events */}
                    {dayEvs.map(ev => {
                      const start = new Date(ev.start_time)
                      const end = new Date(ev.end_time)
                      const duration = Math.max(30, (end - start) / 60000)
                      const topOffset = (start.getMinutes() / 60) * 60
                      const height = Math.min((duration / 60) * 60, 60 - topOffset)
                      return (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); openEdit(ev) }}
                          style={{ position: 'absolute', left: '2px', right: '2px', top: `${topOffset}px`, height: `${height}px`, background: ev.color + '33', border: `1px solid ${ev.color}88`, borderRadius: '6px', padding: '2px 5px', overflow: 'hidden', cursor: 'pointer', zIndex: 2 }}>
                          <p style={{ fontSize: '10px', color: ev.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                          {ev.recurrence && <Repeat size={8} style={{ color: ev.color, opacity: 0.7 }} />}
                        </div>
                      )
                    })}

                    {/* Taken */}
                    {dayTasks.map((task, ti) => {
                      const mins = parseInt(task.time?.split(':')[1] || 0)
                      const topOffset = (mins / 60) * 60
                      const subject = subjects?.find(s => s.id === task.subject_id)
                      return (
                        <div key={task.id}
                          onClick={e => { e.stopPropagation(); onToggleTask?.(task) }}
                          style={{ position: 'absolute', left: '2px', right: '2px', top: `${topOffset + ti * 18}px`, height: '16px', background: task.completed ? 'rgba(0,255,100,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${task.completed ? 'rgba(0,255,100,0.3)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '4px', padding: '0 5px', overflow: 'hidden', cursor: 'pointer', zIndex: 3, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: task.completed ? '#00ff88' : '#00FFD1', flexShrink: 0 }} />
                          <p style={{ fontSize: '9px', color: task.completed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.completed ? 'line-through' : 'none' }}>
                            {task.title}{subject ? ` · ${subject.name}` : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </React.Fragment>
          ))}

          {/* Huidige tijd lijn */}
          {todayIndex >= 0 && (
            <div style={{ position: 'absolute', top: `${nowMinutes}px`, left: `${48 + todayIndex * (100 / days.length)}%`, right: 0, height: '2px', background: '#FF6B6B', zIndex: 5, pointerEvents: 'none', width: days.length === 1 ? 'calc(100% - 48px)' : `${100 / days.length}%` }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6B6B', position: 'absolute', left: '-4px', top: '-3px' }} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays(current)

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setCurrent(new Date())}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
            Vandaag
          </button>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '2px' }}><ChevronLeft size={16} /></button>
          <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '2px' }}><ChevronRight size={16} /></button>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>{headerLabel()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {['day','week','month'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid', borderColor: view === v ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: view === v ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.04)', color: view === v ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
              {v === 'day' ? 'Dag' : v === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
          <button onClick={() => openNew(current)}
            style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.3)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: '#00FFD1', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
            <Plus size={12} /> Nieuw
          </button>
        </div>
      </div>

      {/* Views */}
      {view === 'month' && <MonthView />}
      {view === 'week' && <TimeGridView days={weekDays} />}
      {view === 'day' && <TimeGridView days={[current]} />}

      {/* Event Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6" style={{ width: '100%', maxWidth: '400px', margin: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{editEvent ? 'Bewerk event' : 'Nieuw event'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input className="glass-input" placeholder="Titel *" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} autoFocus />
              <input className="glass-input" placeholder="Beschrijving" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              <input type="date" className="glass-input" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="time" className="glass-input" value={form.startTime} onChange={e => setForm(p => ({...p, startTime: e.target.value}))} />
                <input type="time" className="glass-input" value={form.endTime} onChange={e => setForm(p => ({...p, endTime: e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['event','recurring'].map(t => (
                  <button key={t} onClick={() => setForm(p => ({...p, type: t}))}
                    style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: '1px solid', borderColor: form.type === t ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: form.type === t ? 'rgba(0,255,209,0.15)' : 'transparent', color: form.type === t ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                    {t === 'event' ? '📅 Eenmalig' : '🔁 Terugkerend'}
                  </button>
                ))}
              </div>
              {form.type === 'recurring' && (
                <select className="glass-input" value={form.recurrence} onChange={e => setForm(p => ({...p, recurrence: e.target.value}))}>
                  <option value="">Selecteer herhaling...</option>
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                </select>
              )}
              {form.type === 'recurring' && form.recurrence === 'weekly' && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['Ma','Di','Wo','Do','Vr','Za','Zo'].map((d, i) => {
                    const dayNum = (i + 1) % 7
                    return (
                      <button key={i} onClick={() => setForm(p => ({ ...p, recurrence_days: p.recurrence_days.includes(dayNum) ? p.recurrence_days.filter(x => x !== dayNum) : [...p.recurrence_days, dayNum] }))}
                        style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid', borderColor: form.recurrence_days.includes(dayNum) ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: form.recurrence_days.includes(dayNum) ? 'rgba(0,255,209,0.15)' : 'transparent', color: form.recurrence_days.includes(dayNum) ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Kleur:</span>
                {EVENT_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({...p, color: c}))}
                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {editEvent && (
                <button onClick={handleDelete} className="btn-neon"
                  style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff6b6b', background: 'rgba(255,80,80,0.1)', fontSize: '12px' }}>
                  Verwijder
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="btn-neon"
                style={{ flex: 1, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', background: 'transparent', fontSize: '12px' }}>
                Annuleer
              </button>
              <button onClick={handleSave} disabled={!form.title.trim()} className="btn-neon"
                style={{ flex: 1, fontSize: '12px' }}>
                <Save size={12} /> Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}