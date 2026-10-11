import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { todayISO } from './recurrence'

// Logboek van afgeronde taken per dag (tabel task_completions, migratie add_task_completions.sql).
// App schrijft bij afvinken / ongedaan maken; Taken → "Gedaan" leest het voor voortgang en terugzetten.

const EVT = 'taskCompletionsChanged'
const notify = () => window.dispatchEvent(new Event(EVT))
const missingTable = (error) => !!error && (error.code === '42P01' || error.code === 'PGRST205' || /task_completions/.test(error.message || ''))

/** Taak afgerond op `day` (standaard vandaag). `plannedDate` = datum waar hij stond. */
export async function logCompletion(task, { day = todayISO(), plannedDate = task.date || null } = {}) {
  const { error } = await supabase.from('task_completions').insert({
    task_id: task.id, title: task.title || 'Taak', type_id: task.type_id || null,
    recurring: !!task.recurrence, day, planned_date: task.recurrence ? null : plannedDate,
  })
  if (error && !missingTable(error)) console.error(error)
  notify()
}

/** Afvinken ongedaan: logregel(s) van deze taak weg (op `day`, of de laatste). */
export async function removeCompletion(taskId, { day, id } = {}) {
  let q = supabase.from('task_completions').delete()
  if (id) q = q.eq('id', id)
  else if (day) q = q.eq('task_id', taskId).eq('day', day)
  else {
    const { data } = await supabase.from('task_completions').select('id').eq('task_id', taskId).order('completed_at', { ascending: false }).limit(1)
    if (!data?.length) return
    q = q.eq('id', data[0].id)
  }
  const { error } = await q
  if (error && !missingTable(error)) console.error(error)
  notify()
}

/** Laatst bekende geplande datum van een afgeronde taak (voor terugzetten). */
export async function lastPlannedDate(taskId) {
  const { data } = await supabase.from('task_completions').select('planned_date').eq('task_id', taskId).order('completed_at', { ascending: false }).limit(1)
  return data?.[0]?.planned_date
}

/** Afgeronde taken van de laatste `days` dagen, nieuwste eerst. */
export function useCompletions(userId, days = 35) {
  const [state, setState] = useState({ rows: [], loading: true, needsMigration: false })
  const load = useCallback(async () => {
    if (!userId) return
    const from = new Date(); from.setDate(from.getDate() - days + 1)
    const fromISO = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`
    const { data, error } = await supabase.from('task_completions').select('*')
      .eq('user_id', userId).gte('day', fromISO).order('day', { ascending: false }).order('completed_at', { ascending: false }).limit(2000)
    if (error) { setState({ rows: [], loading: false, needsMigration: missingTable(error) }); if (!missingTable(error)) console.error(error); return }
    setState({ rows: data || [], loading: false, needsMigration: false })
  }, [userId, days])
  useEffect(() => {
    load()
    window.addEventListener(EVT, load)
    window.addEventListener('refreshTasks', load)
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('refreshTasks', load) }
  }, [load])
  return { ...state, reload: load }
}
