import React, { useState, useEffect } from 'react'
import NotesWidget from '../components/NotesWidget'

function useIsDesktop() {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const h = e => setV(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return v
}

export default function NotitiesPage({ userId, syncTrigger }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: isDesktop ? '24px 28px' : '12px 16px 100px' }}>
      {isDesktop && <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#F59E0B', flexShrink: 0, borderLeft: '3px solid rgba(245,158,11,0.5)', paddingLeft: 12 }}>Notities</h2>}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight seamless={!isDesktop} />
      </div>
    </div>
  )
}
