import React from 'react'
import { Plus, CheckCircle2, Circle, ExternalLink } from 'lucide-react'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 08:00 - 22:00

export default function Timeline({ tasks, subjects, onSlotClick, onTaskClick, onToggleTask }) {
  const getTasksForHour = (hour) =>
    tasks.filter(t => {
      const h = parseInt(t.time?.split(':')[0])
      return h === hour
    })

  const getSubject = (subjectId) => subjects.find(s => s.id === subjectId)

  return (
    <div className="relative" style={{ paddingLeft: '60px' }}>
      <div className="timeline-line" />

      {HOURS.map(hour => {
        const hourTasks = getTasksForHour(hour)
        const timeStr = `${String(hour).padStart(2, '0')}:00`
        const isPast = new Date().getHours() > hour
        const isCurrent = new Date().getHours() === hour

        return (
          <div key={hour} className="relative mb-1">
            {/* Hour label */}
            <div className="absolute left-0 flex items-center" style={{ top: '10px', width: '50px' }}>
              <span className="text-xs font-mono" style={{
                color: isCurrent ? '#00FFD1' : isPast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
                textShadow: isCurrent ? '0 0 8px rgba(0,255,209,0.6)' : 'none'
              }}>
                {timeStr}
              </span>
            </div>

            {/* Dot on timeline */}
            <div className="absolute" style={{ left: '-22px', top: '14px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: isCurrent ? '#00FFD1' : 'rgba(0,255,209,0.2)',
                boxShadow: isCurrent ? '0 0 8px #00FFD1' : 'none',
                border: '1px solid rgba(0,255,209,0.4)'
              }} />
            </div>

            {/* Tasks or empty slot */}
            <div className="min-h-[40px] py-1">
              {hourTasks.length === 0 ? (
                <button
                  onClick={() => onSlotClick(timeStr)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all duration-200 group"
                  style={{ color: 'rgba(255,255,255,0.15)', border: '1px solid transparent' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,209,0.15)'
                    e.currentTarget.style.background = 'rgba(0,255,209,0.03)'
                    e.currentTarget.style.color = 'rgba(0,255,209,0.4)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.15)'
                  }}
                >
                  <Plus size={12} className="inline mr-1" /> Taak toevoegen
                </button>
              ) : (
                <div className="space-y-1">
                  {hourTasks.map(task => {
                    const subject = getSubject(task.subject_id)
                    return (
                      <div
                        key={task.id}
                        className="task-item flex items-start gap-2 px-3 py-2 rounded-xl cursor-pointer"
                        style={{
                          border: '1px solid rgba(0,255,209,0.1)',
                          background: task.completed ? 'rgba(0,255,209,0.03)' : 'rgba(255,255,255,0.03)'
                        }}
                        onClick={() => onTaskClick(task)}
                      >
                        <button
                          onClick={e => { e.stopPropagation(); onToggleTask(task) }}
                          className="task-check mt-0.5 flex-shrink-0"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.completed ? '#00FFD1' : 'rgba(255,255,255,0.3)' }}
                        >
                          {task.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{
                            color: task.completed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                            textDecoration: task.completed ? 'line-through' : 'none'
                          }}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {task.description}
                            </p>
                          )}
                          {subject && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="subject-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                {subject.name}
                                {subject.url && (
                                  <a href={subject.url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ color: '#00FFD1', marginLeft: '4px' }}>
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {task.time}
                        </span>
                      </div>
                    )
                  })}
                  <button
                    onClick={() => onSlotClick(timeStr)}
                    className="w-full text-left px-3 py-1 rounded-xl text-xs transition-all duration-200"
                    style={{ color: 'rgba(0,255,209,0.3)', border: 'none', background: 'none', cursor: 'pointer' }}
                  >
                    <Plus size={10} className="inline mr-1" /> Meer toevoegen
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}