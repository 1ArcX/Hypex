import React, { useState } from 'react'
import { CalendarCheck, Repeat, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { saveTask, deleteTask } from '../utils/itemSave'
import { typeIdOf } from '../utils/category'
import { toISO } from '../utils/recurrence'
import { NxPortal, noteTitle } from './parts'

// Notitie inplannen als taak (tasks.note_id): bv. Boodschappen → zaterdag middag, elke week.
// De taak staat dan in Taken / agenda / dashboard met de voortgang van de afvinklijst.

const DAYPARTS = [['', 'Hele dag'], ['ochtend', 'Ochtend'], ['middag', 'Middag'], ['avond', 'Avond']]
const isoDow = (d) => ((d.getDay() + 6) % 7) + 1 // 1 = ma … 7 = zo

function dayChips() {
  const out = []
  const t = new Date(); t.setHours(12, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const d = new Date(t); d.setDate(t.getDate() + i)
    out.push({ iso: toISO(d), label: i === 0 ? 'Vandaag' : i === 1 ? 'Morgen' : d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' }) })
  }
  return out
}

export function plannedLabel(task) {
  if (!task) return ''
  const d = task.date ? new Date(task.date + 'T12:00:00') : null
  const day = d ? d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Geen datum'
  const dp = task.daypart ? ` · ${task.daypart}` : ''
  return `${task.recurrence ? 'Elke ' + (d ? d.toLocaleDateString('nl-NL', { weekday: 'long' }) : 'week') + ', volgende: ' : ''}${day}${dp}`
}

/** Popover: dag + dagdeel + elke week. `task` = bestaande koppeling (dan verplaatsen). */
export function PlanPopover({ note, task, at, onClose, onResetChecks, onDone }) {
  const days = dayChips()
  const [date, setDate] = useState(task?.date || days[0].iso)
  const [daypart, setDaypart] = useState(task?.daypart || '')
  const [weekly, setWeekly] = useState(!!task?.recurrence)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const save = async () => {
    setBusy(true); setErr(null)
    const d = new Date(date + 'T12:00:00')
    const rec = weekly ? { recurrence: 'weekly', recurrence_days: [isoDow(d)] } : { recurrence: null, recurrence_days: null }
    let res
    if (task) {
      res = await supabase.from('tasks').update({ date, daypart: daypart || null, ...rec, completed: false, updated_at: new Date().toISOString() }).eq('id', task.id)
      if (!res.error) window.dispatchEvent(new Event('refreshTasks'))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      res = await saveTask(user.id, { title: noteTitle(note), date, daypart: daypart || null, ...rec, note_id: note.id, type_id: typeIdOf('persoonlijk') })
    }
    setBusy(false)
    if (res?.error) { setErr(/note_id/.test(res.error.message || '') ? 'Draai eerst add_task_note_link.sql in Supabase.' : 'Inplannen lukte niet.'); return }
    onResetChecks?.() // opnieuw ingepland → lijst weer leeg om af te vinken
    onDone?.()
    onClose()
  }

  return (
    <NxPortal>
      <div className="nx-menu-backdrop" onClick={onClose} />
      <div className="nx-format nx-plan" style={{ position: 'fixed', left: at.x, ...(at.up ? { bottom: window.innerHeight - at.y } : { top: at.y }) }} role="dialog" aria-label="Inplannen">
        <div className="nx-format__title">{task ? 'Verplaats' : 'Plan in als taak'}
          <button type="button" className="nx-icon-btn" style={{ color: 'var(--nx-text-2)', minWidth: 24, minHeight: 24, padding: 2 }} onClick={onClose} aria-label="Sluiten"><X size={16} /></button>
        </div>
        <div className="nx-plan__days">
          {days.map(d => (
            <button key={d.iso} type="button" className={date === d.iso ? 'is-on' : ''} onClick={() => setDate(d.iso)}>{d.label}</button>
          ))}
          <label className={`nx-plan__date${days.some(d => d.iso === date) ? '' : ' is-on'}`}>
            <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Kies datum" />
          </label>
        </div>
        <div className="nx-plan__parts">
          {DAYPARTS.map(([id, label]) => (
            <button key={id || 'all'} type="button" className={daypart === id ? 'is-on' : ''} onClick={() => setDaypart(id)}>{label}</button>
          ))}
        </div>
        <label className="nx-plan__weekly">
          <input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} />
          <Repeat size={14} aria-hidden="true" /> Elke week op deze dag
        </label>
        {err && <p className="nx-plan__err">{err}</p>}
        <button type="button" className="nx-plan__save" onClick={save} disabled={busy}>{busy ? 'Bezig…' : task ? 'Verplaats' : 'Inplannen'}</button>
      </div>
    </NxPortal>
  )
}

/** Strook bovenaan een ingeplande notitie. */
export function PlannedStrip({ task, onMove, onUnplan }) {
  if (!task) return null
  return (
    <div className="nx-planned" contentEditable={false}>
      <CalendarCheck size={15} aria-hidden="true" />
      <span className="nx-planned__text">Gepland: {plannedLabel(task)}</span>
      <button type="button" onClick={onMove}>Verplaats</button>
      <button type="button" onClick={async () => { await deleteTask(task.id); onUnplan?.() }}>Uit planning</button>
    </div>
  )
}

