import React, { useState, useEffect } from 'react'
import GymWidget from '../components/GymWidget'

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

export default function GymPage({ userId }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isDesktop ? '24px 28px' : '16px 16px 100px' }}>
      {isDesktop && (
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#F97316', borderLeft: '3px solid rgba(249,115,22,0.5)', paddingLeft: 12 }}>
          Gym
        </h2>
      )}
      <GymWidget userId={userId} />
    </div>
  )
}
