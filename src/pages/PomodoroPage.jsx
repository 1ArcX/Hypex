import React from 'react'
import PomodoroTimer from '../components/PomodoroTimer'

export default function PomodoroPage({ onModeChange, onFocusModeChange, userId }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Pomodoro</h2>
      <PomodoroTimer
        onModeChange={onModeChange}
        onFocusModeChange={onFocusModeChange}
        userId={userId}
      />
    </div>
  )
}
