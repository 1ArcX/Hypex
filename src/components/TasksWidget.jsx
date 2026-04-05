import React, { useState, useRef } from 'react'

function SwipeableRow({ onSwipeRight, onSwipeLeft, children }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(null)

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX }
  const onTouchMove = (e) => {
    if (startX.current === null) return
    setOffset(Math.max(-100, Math.min(100, e.touches[0].clientX - startX.current)))
  }
  const onTouchEnd = () => {
    if (offset > 60) onSwipeRight()
    else if (offset < -60) onSwipeLeft()
    setOffset(0)
    startX.current = null
  }

  const actionBg = offset > 20
    ? `rgba(74,222,128,${Math.min(0.35, (offset - 20) / 80)})`
    : offset < -20
    ? `rgba(255,107,107,${Math.min(0.35, (-offset - 20) / 80)})`
    : 'transparent'

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: actionBg, transition: 'background 0.1s' }} />
      <div
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.25s ease' : 'none', position: 'relative' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
import { Plus, GripVertical, Trash2, CheckCircle2, Circle, X, AlertCircle, Flag, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react'

const PRIORITY_DOT = {
  1: '#FF6B6B',
  2: '#FACC15',
  3: 'rgba(255,255,255,0.2)',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = (str || '').split(':').map(Number)
  return (h||0)*60 + (m||0)
}

function getTimeStatus(dateStr, startTime, endTime) {
  if (!dateStr) return null
  const pad2 = n => String(n).padStart(2,'0')
  const now = new Date()
  const todayStr2 = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`
  if (dateStr < todayStr2) return { label: 'Te laat', overdue: true }
  if (dateStr > todayStr2) {
    const d = new Date(dateStr + 'T00:00:00')
    const tom = new Date(now); tom.setDate(now.getDate()+1); tom.setHours(0,0,0,0)
    if (dateStr === `${tom.getFullYear()}-${pad2(tom.getMonth()+1)}-${pad2(tom.getDate())}`) return { label: 'Morgen', overdue: false }
    return { label: d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' }), overdue: false }
  }
  // today
  if (!startTime && !endTime) return { label: 'Vandaag', overdue: false }
  const nowMins = now.getHours()*60 + now.getMinutes()
  const startMins = timeStrToMins(startTime)
  const endMins = timeStrToMins(endTime)
  if (endMins && nowMins > endMins) return { label: 'Te laat', overdue: true }
  if (startMins && endMins && nowMins >= startMins && nowMins <= endMins) return { label: 'Nu', overdue: false, active: true }
  return { label: 'Vandaag', overdue: false }
}

export default function TasksWidget({ tasks, subjects, onAdd, onDelete, onToggle, onEdit, onDragStart, onViewDetail, onNew }) {
  const [adding, setAdding] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [newTime, setNewTime] = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('10:00')
  const [newSubject, setNewSubject] = useState('')

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    await onAdd({
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      start_time: newTime,
      end_time: newEndTime,
      subject_id: newSubject || null
    })
    setNewTitle('')
    setNewDate(todayStr())
    setNewTime('09:00')
    setNewEndTime('10:00')
    setNewSubject('')
    setAdding(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') setAdding(false)
  }

  const sortFn = (a, b) => {
    const pa = a.priority ?? 2, pb = b.priority ?? 2
    if (pa !== pb) return pa - pb
    const da = a.due_date || a.date || '9999-99-99'
    const db = b.due_date || b.date || '9999-99-99'
    return da.localeCompare(db)
  }
  const incomplete = tasks.filter(t => !t.completed).sort(sortFn)

  // Groepeer: taken met groep apart, taken zonder groep direct
  const groupedSections = (() => {
    const withGroup = {}
    const noGroup = []
    for (const t of incomplete) {
      if (t.group_name) {
        if (!withGroup[t.group_name]) withGroup[t.group_name] = []
        withGroup[t.group_name].push(t)
      } else {
        noGroup.push(t)
      }
    }
    const sections = []
    for (const [name, items] of Object.entries(withGroup)) sections.push({ name, items })
    if (noGroup.length) sections.push({ name: null, items: noGroup })
    return sections
  })()

  const complete = tasks.filter(t => t.completed)
    .sort((a, b) => (b.updated_at || b.date || '').localeCompare(a.updated_at || a.date || ''))

  return (
    <div className="glass-card p-4" style={{
      borderLeft: '3px solid rgba(0,255,209,0.4)',
      background: 'linear-gradient(135deg, rgba(0,255,209,0.04) 0%, transparent 60%)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(0,255,209,0.12)', border: '1px solid rgba(0,255,209,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckSquare size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Taken</span>
        </div>
        <button
          onClick={() => { if (onNew) { onNew() } else { setAdding(!adding); setNewTitle('') } }}
          style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          {adding && !onNew ? <X size={12} /> : <Plus size={12} />}
          {adding && !onNew ? 'Annuleer' : 'Nieuw'}
        </button>
      </div>

      {/* Inline aanmaken */}
      {adding && (
        <div style={{ background: 'color-mix(in srgb, var(--accent) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: '12px', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            className="glass-input"
            placeholder="Taaknaam..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: '13px' }}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Datum</label>
              <input
                type="date"
                className="glass-input"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{ fontSize: '12px', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Vak</label>
              <select
                className="glass-input"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                style={{ fontSize: '12px', colorScheme: 'dark' }}>
                <option value="">Geen vak</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Starttijd</label>
              <input type="time" className="glass-input" value={newTime}
                onChange={e => setNewTime(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Eindtijd</label>
              <input type="time" className="glass-input" value={newEndTime}
                onChange={e => setNewEndTime(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }} />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            style={{ padding: '8px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: !newTitle.trim() ? 0.4 : 1 }}>
            + Toevoegen
          </button>
        </div>
      )}

      {/* Lege staat */}
      {incomplete.length === 0 && !adding && (
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
          Geen taken — klik op Nieuw om te beginnen
        </p>
      )}

      {/* Taken lijst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {groupedSections.map(section => (
          <div key={section.name ?? '__none__'}>
            {section.name && (() => {
              const isCollapsed = collapsedGroups.has(section.name)
              const totalMins = section.items.reduce((sum, t) => sum + (t.duration_minutes || 0), 0)
              const durLabel = totalMins > 0
                ? (Math.floor(totalMins / 60) > 0
                    ? `${Math.floor(totalMins / 60)}u${totalMins % 60 > 0 ? ` ${totalMins % 60}m` : ''}`
                    : `${totalMins}m`)
                : null
              return (
                <div
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(section.name)) next.delete(section.name)
                    else next.add(section.name)
                    return next
                  })}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '8px 4px 4px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}
                >
                  {isCollapsed
                    ? <ChevronRight size={11} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.25)' }} />
                    : <ChevronDown size={11} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.25)' }} />}
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                  {section.name}
                  {durLabel && (
                    <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.2)', letterSpacing: 0, textTransform: 'none', marginLeft: 2 }}>
                      · {durLabel}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.18)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {section.items.length} {section.items.length === 1 ? 'taak' : 'taken'}
                  </span>
                </div>
              )
            })()}
            {!collapsedGroups.has(section.name) && section.items.map(task => {
              const subject = subjects.find(s => s.id === task.subject_id)
              const dateInfo = getTimeStatus(task.date, task.start_time || task.time, task.end_time)
              const isUrgent = (task.priority ?? 2) === 1
              const isLow = (task.priority ?? 2) === 3

              // Card styling by urgency level
              const cardBg = isUrgent
                ? 'linear-gradient(135deg, rgba(255,50,50,0.1) 0%, rgba(255,50,50,0.05) 100%)'
                : dateInfo?.overdue ? 'rgba(255,80,80,0.06)'
                : dateInfo?.active ? 'color-mix(in srgb, var(--accent) 5%, transparent)'
                : 'rgba(255,255,255,0.02)'
              const cardBgHover = isUrgent
                ? 'linear-gradient(135deg, rgba(255,50,50,0.14) 0%, rgba(255,50,50,0.07) 100%)'
                : dateInfo?.overdue ? 'rgba(255,80,80,0.09)'
                : dateInfo?.active ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
                : 'color-mix(in srgb, var(--accent) 4%, transparent)'
              const cardBorder = isUrgent
                ? '1px solid rgba(255,60,60,0.35)'
                : dateInfo?.overdue ? '1px solid rgba(255,100,100,0.25)'
                : dateInfo?.active ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)'
                : '1px solid rgba(255,255,255,0.07)'
              const circleColor = isUrgent ? 'rgba(255,60,60,0.7)'
                : dateInfo?.overdue ? 'rgba(255,100,100,0.5)'
                : dateInfo?.active ? 'var(--accent)'
                : isLow ? 'rgba(255,255,255,0.12)'
                : 'rgba(255,255,255,0.2)'

              return (
                <SwipeableRow key={task.id} onSwipeRight={() => onToggle(task)} onSwipeLeft={() => onDelete(task.id)}>
                <div
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('taskId', task.id)
                    onDragStart?.(task)
                  }}
                  onClick={() => onViewDetail ? onViewDetail(task) : onEdit?.(task)}
                  className={isUrgent ? 'urgent-task' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: isUrgent ? '13px 14px' : '12px 14px',
                    borderRadius: 14,
                    border: cardBorder,
                    borderLeft: isUrgent ? '3px solid rgba(255,60,60,0.75)' : cardBorder,
                    cursor: 'pointer',
                    background: cardBg,
                    transition: 'background 0.15s',
                    marginBottom: 3,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = cardBgHover}
                  onMouseLeave={e => e.currentTarget.style.background = cardBg}>
                  <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                  <button onClick={e => { e.stopPropagation(); onToggle(task) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      border: `2px solid ${circleColor}`,
                      background: isUrgent ? 'rgba(255,60,60,0.08)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isUrgent || dateInfo?.overdue ? 3 : 2 }}>
                      <p style={{ fontSize: '14px', color: isUrgent ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)', fontWeight: isUrgent ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, flex: 1, minWidth: 0 }}>
                        {task.title}
                      </p>
                      {isUrgent && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ff5555', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: 5, padding: '1px 6px', flexShrink: 0, letterSpacing: '0.03em' }}>
                          🔥 URGENT
                        </span>
                      )}
                      {!isUrgent && dateInfo?.overdue && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ff8080', background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>
                          ⚠️ Te laat
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', margin: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: isUrgent ? 'rgba(255,100,100,0.7)' : dateInfo?.overdue ? '#ff8080' : dateInfo?.active ? 'var(--accent)' : 'rgba(255,255,255,0.28)' }}>
                        {dateInfo?.active ? '• Nu' : dateInfo?.label || ''}
                        {(task.start_time || task.time) ? ` · ${task.start_time || task.time}` : ''}
                        {task.end_time ? `–${task.end_time}` : ''}
                        {subject ? ` · ${subject.name}` : ''}
                        {task.due_date && task.due_date !== task.date ? ` · ⏰ ${new Date(task.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(task.id) }}
                    title="Verwijderen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.3)', padding: '3px', flexShrink: 0, borderRadius: '4px' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,80,80,0.3)'}>
                    <Trash2 size={12} />
                  </button>
                </div>
                </SwipeableRow>
              )
            })}
          </div>
        ))}
      </div>

      {/* Afgeronde taken */}
      {complete.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginBottom: '6px' }}>
            Afgerond ({complete.length})
          </p>
          {complete.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', opacity: 0.5 }}>
              <button onClick={() => onToggle(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
              </button>
              <p style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title}
              </p>
              <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.3)', padding: '2px', flexShrink: 0 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
