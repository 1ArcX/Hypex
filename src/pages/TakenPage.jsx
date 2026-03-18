import React from 'react'
import TasksWidget from '../components/TasksWidget'

export default function TakenPage({
  tasks, subjects,
  onAdd, onEdit, onDelete, onToggle, onViewDetail, onNew,
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 }}>Taken</h2>
      <div style={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
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
    </div>
  )
}
