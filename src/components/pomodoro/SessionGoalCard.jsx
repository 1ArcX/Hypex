import React, { useEffect, useMemo, useState } from 'react'
import { Crosshair, Check, Plus, X, ListTodo, ChevronDown } from 'lucide-react'
import { isOverdue, isUrgent, isToday } from '../../utils/taskStatus'
import { isDoneToday, todayISO } from '../../utils/recurrence'

const PRESETS = ['Concentreren', 'Taak afronden', 'Samenvatting maken', 'Overig']

// Afgerond volgens Taken: routines zijn "klaar" als ze vandaag zijn afgevinkt
function taskDone(t, today) {
  if (!t) return false
  return t.recurrence ? isDoneToday(t, today) : !!t.completed
}

// Open taken, meest relevante eerst: urgent → te laat → vandaag → rest met datum → zonder datum
function rankTasks(tasks, today) {
  const score = t => isUrgent(t) ? 0 : isOverdue(t, today) ? 1 : isToday(t, today) ? 2 : t.date ? 3 : 4
  return tasks
    .filter(t => !taskDone(t, today))
    .sort((a, b) => score(a) - score(b) || (a.date || '9999').localeCompare(b.date || '9999'))
}

function Box({ checked, round }) {
  return (
    <span className={`pomo-check${checked ? ' is-on' : ''}${round ? ' is-round' : ''}`} aria-hidden="true">
      {checked && <Check size={11} strokeWidth={3} />}
    </span>
  )
}

function TaskPicker({ tasks, exclude = [], onPick, onClose }) {
  const [q, setQ] = useState('')
  const list = tasks.filter(t => !exclude.includes(t.id) && (!q || t.title?.toLowerCase().includes(q.toLowerCase()))).slice(0, 8)
  return (
    <div className="pomo-picker">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Zoek taak…" aria-label="Zoek taak" />
        <button type="button" className="pomo-icon-btn" onClick={onClose} aria-label="Sluiten"><X size={14} /></button>
      </div>
      <div className="pomo-picker-list">
        {list.length === 0 && <p className="t-meta" style={{ margin: '6px 2px' }}>Geen open taken</p>}
        {list.map(t => (
          <button key={t.id} type="button" className="pomo-picker-row" onClick={() => onPick(t)}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * "Sessie doel": één doel (preset of taak) óf een checklist.
 * Taak-items zijn gekoppeld aan Taken: afvinken hier rondt de taak af, en een taak
 * die elders is afgerond staat hier ook afgevinkt.
 */
export default function SessionGoalCard({ goal, checklist, goalApi, tasks = [], onToggleTask }) {
  const [tab, setTab] = useState(() => (checklist?.length && !goal ? 'check' : 'goal'))
  const [picker, setPicker] = useState(null) // 'goal' | 'check' | null
  const [draft, setDraft] = useState('')
  const today = todayISO()

  const byId = useMemo(() => Object.fromEntries(tasks.map(t => [String(t.id), t])), [tasks])
  const openTasks = useMemo(() => rankTasks(tasks, today), [tasks, today])
  const isChecked = c => c.done || (c.taskId != null && taskDone(byId[String(c.taskId)], today))

  // Taak elders afgerond → checklist-item ook als klaar markeren (telt mee in de sessie-log)
  useEffect(() => {
    for (const c of checklist) {
      if (!c.done && c.taskId != null && taskDone(byId[String(c.taskId)], today)) goalApi.setCheck(c.id, true)
    }
  }, [byId])

  const pickGoalTask = (t) => {
    goalApi.setGoal({ kind: 'task', value: t.title, taskId: t.id })
    goalApi.setTask(t.title)
    setPicker(null)
  }

  const toggleItem = (c) => {
    const task = c.taskId != null ? byId[String(c.taskId)] : null
    const next = !isChecked(c)
    goalApi.setCheck(c.id, next)
    if (task && taskDone(task, today) !== next) onToggleTask?.(task)
  }

  const addDraft = (e) => {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    goalApi.addCheck({ label })
    setDraft('')
  }

  const doneCount = checklist.filter(isChecked).length
  const goalTask = goal?.kind === 'task' ? byId[String(goal.taskId)] : null

  return (
    <div className="card pomo-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Crosshair size={15} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <h3 className="t-card" style={{ margin: 0, flex: 1 }}>Sessie doel</h3>
        <div className="pomo-seg" role="tablist" aria-label="Doel of checklist">
          <button type="button" role="tab" aria-selected={tab === 'goal'} className={tab === 'goal' ? 'is-active' : ''} onClick={() => setTab('goal')}>Doel</button>
          <button type="button" role="tab" aria-selected={tab === 'check'} className={tab === 'check' ? 'is-active' : ''} onClick={() => setTab('check')}>
            Checklist{checklist.length > 0 && <span className="tnum" style={{ marginLeft: 4, opacity: 0.7 }}>{doneCount}/{checklist.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'goal' ? (
        <div className="pomo-goal-list">
          {PRESETS.map(p => {
            const active = goal?.kind === 'preset' && goal.value === p
            return (
              <button key={p} type="button" className="pomo-goal-row" aria-pressed={active}
                onClick={() => goalApi.setGoal(active ? null : { kind: 'preset', value: p })}>
                <Box checked={active} round />
                <span className="pomo-goal-label">{p}</span>
              </button>
            )
          })}
          {goal?.kind === 'task' && (
            <div className="pomo-goal-row is-task">
              <Box checked round />
              <span className="pomo-goal-label" style={{ textDecoration: taskDone(goalTask, today) ? 'line-through' : 'none' }}>
                {goal.value}
              </span>
              {goalTask && !taskDone(goalTask, today) && (
                <button type="button" className="pomo-link" onClick={() => onToggleTask?.(goalTask)}>Afronden</button>
              )}
              <button type="button" className="pomo-icon-btn" onClick={() => goalApi.setGoal(null)} aria-label="Doel wissen"><X size={13} /></button>
            </div>
          )}
          {picker === 'goal' ? (
            <TaskPicker tasks={openTasks} onPick={pickGoalTask} onClose={() => setPicker(null)} />
          ) : (
            <button type="button" className="pomo-add" onClick={() => setPicker('goal')}>
              <ListTodo size={14} aria-hidden="true" /> Kies een taak als doel <ChevronDown size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="pomo-goal-list">
          {checklist.length === 0 && <p className="t-meta" style={{ margin: '2px 0 6px' }}>Voeg taken of eigen punten toe voor deze sessie.</p>}
          {checklist.map(c => {
            const checked = isChecked(c)
            return (
              <div key={c.id} className="pomo-goal-row">
                <button type="button" onClick={() => toggleItem(c)} aria-pressed={checked} className="pomo-goal-hit"
                  aria-label={`${c.label} ${checked ? 'niet afgerond' : 'afgerond'} markeren`}>
                  <Box checked={checked} />
                  <span className="pomo-goal-label" style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>{c.label}</span>
                  {c.taskId != null && <ListTodo size={12} aria-label="Gekoppeld aan Taken" style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />}
                </button>
                <button type="button" className="pomo-icon-btn pomo-remove" onClick={() => goalApi.removeCheck(c.id)} aria-label={`${c.label} verwijderen`}><X size={13} /></button>
              </div>
            )
          })}
          {picker === 'check' ? (
            <TaskPicker tasks={openTasks} exclude={checklist.map(c => c.taskId)}
              onPick={t => { goalApi.addCheck({ label: t.title, taskId: t.id }) }} onClose={() => setPicker(null)} />
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <form onSubmit={addDraft} style={{ flex: 1, display: 'flex' }}>
                <input className="pomo-add-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Eigen punt…" aria-label="Eigen checklist-punt" />
              </form>
              <button type="button" className="pomo-add" style={{ marginTop: 0 }} onClick={() => setPicker('check')}>
                <Plus size={14} aria-hidden="true" /> Taak
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
