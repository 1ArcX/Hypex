import React from 'react'
import NotesApp from '../notes/NotesApp'
import { useIsDesktop } from '../hooks/useIsDesktop'

// Notities in Apple Notes-stijl (src/notes/). Desktop: Mac-indeling in een venster; telefoon: volledig scherm.
export default function NotitiesPage({ userId, syncTrigger, openNoteId, onHome }) {
  const isDesktop = useIsDesktop()
  return isDesktop ? (
    <div style={{ height: '100%', padding: '18px 22px', boxSizing: 'border-box' }}>
      <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
        <NotesApp userId={userId} syncTrigger={syncTrigger} openNoteId={openNoteId} onHome={onHome} />
      </div>
    </div>
  ) : (
    <div style={{ height: '100%' }}>
      <NotesApp userId={userId} syncTrigger={syncTrigger} openNoteId={openNoteId} onHome={onHome} />
    </div>
  )
}
