import React from 'react'
import MagisterWidget from '../components/MagisterWidget'

export default function SchoolPage({ userId, onSubjectsSync }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>School</h2>
      <MagisterWidget userId={userId} onSubjectsSync={onSubjectsSync} />
    </div>
  )
}
