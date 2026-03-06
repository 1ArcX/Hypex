import React, { useState, useEffect } from 'react'
import { StickyNote } from 'lucide-react'

export default function NotesWidget() {
  const [notes, setNotes] = useState(() => localStorage.getItem('dashboard_notes') || '')

  useEffect(() => {
    const timer = setTimeout(() => localStorage.setItem('dashboard_notes', notes), 500)
    return () => clearTimeout(timer)
  }, [notes])

  return (
    <div className="glass-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote size={16} style={{ color: '#00FFD1' }} />
        <h3 className="text-sm font-semibold text-white">Kladblok</h3>
        <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>auto-opgeslagen</span>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Snelle notities, ideeën, to-do's..."
        className="flex-1 resize-none text-sm"
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.6',
          minHeight: '120px',
          fontFamily: 'inherit'
        }}
      />
    </div>
  )
}