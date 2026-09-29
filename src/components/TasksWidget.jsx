import React, { useState, useRef, useEffect } from 'react'

function SwipeableRow({ onSwipeRight, onSwipeLeft, children }) {
  const [offset, setOffset] = useState(0)
  const containerRef = useRef(null)
  // Keep callbacks and state in refs so native listeners don't go stale
  const s = useRef({ startX: null, startY: null, isScrolling: null, offset: 0 })
  const cbRef = useRef({ onSwipeRight, onSwipeLeft })
  cbRef.current = { onSwipeRight, onSwipeLeft }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e) => {
      s.current.startX = e.touches[0].clientX
      s.current.startY = e.touches[0].clientY
      s.current.isScrolling = null
    }
    const onTouchMove = (e) => {
      if (s.current.startX === null) return
      const dx = e.touches[0].clientX - s.current.startX
      const dy = e.touches[0].clientY - s.current.startY
      if (s.current.isScrolling === null) s.current.isScrolling = Math.abs(dy) > Math.abs(dx)
      if (s.current.isScrolling) { setOffset(0); return }
      e.preventDefault() // lock scroll during horizontal swipe
      const next = Math.max(-110, Math.min(110, dx))
      s.current.offset = next
      setOffset(next)
    }
    const onTouchEnd = () => {
      if (!s.current.isScrolling) {
        if (s.current.offset > 60) cbRef.current.onSwipeRight()
        else if (s.current.offset < -60) cbRef.current.onSwipeLeft()
      }
      s.current.offset = 0
      setOffset(0)
      s.current.startX = null
      s.current.isScrolling = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const pct = Math.abs(offset) / 110
  const actionBg = offset > 10
    ? `rgba(74,222,128,${Math.min(0.4, (offset - 10) / 60)})`
    : offset < -10
    ? `rgba(255,107,107,${Math.min(0.4, (-offset - 10) / 60)})`
    : 'transparent'
  const icon = offset > 30 ? '✓' : offset < -30 ? '✕' : ''

  return (
    <div ref={containerRef} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: actionBg, transition: 'background 0.08s', display: 'flex', alignItems: 'center', justifyContent: offset > 0 ? 'flex-start' : 'flex-end', padding: '0 16px' }}>
        {icon && <span style={{ fontSize: 14, fontWeight: 700, color: offset > 0 ? '#4ADE80' : '#FF6B6B', opacity: Math.min(1, pct * 2) }}>{icon}</span>}
      </div>
      <div style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
import { Plus, GripVertical, Trash2, CheckCircle2, Circle, X, AlertCircle, Flag, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react'
import TaskRow from './tasks/TaskRow'
import { todayISO } from '../utils/recurrence'
import { isOverdue } from '../utils/taskStatus'

const PRIORITY_DOT = {
  1: '#FF6B6B',
  2: '#FACC15',
  3: 'rgba(255,255,255,0.2)',
}

function todayStr() {
  return todayISO()
}

function timeStrToMins(str) {
  if (!str) return 0
  const [h, m] = (str || '').split(':').map(Number)
  return (h||0)*60 + (m||0)
}

function getTimeStatus(dateStr, startTime, endTime) {
  if (!dateStr) return null
  const pad2 = n => String(n).padStart(2,'0')
  const now = new Date()
  const todayStr2 = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`
  if (dateStr < todayStr2) return { label: 'Te laat', overdue: true }
  if (dateStr > todayStr2) {
    const d = new Date(dateStr + 'T00:00:00')
    const tom = new Date(now); tom.setDate(now.getDate()+1); tom.setHours(0,0,0,0)
    if (dateStr === `${tom.getFullYear()}-${pad2(tom.getMonth()+1)}-${pad2(tom.getDate())}`) return { label: 'Morgen', overdue: false }
    return { label: d.toLocaleDateString('nl-NL', { day:'numeric', month:'short' }), overdue: false }
  }
  // today
  if (!startTime && !endTime) return { label: 'Vandaag', overdue: false }
  const nowMins = now.getHours()*60 + now.getMinutes()
  const startMins = timeStrToMins(startTime)
  const endMins = timeStrToMins(endTime)
  if (endMins && nowMins > endMins) return { label: 'Te laat', overdue: true }
  if (startMins && endMins && nowMins >= startMins && nowMins <= endMins) return { label: 'Nu', overdue: false, active: true }
  return { label: 'Vandaag', overdue: false }
}

export default function TasksWidget({ tasks, subjects, onAdd, onDelete, onToggle, onEdit, onDragStart, onViewDetail, onNew, onMoveToGroup, onReorder, onReorderGroups, groupOrder = [], seamless = false, highlightedIds = new Set(), hideHeader = false }) {
  const [adding, setAdding] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [showCompleted, setShowCompleted] = useState(false)
  // Task drag
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)   // { id: taskId, pos: 'before'|'after' }
  const [dropGroup, setDropGroup] = useState(undefined) // undefined=none, null=no-group, string=group name
  // Group drag
  const [dragGroupName, setDragGroupName] = useState(null)
  const [dropGroupTarget, setDropGroupTarget] = useState(null) // { name, pos: 'before'|'after' }
  const [activeDragType, setActiveDragType] = useState(null) // 'task' | 'group'
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [newTime, setNewTime] = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('10:00')
  const [newSubject, setNewSubject] = useState('')

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    await onAdd({
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      start_time: newTime,
      end_time: newEndTime,
      subject_id: newSubject || null
    })
    setNewTitle('')
    setNewDate(todayStr())
    setNewTime('09:00')
    setNewEndTime('10:00')
    setNewSubject('')
    setAdding(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') setAdding(false)
  }

  const sortFn = (a, b) => {
    // sort_order takes priority when set (user-defined order)
    const sa = a.sort_order ?? Infinity, sb = b.sort_order ?? Infinity
    if (sa !== sb) return sa - sb
    const pa = a.priority ?? 2, pb = b.priority ?? 2
    if (pa !== pb) return pa - pb
    const da = a.due_date || a.date || '9999-99-99'
    const db = b.due_date || b.date || '9999-99-99'
    return da.localeCompare(db)
  }

  const clearDrag = () => { setDragId(null); setDropTarget(null); setDropGroup(undefined); setActiveDragType(null) }
  const clearGroupDrag = () => { setDragGroupName(null); setDropGroupTarget(null); setActiveDragType(null) }

  const startDrag = (e, task) => {
    e.dataTransfer.setData('taskId', String(task.id))
    e.dataTransfer.effectAllowed = 'move'
    setActiveDragType('task')
    requestAnimationFrame(() => setDragId(task.id))
    onDragStart?.(task)
  }

  const overTask = (e, taskId) => {
    if (activeDragType === 'group') return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget(prev => (prev?.id === taskId && prev?.pos === pos ? prev : { id: taskId, pos }))
    setDropGroup(undefined)
  }

  const dropOnTask = (e, taskId) => {
    if (activeDragType === 'group') return
    e.preventDefault()
    const srcId = e.dataTransfer.getData('taskId')
    if (srcId && String(taskId) && srcId !== String(taskId)) {
      onReorder?.(srcId, String(taskId), dropTarget?.pos || 'after')
    }
    clearDrag()
  }

  const startGroupDrag = (e, name) => {
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
    setActiveDragType('group')
    requestAnimationFrame(() => setDragGroupName(name))
  }

  const overGroup = (e, name) => {
    e.preventDefault()
    if (activeDragType === 'task') {
      setDropGroup(name)
      setDropTarget(null)
      return
    }
    if (activeDragType !== 'group') return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropGroupTarget(prev => (prev?.name === name && prev?.pos === pos ? prev : { name, pos }))
  }

  const dropOnGroup = (e, name) => {
    e.preventDefault()
    if (activeDragType === 'group') {
      if (dragGroupName && name && dragGroupName !== name) {
        onReorderGroups?.(dragGroupName, name, dropGroupTarget?.pos || 'after')
      }
      clearGroupDrag()
    } else {
      const id = e.dataTransfer.getData('taskId')
      if (id && onMoveToGroup) onMoveToGroup(id, name)
      clearDrag()
    }
  }

  const incomplete = tasks.filter(t => !t.completed).sort(sortFn)

  // Groepeer: taken met groep apart, taken zonder groep direct
  const groupedSections = (() => {
    const withGroup = {}
    const noGroup = []
    for (const t of incomplete) {
      if (t.group_name) {
        if (!withGroup[t.group_name]) withGroup[t.group_name] = []
        withGroup[t.group_name].push(t)
      } else {
        noGroup.push(t)
      }
    }
    // Sort named groups by groupOrder prop (user-defined order)
    const allGroupNames = Object.keys(withGroup)
    const ordered = groupOrder.length
      ? [...groupOrder.filter(g => allGroupNames.includes(g)), ...allGroupNames.filter(g => !groupOrder.includes(g))]
      : allGroupNames
    const hasGroups = ordered.length > 0
    const sections = []
    if (noGroup.length) sections.push({ name: null, items: noGroup, hasGroups })
    for (const name of ordered) sections.push({ name, items: withGroup[name], hasGroups })
    return sections
  })()

  const complete = tasks.filter(t => t.completed)
    .sort((a, b) => (b.updated_at || '0000').localeCompare(a.updated_at || '0000'))

  return (
    <div className={seamless || hideHeader ? '' : 'card'} style={seamless || hideHeader ? {} : { padding: 16 }}>
      {/* Header */}
      {!hideHeader && <div className="flex items-center justify-between mb-3">
        {!seamless && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckSquare size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="t-card">Taken</span>
        </div>}
        <button
          onClick={() => { if (onNew) { onNew() } else { setAdding(!adding); setNewTitle('') } }}
          style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          {adding && !onNew ? <X size={12} /> : <Plus size={12} />}
          {adding && !onNew ? 'Annuleer' : 'Nieuw'}
        </button>
      </div>}

      {/* Inline aanmaken */}
      {adding && (
        <div style={{ background: 'color-mix(in srgb, var(--accent) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: '12px', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            className="glass-input"
            placeholder="Taaknaam..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: '13px' }}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ color: 'var(--c-text-3)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Datum</label>
              <input
                type="date"
                className="glass-input"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{ fontSize: '12px', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--c-text-3)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Vak</label>
              <select
                className="glass-input"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                style={{ fontSize: '12px', colorScheme: 'dark' }}>
                <option value="">Geen vak</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ color: 'var(--c-text-3)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Starttijd</label>
              <input type="time" className="glass-input" value={newTime}
                onChange={e => setNewTime(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={{ color: 'var(--c-text-3)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Eindtijd</label>
              <input type="time" className="glass-input" value={newEndTime}
                onChange={e => setNewEndTime(e.target.value)} style={{ fontSize: '12px', colorScheme: 'dark' }} />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            style={{ padding: '8px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, opacity: !newTitle.trim() ? 0.4 : 1 }}>
            + Toevoegen
          </button>
        </div>
      )}

      {/* Lege staat */}
      {incomplete.length === 0 && !adding && (
        <p style={{ color: 'var(--c-text-3)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
          Geen open taken in deze selectie.
        </p>
      )}

      {/* Taken lijst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {groupedSections.map(section => (
          <div key={section.name ?? '__none__'}>
            {/* Drop indicator before this group (group drag) */}
            {dropGroupTarget?.name === section.name && dropGroupTarget.pos === 'before' && (
              <div style={{ height: 2, borderRadius: 2, background: 'var(--accent)', margin: '4px 4px 0', opacity: 0.85 }} />
            )}

            {/* Label voor ongegroepeeerde taken als er ook groepen zijn */}
            {section.name === null && section.hasGroups && (
              <div
                onDragOver={e => { e.preventDefault(); setDropGroup(null); setDropTarget(null) }}
                onDragLeave={() => setDropGroup(undefined)}
                onDrop={e => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('taskId')
                  if (id && onMoveToGroup) onMoveToGroup(id, null)
                  clearDrag()
                }}
                style={{
                  fontSize: 12, color: dropGroup === null ? 'var(--accent)' : 'var(--c-text-2)',
                  fontWeight: 700,
                  padding: '4px 4px 6px', display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 6, background: dropGroup === null ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                  transition: 'all 0.15s', marginBottom: 2,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-3)', display: 'inline-block', flexShrink: 0 }} />
                Overige taken
                <span className="tnum" style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--c-text-3)', textTransform: 'none', letterSpacing: 0 }}>
                  {section.items.length} {section.items.length === 1 ? 'taak' : 'taken'}
                </span>
                {dropGroup === null && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>↓</span>}
              </div>
            )}

            {section.name && (() => {
              const isCollapsed = collapsedGroups.has(section.name)
              const isDraggingThis = dragGroupName === section.name
              const isTaskDropTarget = activeDragType === 'task' && dropGroup === section.name
              const totalMins = section.items.reduce((sum, t) => sum + (t.duration_minutes || 0), 0)
              const durLabel = totalMins > 0
                ? (Math.floor(totalMins / 60) > 0
                    ? `${Math.floor(totalMins / 60)}u${totalMins % 60 > 0 ? ` ${totalMins % 60}m` : ''}`
                    : `${totalMins}m`)
                : null
              return (
                <div
                  draggable
                  onDragStart={e => startGroupDrag(e, section.name)}
                  onDragEnd={clearGroupDrag}
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(section.name)) next.delete(section.name)
                    else next.add(section.name)
                    return next
                  })}
                  onDragOver={e => overGroup(e, section.name)}
                  onDragLeave={() => { setDropGroup(undefined); setDropGroupTarget(null) }}
                  onDrop={e => dropOnGroup(e, section.name)}
                  role="button" tabIndex={0} aria-expanded={!isCollapsed}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } }}
                  style={{ fontSize: 12, color: isTaskDropTarget ? 'var(--accent)' : 'var(--c-text-2)', fontWeight: 700, padding: '10px 4px 6px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab', userSelect: 'none', borderRadius: 8, background: isTaskDropTarget ? 'var(--accent-soft)' : 'transparent', transition: 'background 0.15s, color 0.15s, opacity 0.15s', opacity: isDraggingThis ? 0.3 : 1 }}
                >
                  <GripVertical size={12} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--c-text-3)', opacity: 0.5 }} />
                  {isCollapsed
                    ? <ChevronRight size={11} style={{ flexShrink: 0, color: 'var(--c-text-3)' }} />
                    : <ChevronDown size={11} style={{ flexShrink: 0, color: 'var(--c-text-3)' }} />}
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cat-school)', display: 'inline-block', flexShrink: 0 }} />
                  {section.name}
                  {durLabel && (
                    <span style={{ fontWeight: 500, color: 'var(--c-text-3)', marginLeft: 2 }}>
                      · {durLabel}
                    </span>
                  )}
                  <span className="tnum" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--c-text-3)', fontWeight: 500 }}>
                    {section.items.length} {section.items.length === 1 ? 'taak' : 'taken'}
                  </span>
                  {isTaskDropTarget && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>↓</span>}
                </div>
              )
            })()}

            {/* Drop indicator after this group (group drag) */}
            {dropGroupTarget?.name === section.name && dropGroupTarget.pos === 'after' && (
              <div style={{ height: 2, borderRadius: 2, background: 'var(--accent)', margin: '0 4px 4px', opacity: 0.85 }} />
            )}
            {!collapsedGroups.has(section.name) && <div className="task-list">{section.items.map(task => {
              const subject = subjects.find(s => s.id === task.subject_id)
              const isDragging = dragId === task.id
              const isDropBefore = dropTarget?.id === task.id && dropTarget.pos === 'before'
              const isDropAfter  = dropTarget?.id === task.id && dropTarget.pos === 'after'
              const today = todayStr()
              return (
                <React.Fragment key={task.id}>
                {isDropBefore && <div style={{ height: 2, borderRadius: 2, background: 'var(--accent)', margin: '2px 8px', opacity: 0.85 }} />}
                <SwipeableRow onSwipeRight={() => onToggle(task)} onSwipeLeft={() => onDelete(task.id)}>
                  <TaskRow
                    task={task} today={today} subjectName={subject?.name}
                    late={isOverdue(task, today)}
                    grip
                    onToggle={onToggle}
                    onOpen={t => onViewDetail ? onViewDetail(t) : onEdit?.(t)}
                    onDelete={onDelete}
                    className={highlightedIds.has(task.id) ? 'task-flash' : undefined}
                    style={{ opacity: isDragging ? 0.3 : undefined, transform: isDragging ? 'scale(0.98)' : undefined, WebkitTouchCallout: 'none' }}
                    dragProps={{
                      draggable: true,
                      onDragStart: e => startDrag(e, task),
                      onDragEnd: clearDrag,
                      onDragOver: e => overTask(e, task.id),
                      onDrop: e => dropOnTask(e, task.id),
                    }}
                  />
                </SwipeableRow>
                {isDropAfter && <div style={{ height: 2, borderRadius: 2, background: 'var(--accent)', margin: '2px 8px', opacity: 0.85 }} />}
                </React.Fragment>
              )
            })}</div>}
          </div>
        ))}
      </div>

      {/* Afgeronde taken — inklapbaar */}
      {complete.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--c-border)' }}>
          <button
            onClick={() => setShowCompleted(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}
          >
            <CheckCircle2 size={12} aria-hidden="true" style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600 }}>
              Afgerond ({complete.length})
            </span>
            <span aria-hidden="true" style={{ fontSize: 10, color: 'var(--c-text-3)', marginLeft: 'auto' }}>
              {showCompleted ? '▲' : '▼'}
            </span>
          </button>
          {showCompleted && complete.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', opacity: 0.55 }}>
              <button onClick={() => onToggle(task)} aria-label={`Markeer "${task.title}" als niet gedaan`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
              </button>
              <p style={{ flex: 1, fontSize: '12px', color: 'var(--c-text-3)', textDecoration: 'line-through', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title}
              </p>
              <button onClick={() => onDelete(task.id)} aria-label={`Verwijder "${task.title}"`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: '2px', flexShrink: 0 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
