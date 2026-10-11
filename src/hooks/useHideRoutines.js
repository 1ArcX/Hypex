import { useEffect, useState } from 'react'
import { taskCategory } from '../utils/category'

// Agenda: routines verbergen/tonen (per apparaat). Gedeeld tussen de knop in de werkbalk en AgendaPage,
// die de taken filtert voor alle weergaven (week/dag/maand, mobiele dag/lijst/maand).

const KEY = 'agenda_hide_routines'
const EVT = 'hideRoutinesChange'

/** Routine = herhalende taak of een taak van het type "Routine". */
export const isRoutineTask = (t) => !!t?.recurrence || taskCategory(t) === 'routine'

const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

export function useHideRoutines() {
  const [hide, setHide] = useState(read)
  useEffect(() => {
    const on = () => setHide(read())
    window.addEventListener(EVT, on)
    return () => window.removeEventListener(EVT, on)
  }, [])
  const set = (v) => {
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* */ }
    setHide(v)
    window.dispatchEvent(new Event(EVT))
  }
  return [hide, set]
}
