import React from 'react'
import NotesWidget from '../components/NotesWidget'
import { useIsDesktop } from '../hooks/useIsDesktop'

export default function NotitiesPage({ userId, syncTrigger, openNoteId }) {
  const isDesktop = useIsDesktop()
  return (
    isDesktop ? (
      // Desktop: split view (lijst links, geselecteerde notitie rechts)
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px', boxSizing: 'border-box' }}>
        <h1 className="t-page" style={{ margin: '0 0 16px', flexShrink: 0 }}>Notities</h1>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight split openNoteId={openNoteId} />
        </div>
      </div>
    ) : (
      // Mobiel: lijst → detail
      <div style={{ height: '100%', overflowY: 'auto', padding: '12px 16px 100px' }}>
        <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight seamless openNoteId={openNoteId} />
      </div>
    )
  )
}
