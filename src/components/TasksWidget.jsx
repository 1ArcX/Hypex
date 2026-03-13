import React, { useState } from 'react'
import { Plus, GripVertical, Trash2, CheckCircle2, Circle, X, AlertCircle } from 'lucide-react'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateStr, timeStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const tStr = todayStr()
  const tomStr = tomorrow.toISOString().slice(0, 10)
  if (target < today) return { label: `Verlopen · ${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`, overdue: true }
  if (dateStr === tStr) {
    // If there's a time set and it has already passed, mark as overdue
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number)
      const taskTime = new Date(); taskTime.setHours(h, m, 0, 0)
      if (taskTime < new Date()) return { label: 'Te laat', overdue: true }
    }
    return { label: 'Vandaag', overdue: false }
  }
  if (dateStr === tomStr) return { label: 'Morgen', overdue: false }
  return { label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), overdue: false }
}

export default function TasksWidget({ tasks, subjects, onAdd, onDelete, onToggle, onEdit, onDragStart, onViewDetail, onNew }) {
  const [adding, setAdding] = useState(false)
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

  const incomplete = tasks.filter(t => !t.completed)
  const complete = tasks.filter(t => t.completed)

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span style={{ color: 'var(--accent)' }}>✅</span> Taken
        </h3>
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
        {incomplete.map(task => {
          const subject = subjects.find(s => s.id === task.subject_id)
          const dateInfo = task.date ? formatDate(task.date, task.start_time || task.time) : null
          return (
            <div
              key={task.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('taskId', task.id)
                onDragStart?.(task)
              }}
              onClick={() => onViewDetail ? onViewDetail(task) : onEdit?.(task)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px',
                border: dateInfo?.overdue ? '1px solid rgba(255,100,100,0.2)' : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', background: dateInfo?.overdue ? 'rgba(255,80,80,0.04)' : 'rgba(255,255,255,0.01)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = dateInfo?.overdue ? 'rgba(255,80,80,0.07)' : 'color-mix(in srgb, var(--accent) 4%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = dateInfo?.overdue ? 'rgba(255,80,80,0.04)' : 'rgba(255,255,255,0.01)'}>
              <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
              <button onClick={e => { e.stopPropagation(); onToggle(task) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <Circle size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {task.title}
                </p>
                <p style={{ fontSize: '11px', margin: 0, marginTop: '2px', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {dateInfo?.overdue && <AlertCircle size={9} style={{ color: '#ff6b6b', flexShrink: 0 }} />}
                  <span style={{ color: dateInfo?.overdue ? '#ff8080' : 'rgba(255,255,255,0.3)' }}>
                    {dateInfo?.label || ''}
                    {(task.start_time || task.time) ? ` · ${task.start_time || task.time}` : ''}
                    {task.end_time ? `–${task.end_time}` : ''}
                    {subject ? ` · ${subject.name}` : ''}
                  </span>
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(task.id) }}
                title="Verwijderen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.35)', padding: '3px', flexShrink: 0, borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,80,80,0.35)'}>
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
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
