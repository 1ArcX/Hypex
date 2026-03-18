import React from 'react'
import WorkWidget from '../components/WorkWidget'
import VrachttijdenWidget from '../components/VrachttijdenWidget'

export default function JumboPage({ isAdmin }) {
  if (!isAdmin) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-3)' }}>Geen toegang</p>
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Jumbo ★</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        alignItems: 'start',
      }}>
        <WorkWidget />
        <VrachttijdenWidget />
      </div>
    </div>
  )
}
