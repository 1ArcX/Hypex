import React, { useState, useEffect } from 'react'
import MagisterWidget from '../components/MagisterWidget'

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

export default function SchoolPage({ userId, onSubjectsSync }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: isDesktop ? 'hidden' : 'auto',
      padding: isDesktop ? '24px 28px' : '16px',
    }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#818CF8', flexShrink: 0, borderLeft: '3px solid rgba(129,140,248,0.5)', paddingLeft: 12 }}>School</h2>
      <div style={{ flex: 1, overflow: isDesktop ? 'hidden' : 'visible' }}>
        <MagisterWidget
          userId={userId}
          onSubjectsSync={onSubjectsSync}
          tabless={isDesktop}
          gridLayout={isDesktop}
          seamless={!isDesktop}
        />
      </div>
    </div>
  )
}
