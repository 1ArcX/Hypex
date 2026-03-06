import React, { useState } from 'react'
import { BookOpen, Plus, Trash2, Edit2, Check, X, ExternalLink } from 'lucide-react'

export default function SubjectsWidget({ subjects, onAdd, onDelete, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', color: '#00FFD1', url: '' })
  const [editForm, setEditForm] = useState({ name: '', color: '#00FFD1', url: '' })

  const COLORS = ['#00FFD1', '#FF8C42', '#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#F87171']

  const handleAdd = () => {
    if (!form.name.trim()) return
    onAdd(form)
    setForm({ name: '', color: '#00FFD1', url: '' })
    setAdding(false)
  }

  const startEdit = (subject) => {
    setEditingId(subject.id)
    setEditForm({ name: subject.name, color: subject.color || '#00FFD1', url: subject.url || '' })
  }

  const saveEdit = () => {
    onUpdate(editingId, editForm)
    setEditingId(null)
  }

  const normalizeUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return 'https://' + url
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold text-white">Vakken</h3>
        </div>
        <button onClick={() => setAdding(!adding)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
          {adding ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {adding && (
        <div className="mb-3 p-3 rounded-2xl space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            type="text" placeholder="Vaknaam..."
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="glass-input w-full" style={{ fontSize: '12px' }}
          />
          <input
            type="text" placeholder="URL online boek (optioneel)"
            value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
            className="glass-input w-full" style={{ fontSize: '12px' }}
          />
          <div className="flex gap-1 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                style={{
                  width: '20px', height: '20px', borderRadius: '50%', background: c,
                  border: form.color === c ? '2px solid white' : '2px solid transparent',
                  cursor: 'pointer'
                }} />
            ))}
          </div>
          <button onClick={handleAdd} className="btn-neon w-full text-xs py-1.5">
            Toevoegen
          </button>
        </div>
      )}

      <div className="space-y-1">
        {subjects.map(subject => (
          <div key={subject.id}>
            {editingId === subject.id ? (
              <div className="p-2 rounded-xl space-y-2"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input
                  type="text" value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="glass-input w-full" style={{ fontSize: '12px' }}
                />
                <input
                  type="text" placeholder="URL online boek"
                  value={editForm.url}
                  onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                  className="glass-input w-full" style={{ fontSize: '12px' }}
                />
                <div className="flex gap-1 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditForm({ ...editForm, color: c })}
                      style={{
                        width: '18px', height: '18px', borderRadius: '50%', background: c,
                        border: editForm.color === c ? '2px solid white' : '2px solid transparent',
                        cursor: 'pointer'
                      }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="btn-neon flex-1 text-xs py-1 flex items-center justify-center gap-1">
                    <Check size={12} /> Opslaan
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="text-xs py-1 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 py-2 rounded-xl group"
                style={{ transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color || 'var(--accent)', flexShrink: 0 }} />
                <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {subject.name}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" style={{ transition: 'opacity 0.2s' }}>
                  {subject.url && (
                    <a
                      href={normalizeUrl(subject.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open online boek"
                      style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button onClick={() => startEdit(subject)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => onDelete(subject.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.6)', display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {subjects.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Nog geen vakken toegevoegd
          </p>
        )}
      </div>
    </div>
  )
}