import React from 'react'
import HabitsWidget from '../components/HabitsWidget'

export default function GewoontesPage({ userId, syncTrigger }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Gewoontes</h2>
      <HabitsWidget userId={userId} syncTrigger={syncTrigger} />
    </div>
  )
}
