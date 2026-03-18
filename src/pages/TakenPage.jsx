import React, { useState } from 'react'
import TasksWidget from '../components/TasksWidget'
import NotesWidget from '../components/NotesWidget'

export default function TakenPage({
  tasks, subjects, userId, syncTrigger,
  onAdd, onEdit, onDelete, onToggle, onViewDetail, onNew,
}) {
  const [tab, setTab] = useState('taken')

  const tabStyle = (active) => ({
    fontSize: 13, padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg-card-2)',
    color: active ? '#000' : 'var(--text-2)',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Taken</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={tabStyle(tab === 'taken')} onClick={() => setTab('taken')}>Taken</button>
          <button style={tabStyle(tab === 'notities')} onClick={() => setTab('notities')}>Notities</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'taken' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <TasksWidget
              tasks={tasks}
              subjects={subjects}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              onViewDetail={onViewDetail}
              onNew={onNew}
            />
          </div>
        )}
        {tab === 'notities' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <NotesWidget userId={userId} syncTrigger={syncTrigger} fullHeight />
          </div>
        )}
      </div>
    </div>
  )
}
