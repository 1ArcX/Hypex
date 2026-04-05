import React, { useState, useEffect } from 'react'
import HabitsWidget from '../components/HabitsWidget'

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

export default function GewoontesPage({ userId, syncTrigger }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isDesktop ? '24px 28px' : '16px 16px 100px' }}>
      {isDesktop && <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#22C55E', borderLeft: '3px solid rgba(34,197,94,0.5)', paddingLeft: 12 }}>Gewoontes</h2>}
      <HabitsWidget userId={userId} syncTrigger={syncTrigger} seamless={!isDesktop} />
    </div>
  )
}
