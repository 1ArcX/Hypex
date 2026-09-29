import React from 'react'
import WorkWidget from '../components/WorkWidget'
import VrachttijdenWidget from '../components/VrachttijdenWidget'

export default function JumboPage({ isAdmin, userId }) {
  if (!isAdmin) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-3)' }}>Geen toegang</p>
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h1 className="t-page hide-mobile" style={{ margin: '0 0 16px' }}>Jumbo ★</h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12,
        alignItems: 'start',
      }}>
        <WorkWidget userId={userId} />
        <VrachttijdenWidget />
      </div>
    </div>
  )
}
