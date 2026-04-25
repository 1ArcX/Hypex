import React from 'react'
import GymWidget from '../components/GymWidget'
import { useIsDesktop } from '../hooks/useIsDesktop'

export default function GymPage({ userId, onXPEarned }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isDesktop ? '24px 28px' : '16px 16px 100px' }}>
      {isDesktop && (
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#F97316', borderLeft: '3px solid rgba(249,115,22,0.5)', paddingLeft: 12 }}>
          Gym
        </h2>
      )}
      <GymWidget userId={userId} onXPEarned={onXPEarned} />
    </div>
  )
}
