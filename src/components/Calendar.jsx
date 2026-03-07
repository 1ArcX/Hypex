import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronRight, Plus, X, Repeat, Calendar as CalIcon } from 'lucide-react'

const DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']

function formatTime(h, m = 0) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getWeekDays(date) {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}

export default function Calendar({ userId }) {
  const [view, setView] = useState('week') // 'day' | 'week' | 'month'
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', date: '', startTime: '09:00', endTime: '10:00', color: '#00FFD1', type: 'event', recurrence: '', recurrence_days: [] })

  useEffect(() => { fetchEvents() }, [])

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId)
    if (data) setEvents(data)
  }

  const openNew = (date, hour) => {
    const d = date || current
    setEditEvent(null)
    setForm({
      title: '', description: '',
      date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      startTime: hour !== undefined ? formatTime(hour) : '09:00',
      endTime: hour !== undefined ? formatTime(hour + 1) : '10:00',
      color: '#00FFD1', type: 'event', recurrence: '', recurrence_days: []
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
      color: ev.color || '#00FFD1', type: ev.type || 'event',
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
    setShowModal(false); fetchEvents()
  }

  const handleDelete = async () => {
    if (!editEvent) return
    await supabase.from('calendar_events').delete().eq('id', editEvent.id)
    setShowModal(false); fetchEvents()
  }

  // Haal events op voor een dag (inclusief terugkerende)
  const getEventsForDay = (date) => {
    return events.filter(ev => {
      const start = new Date(ev.start_time)
      if (isSameDay(start, date)) return true
      if (ev.recurrence === 'daily') return start <= date
      if (ev.recurrence === 'weekly' && ev.recurrence_days?.includes(date.getDay())) return start <= date
      if (ev.recurrence === 'monthly' && start.getDate() === date.getDate()) return start <= date
      return false
    })
  }

  const navigate = (dir) => {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrent(d)
  }

  const headerLabel = () => {
    if (view === 'day') return `${current.getDate()} ${MONTHS[current.getMonth()]} ${current.getFullYear()}`
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
    const startPad = firstDay.getDay()
    const cells = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(current.getFullYear(), current.getMonth(), d))

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {DAYS.map(d => <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((date, i) => {
            const dayEvents = date ? getEventsForDay(date) : []
            const isToday = date && isSameDay(date, new Date())
            return (
              <div key={i} onClick={() => date && openNew(date)}
                style={{ minHeight: '80px', padding: '6px', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: date ? 'pointer' : 'default', background: isToday ? 'rgba(0,255,209,0.04)' : 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (date) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'rgba(0,255,209,0.04)' : 'transparent' }}>
                {date && (
                  <>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isToday ? '#00FFD1' : 'transparent', color: isToday ? '#000' : 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: isToday ? 700 : 400, marginBottom: '4px' }}>
                      {date.getDate()}
                    </div>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); openEdit(ev) }}
                        style={{ background: ev.color + '33', border: `1px solid ${ev.color}66`, borderRadius: '4px', padding: '2px 5px', fontSize: '10px', color: ev.color, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>+{dayEvents.length - 3} meer</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- WEEK/DAY VIEW ----
  const TimeGridView = ({ days }) => {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    return (
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, background: 'rgba(10,10,26,0.95)', zIndex: 10 }}>
          <div />
          {days.map((d, i) => {
            const isToday = isSameDay(d, now)
            return (
              <div key={i} style={{ padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{DAYS[d.getDay()]}</div>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0', background: isToday ? '#00FFD1' : 'transparent', color: isToday ? '#000' : 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: isToday ? 700 : 400 }}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
          {/* Uren */}
          {HOURS.map(h => (
            <React.Fragment key={h}>
              <div style={{ padding: '0 8px', height: '60px', display: 'flex', alignItems: 'flex-start', paddingTop: '4px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{formatTime(h)}</span>
              </div>
              {days.map((d, di) => {
                const dayEvs = getEventsForDay(d).filter(ev => {
                  const s = new Date(ev.start_time)
                  return s.getHours() === h
                })
                return (
                  <div key={di} onClick={() => openNew(d, h)}
                    style={{ height: '60px', borderLeft: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {dayEvs.map(ev => {
                      const start = new Date(ev.start_time)
                      const end = new Date(ev.end_time)
                      const duration = Math.max(30, (end - start) / 60000)
                      const topOffset = (start.getMinutes() / 60) * 60
                      const height = Math.min((duration / 60) * 60, 60 - topOffset)
                      return (
                        <div key={ev.id} onClick={e => { e.stopPropagation(); openEdit(ev) }}
                          style={{ position: 'absolute', left: '2px', right: '2px', top: `${topOffset}px`, height: `${height}px`, background: ev.color + '33', border: `1px solid ${ev.color}88`, borderRadius: '6px', padding: '2px 5px', overflow: 'hidden', cursor: 'pointer', zIndex: 2 }}>
                          <p style={{ fontSize: '10px', color: ev.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </React.Fragment>
          ))}

          {/* Huidige tijd lijn */}
          {days.some(d => isSameDay(d, now)) && (
            <div style={{ position: 'absolute', left: '48px', right: 0, top: `${nowMinutes}px`, height: '2px', background: '#FF6B6B', zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF6B6B', position: 'absolute', left: '-4px', top: '-3px' }} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays(current)

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(new Date())} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>Vandaag</button>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}><ChevronLeft size={18} /></button>
          <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}><ChevronRight size={18} /></button>
          <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{headerLabel()}</span>
        </div>
        <div className="flex items-center gap-2">
          {['day','week','month'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: '1px solid', borderColor: view === v ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: view === v ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.04)', color: view === v ? '#00FFD1' : 'rgba(255,255,255,0.5)' }}>
              {v === 'day' ? 'Dag' : v === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
          <button onClick={() => openNew(current)} style={{ background: 'rgba(0,255,209,0.15)', border: '1px solid rgba(0,255,209,0.4)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', color: '#00FFD1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <Plus size={14} /> Nieuw
          </button>
        </div>
      </div>

      {/* View */}
      {view === 'month' && <MonthView />}
      {view === 'week' && <TimeGridView days={weekDays} />}
      {view === 'day' && <TimeGridView days={[current]} />}

      {/* Event Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6" style={{ width: '100%', maxWidth: '420px', margin: '0 16px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{editEvent ? 'Bewerk event' : 'Nieuw event'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input className="glass-input" placeholder="Titel *" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} autoFocus />
              <input className="glass-input" placeholder="Beschrijving" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              <input type="date" className="glass-input" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} style={{ colorScheme: 'dark' }} />
              <div className="flex gap-2">
                <input type="time" className="glass-input" value={form.startTime} onChange={e => setForm(p => ({...p, startTime: e.target.value}))} style={{ colorScheme: 'dark' }} />
                <input type="time" className="glass-input" value={form.endTime} onChange={e => setForm(p => ({...p, endTime: e.target.value}))} style={{ colorScheme: 'dark' }} />
              </div>

              {/* Type */}
              <div className="flex gap-2">
                {['event','recurring'].map(t => (
                  <button key={t} onClick={() => setForm(p => ({...p, type: t}))}
                    style={{ flex: 1, padding: '6px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: '1px solid', borderColor: form.type === t ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: form.type === t ? 'rgba(0,255,209,0.15)' : 'transparent', color: form.type === t ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                    {t === 'event' ? '📅 Eenmalig' : '🔁 Terugkerend'}
                  </button>
                ))}
              </div>

              {/* Herhaling */}
              {form.type === 'recurring' && (
                <select className="glass-input" value={form.recurrence} onChange={e => setForm(p => ({...p, recurrence: e.target.value}))} style={{ colorScheme: 'dark', fontSize: '12px' }}>
                  <option value="">Selecteer herhaling...</option>
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                </select>
              )}
              {form.type === 'recurring' && form.recurrence === 'weekly' && (
                <div className="flex gap-1 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button key={i} onClick={() => setForm(p => ({ ...p, recurrence_days: p.recurrence_days.includes(i) ? p.recurrence_days.filter(x => x !== i) : [...p.recurrence_days, i] }))}
                      style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid', borderColor: form.recurrence_days.includes(i) ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.1)', background: form.recurrence_days.includes(i) ? 'rgba(0,255,209,0.15)' : 'transparent', color: form.recurrence_days.includes(i) ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}>
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Kleur */}
              <div className="flex gap-2 items-center">
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Kleur:</span>
                {EVENT_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({...p, color: c}))}
                    style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              {editEvent && <button onClick={handleDelete} className="btn-neon" style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff6b6b', background: 'rgba(255,80,80,0.1)', fontSize: '13px' }}>Verwijder</button>}
              <button onClick={() => setShowModal(false)} className="btn-neon flex-1" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', background: 'transparent', fontSize: '13px' }}>Annuleer</button>
              <button onClick={handleSave} disabled={!form.title.trim()} className="btn-neon flex-1" style={{ fontSize: '13px' }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}