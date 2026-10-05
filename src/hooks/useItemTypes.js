import { useSyncExternalStore } from 'react'
import { supabase } from '../supabaseClient'
import { BUILTIN_TYPES, setTypes } from '../utils/category'

// Gedeelde store voor de types van de gebruiker (tabel item_types). App laadt ze één keer
// (loadItemTypes); elke component kan useItemTypes() gebruiken zonder props door te geven.
// Zonder migratie (tabel bestaat niet) blijft `available` false en werkt de app met de
// afgeleide standaardcategorieën.

let state = { types: [], available: false, loaded: false }
let userId = null
const listeners = new Set()
const emit = () => listeners.forEach(l => l())
const set = (patch) => {
  state = { ...state, ...patch }
  setTypes(state.types)
  emit()
}

export async function loadItemTypes(uid) {
  userId = uid
  if (!uid) return
  const { data, error } = await supabase.from('item_types').select('*').eq('user_id', uid).order('sort_order')
  if (error) { set({ available: false, loaded: true }); return }
  let rows = data || []
  // Ontbrekende ingebouwde types aanmaken (eerste keer, of na een nieuwe standaard).
  const missing = BUILTIN_TYPES.filter(b => !rows.some(r => r.key === b.key))
  if (missing.length) {
    const base = rows.length
    await supabase.from('item_types').upsert(
      missing.map((b, i) => ({ user_id: uid, key: b.key, name: b.name, color: b.color, sort_order: (base + i) * 10 })),
      { onConflict: 'user_id,key', ignoreDuplicates: true })
    const again = await supabase.from('item_types').select('*').eq('user_id', uid).order('sort_order')
    rows = again.data || rows
  }
  set({ types: rows, available: true, loaded: true })
}

export async function addItemType({ name, color }) {
  if (!userId) return null
  const sort_order = Math.max(0, ...state.types.map(t => t.sort_order ?? 0)) + 10
  const { data, error } = await supabase.from('item_types').insert({ user_id: userId, name, color, sort_order }).select().single()
  if (error) { console.error('Type toevoegen mislukt:', error); return null }
  set({ types: [...state.types, data] })
  return data
}

export async function updateItemType(id, patch) {
  set({ types: state.types.map(t => t.id === id ? { ...t, ...patch } : t) })
  const { error } = await supabase.from('item_types').update(patch).eq('id', id)
  if (error) { console.error('Type bijwerken mislukt:', error); loadItemTypes(userId) }
}

/** Verwijdert een type; taken en agenda-items ervan gaan naar Overig. */
export async function deleteItemType(id) {
  const t = state.types.find(x => x.id === id)
  const overig = state.types.find(x => x.key === 'overig')
  if (!t || t.key === 'overig') return
  if (overig) {
    await Promise.all([
      supabase.from('tasks').update({ type_id: overig.id }).eq('type_id', id),
      supabase.from('calendar_events').update({ type_id: overig.id }).eq('type_id', id),
    ])
  }
  const { error } = await supabase.from('item_types').delete().eq('id', id)
  if (error) { console.error('Type verwijderen mislukt:', error); return }
  set({ types: state.types.filter(x => x.id !== id) })
  window.dispatchEvent(new Event('refreshTasks'))
  window.dispatchEvent(new Event('refreshCalendarEvents'))
}

export async function reorderItemTypes(orderedIds) {
  const types = orderedIds.map((id, i) => ({ ...state.types.find(t => t.id === id), sort_order: i * 10 }))
  set({ types })
  await Promise.all(types.map(t => supabase.from('item_types').update({ sort_order: t.sort_order }).eq('id', t.id)))
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => state

export function useItemTypes() {
  return useSyncExternalStore(subscribe, snapshot)
}
