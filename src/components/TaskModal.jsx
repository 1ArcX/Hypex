import React, { useState, useEffect } from 'react'
import { X, Trash2, Save, Clock, BookOpen, AlignLeft, ExternalLink } from 'lucide-react'

export default function TaskModal({ task, defaultTime, subjects, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [time, setTime] = useState('09:00')
  const [subjectId, setSubjectId] = useState('')
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setTime(task.time || '09:00')
      setSubjectId(task.subject_id || '')
      setCompleted(task.completed || false)
    } else {
      setTime(defaultTime || '09:00')
    }
  }, [task, defaultTime])

  const selectedSubject = subjects.find(s => s.id === subjectId)

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ id: task?.id, title, description, time, subject_id: subjectId || null, completed })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">
            {task ? 'Taak bewerken' : 'Nieuwe taak'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'rgba(255,255,255,0.5)' }}>Titel *</label>
            <input
              type="text"
              placeholder="Wat moet je doen?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="glass-input"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <AlignLeft size={12} /> Beschrijving
            </label>
            <textarea
              placeholder="Optionele details..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="glass-input resize-none"
              rows={3}
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Clock size={12} /> Tijdstip
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="glass-input"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <BookOpen size={12} /> Vak
            </label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="glass-input"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Geen vak</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {selectedSubject?.url && (
              <a href={selectedSubject.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1.5 text-xs"
                style={{ color: '#00FFD1' }}>
                <ExternalLink size={12} /> Open online boek
              </a>
            )}
          </div>

          {/* Completed toggle */}
          {task && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCompleted(!completed)}
                className="flex items-center gap-2 text-sm"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: completed ? '#00FFD1' : 'rgba(255,255,255,0.4)' }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '6px',
                  background: completed ? 'rgba(0,255,209,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${completed ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}>
                  {completed && <span style={{ fontSize: '12px' }}>✓</span>}
                </div>
                Afgerond
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          {task && (
            <button onClick={() => onDelete(task.id)} className="btn-neon flex items-center gap-1.5"
              style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff6b6b', background: 'rgba(255,80,80,0.1)' }}>
              <Trash2 size={14} /> Verwijder
            </button>
          )}
          <button onClick={onClose} className="btn-neon flex-1"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}>
            Annuleer
          </button>
          <button onClick={handleSave} disabled={!title.trim()} className="btn-neon flex-1 flex items-center justify-center gap-1.5">
            <Save size={14} /> Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}