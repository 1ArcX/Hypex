import React, { useState } from 'react'
import { Plus, GripVertical, Trash2, CheckCircle2, Circle } from 'lucide-react'

export default function TasksWidget({ tasks, subjects, onAdd, onDelete, onToggle, onDragStart }) {
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('09:00')
  const [newSubject, setNewSubject] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = () => {
    if (!newTitle.trim()) return
    onAdd({ title: newTitle.trim(), time: newTime, subject_id: newSubject || null })
    setNewTitle(''); setNewTime('09:00'); setNewSubject(''); setAdding(false)
  }

  const incomplete = tasks.filter(t => !t.completed)
  const complete = tasks.filter(t => t.completed)

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span style={{ color: '#00FFD1' }}>✅</span> Taken
        </h3>
        <button onClick={() => setAdding(!adding)}
          style={{ background: 'rgba(0,255,209,0.1)', border: '1px solid rgba(0,255,209,0.3)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#00FFD1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <Plus size={12} /> Nieuw
        </button>
      </div>

      {/* Nieuw taak formulier */}
      {adding && (
        <div style={{ background: 'rgba(0,255,209,0.05)', border: '1px solid rgba(0,255,209,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
          <input className="glass-input mb-2" placeholder="Taaknaam..." value={newTitle} onChange={e => setNewTitle(e.target.value)} style={{ fontSize: '12px' }} autoFocus />
          <div className="flex gap-2 mb-2">
            <input type="time" className="glass-input" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }} />
            <select className="glass-input" value={newSubject} onChange={e => setNewSubject(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }}>
              <option value="">Geen vak</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="btn-neon flex-1" style={{ fontSize: '12px', padding: '6px', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', background: 'transparent' }}>Annuleer</button>
            <button onClick={handleAdd} disabled={!newTitle.trim()} className="btn-neon flex-1" style={{ fontSize: '12px', padding: '6px' }}>Toevoegen</button>
          </div>
        </div>
      )}

      {/* Taken lijst */}
      {incomplete.length === 0 && !adding && (
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>Geen taken — klik op Nieuw om te beginnen</p>
      )}

      <div className="space-y-1">
        {incomplete.map(task => {
          const subject = subjects.find(s => s.id === task.subject_id)
          return (
            <div key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('taskId', task.id)
                onDragStart?.(task)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'grab', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,209,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <GripVertical size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <button onClick={() => onToggle(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <Circle size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{task.time}{subject ? ` · ${subject.name}` : ''}</p>
              </div>
              <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.4)', padding: '2px', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,80,80,0.4)'}>
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Afgeronde taken */}
      {complete.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginBottom: '6px' }}>Afgerond ({complete.length})</p>
          {complete.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', opacity: 0.5 }}>
              <button onClick={() => onToggle(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <CheckCircle2 size={16} style={{ color: '#00FFD1' }} />
              </button>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>{task.title}</p>
              <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.3)', marginLeft: 'auto' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}