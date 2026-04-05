import React from 'react'
import NotesWidget from '../components/NotesWidget'

export default function NotitiesPage({ userId, syncTrigger }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#F59E0B', flexShrink: 0, borderLeft: '3px solid rgba(245,158,11,0.5)', paddingLeft: 12 }}>Notities</h2>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight />
      </div>
    </div>
  )
}
