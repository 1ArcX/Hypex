import React from 'react'
import NotesWidget from '../components/NotesWidget'
import { useIsDesktop } from '../hooks/useIsDesktop'

export default function NotitiesPage({ userId, syncTrigger }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isDesktop ? '24px 28px' : '12px 16px 100px' }}>
      {isDesktop && <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#F59E0B', borderLeft: '3px solid rgba(245,158,11,0.5)', paddingLeft: 12 }}>Notities</h2>}
      <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight seamless={!isDesktop} />
    </div>
  )
}
