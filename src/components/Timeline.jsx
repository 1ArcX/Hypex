import React from 'react'
import { Plus, CheckCircle2, Circle, ExternalLink } from 'lucide-react'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)

export default function Timeline({ tasks, subjects, onSlotClick, onTaskClick, onToggleTask }) {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const getTasksForHour = (hour) =>
    tasks.filter(t => parseInt(t.time?.split(':')[0]) === hour)

  const getSubject = (subjectId) => subjects.find(s => s.id === subjectId)

  return (
    <div className="relative" style={{ paddingLeft: '64px' }}>
      {/* Verticale tijdlijn lijn */}
      <div style={{
        position: 'absolute', left: '46px', top: 0, bottom: 0,
        width: '1px',
        background: 'linear-gradient(to bottom, transparent, rgba(0,255,209,0.25) 10%, rgba(0,255,209,0.25) 90%, transparent)'
      }} />

      {HOURS.map(hour => {
        const hourTasks = getTasksForHour(hour)
        const timeStr = `${String(hour).padStart(2, '0')}:00`
        const isPast = currentHour > hour
        const isCurrent = currentHour === hour

        return (
          <div key={hour} className="relative mb-2">
            {/* Huidige tijd balk — prominente indicator */}
            {isCurrent && (
              <div style={{
                position: 'absolute',
                left: '-64px',
                right: 0,
                top: `${(currentMinute / 60) * 100}%`,
                height: '2px',
                background: 'linear-gradient(90deg, transparent 0px, #00FFD1 46px, rgba(0,255,209,0.4) 100%)',
                boxShadow: '0 0 8px rgba(0,255,209,0.8)',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                {/* Bolletje op de lijn */}
                <div style={{
                  position: 'absolute',
                  left: '42px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '10px', height: '10px',
                  borderRadius: '50%',
                  background: '#00FFD1',
                  boxShadow: '0 0 10px #00FFD1, 0 0 20px rgba(0,255,209,0.5)'
                }} />
              </div>
            )}

            {/* Uur label — apart blok, geen overlap */}
            <div style={{
              position: 'absolute',
              left: '-64px',
              top: '8px',
              width: '40px',
              textAlign: 'right'
            }}>
              <span style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: isCurrent ? '#00FFD1' : isPast ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.38)',
                textShadow: isCurrent ? '0 0 8px rgba(0,255,209,0.7)' : 'none',
                fontWeight: isCurrent ? '600' : '400'
              }}>
                {timeStr}
              </span>
            </div>

            {/* Dot op tijdlijn */}
            <div style={{
              position: 'absolute',
              left: '-18px',
              top: '12px',
              width: isCurrent ? '10px' : '7px',
              height: isCurrent ? '10px' : '7px',
              borderRadius: '50%',
              background: isCurrent ? '#00FFD1' : isPast ? 'rgba(0,255,209,0.15)' : 'rgba(0,255,209,0.25)',
              boxShadow: isCurrent ? '0 0 10px #00FFD1' : 'none',
              border: '1px solid rgba(0,255,209,0.4)',
              transition: 'all 0.3s'
            }} />

            {/* Content rechts van tijdlijn */}
            <div style={{ minHeight: '40px', paddingTop: '4px', paddingBottom: '4px' }}>
              {hourTasks.length === 0 ? (
                <button
                  onClick={() => onSlotClick(timeStr)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '6px 12px',
                    borderRadius: '12px', fontSize: '12px', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.18)', border: '1px solid transparent',
                    background: 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,209,0.2)'
                    e.currentTarget.style.background = 'rgba(0,255,209,0.04)'
                    e.currentTarget.style.color = 'rgba(0,255,209,0.5)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.18)'
                  }}
                >
                  <Plus size={11} /> Taak toevoegen
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {hourTasks.map(task => {
                    const subject = getSubject(task.subject_id)
                    return (
                      <div
                        key={task.id}
                        className="task-item"
                        onClick={() => onTaskClick(task)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '8px',
                          padding: '8px 12px', borderRadius: '14px', cursor: 'pointer',
                          border: '1px solid rgba(0,255,209,0.1)',
                          background: task.completed ? 'rgba(0,255,209,0.03)' : 'rgba(255,255,255,0.03)'
                        }}
                      >
                        <button
                          onClick={e => { e.stopPropagation(); onToggleTask(task) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: '1px',
                            color: task.completed ? '#00FFD1' : 'rgba(255,255,255,0.3)'
                          }}
                        >
                          {task.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Tijd + titel op aparte regels — geen overlap */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '10px', fontFamily: 'monospace', flexShrink: 0,
                              color: 'rgba(0,255,209,0.5)',
                              background: 'rgba(0,255,209,0.08)',
                              padding: '1px 6px', borderRadius: '6px'
                            }}>
                              {task.time}
                            </span>
                            <span style={{
                              fontSize: '13px', fontWeight: '500',
                              color: task.completed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {task.title}
                            </span>
                          </div>

                          {task.description && (
                            <p style={{
                              fontSize: '11px', marginTop: '2px',
                              color: 'rgba(255,255,255,0.35)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {task.description}
                            </p>
                          )}

                          {subject && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                              <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: subject.color || '#00FFD1', flexShrink: 0
                              }} />
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                                {subject.name}
                              </span>
                              {subject.url && (
                                <a
                                  href={subject.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: '#00FFD1', display: 'flex', alignItems: 'center' }}
                                  title="Open online boek"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <button
                    onClick={() => onSlotClick(timeStr)}
                    style={{
                      textAlign: 'left', padding: '4px 12px', borderRadius: '10px',
                      fontSize: '11px', cursor: 'pointer', color: 'rgba(0,255,209,0.35)',
                      border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Plus size={10} /> Meer toevoegen
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