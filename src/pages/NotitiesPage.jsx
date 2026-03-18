import React from 'react'
import NotesWidget from '../components/NotesWidget'

export default function NotitiesPage({ userId, syncTrigger }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>Notities</h2>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight />
      </div>
    </div>
  )
}
