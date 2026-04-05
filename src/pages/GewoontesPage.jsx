import React from 'react'
import HabitsWidget from '../components/HabitsWidget'

export default function GewoontesPage({ userId, syncTrigger }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#22C55E', borderLeft: '3px solid rgba(34,197,94,0.5)', paddingLeft: 12 }}>Gewoontes</h2>
      <HabitsWidget userId={userId} syncTrigger={syncTrigger} />
    </div>
  )
}
