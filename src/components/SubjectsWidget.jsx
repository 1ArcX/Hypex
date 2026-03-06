import React, { useState } from 'react'
import { BookOpen, Plus, ExternalLink, Trash2, X, Check } from 'lucide-react'

const SUBJECT_COLORS = ['#00FFD1', '#818CF8', '#F472B6', '#FB923C', '#34D399', '#60A5FA', '#A78BFA', '#FBBF24']

export default function SubjectsWidget({ subjects, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [colorIdx, setColorIdx] = useState(0)

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({ name, url, color: SUBJECT_COLORS[colorIdx] })
    setName(''); setUrl(''); setColorIdx(0); setShowForm(false)
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: '#00FFD1' }} />
          <h3 className="text-sm font-semibold text-white">Mijn Vakken</h3>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00FFD1' }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 rounded-2xl space-y-2" style={{ background: 'rgba(0,255,209,0.04)', border: '1px solid rgba(0,255,209,0.1)' }}>
          <input type="text" placeholder="Vaknaam" value={name} onChange={e => setName(e.target.value)} className="glass-input" style={{ fontSize: '13px' }} />
          <input type="url" placeholder="URL online boek (optioneel)" value={url} onChange={e => setUrl(e.target.value)} className="glass-input" style={{ fontSize: '13px' }} />
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Kleur:</span>
            {SUBJECT_COLORS.map((c, i) => (
              <button key={c} onClick={() => setColorIdx(i)}
                style={{ width: '16px', height: '16px', borderRadius: '50%', background: c, border: colorIdx === i ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
          <button onClick={handleAdd} className="btn-neon w-full flex items-center justify-center gap-1.5" style={{ padding: '8px', fontSize: '13px' }}>
            <Check size={14} /> Toevoegen
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {subjects.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Nog geen vakken toegevoegd</p>
        )}
        {subjects.map(subject => (
          <div key={subject.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl group"
            style={{ border: '1px solid transparent', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color || '#00FFD1', flexShrink: 0 }} />
            <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{subject.name}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" style={{ transition: 'opacity 0.2s' }}>
              {subject.url && (
                <a href={subject.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#00FFD1', display: 'flex' }}>
                  <ExternalLink size={13} />
                </a>
              )}
              <button onClick={() => onDelete(subject.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,80,80,0.6)', display: 'flex' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}