import React from 'react'
import Timeline from '../components/Timeline'

export default function AgendaPage({
  userId, tasks, subjects,
  onToggleTask, onEditTask, isAdmin,
  onLessonsChange, onEventsChange, onMagisterError,
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>Agenda</h2>
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
          <Timeline
            userId={userId}
            tasks={tasks}
            subjects={subjects}
            onToggleTask={onToggleTask}
            onEditTask={onEditTask}
            isAdmin={isAdmin}
            onLessonsChange={onLessonsChange}
            onEventsChange={onEventsChange}
            onMagisterError={onMagisterError}
          />
        </div>
      </div>
    </div>
  )
}
