import { create } from 'zustand'
import { supabase } from '../../supabaseClient'
import type { Goal, Recap, RecapInput, RecapKind, RecapTab } from '../types'

// Dag- en weekrecaps (tabel `recaps`, migratie add_recap.sql). Klein genoeg om alles in één keer
// te laden; opslaan is een upsert op (user_id, kind, day) en wordt lokaal meteen toegepast.

const LS_TAB = 'recap_tab'
const readLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* privé-venster */ } }

// Ontbrekende tabel = migratie nog niet gedraaid
const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e.code || '') || /does not exist|could not find/i.test(e.message || ''))

const BASE_COLS = 'id, kind, day, energy, focus, mood, went_well, improve, highlight, goals, updated_at'
const NOTE_COLS = `${BASE_COLS}, note_next`
const normalize = (r: Recap): Recap => ({ ...r, note_next: r.note_next ?? null, goals: Array.isArray(r.goals) ? r.goals : [] })

export const recapKey = (kind: RecapKind, day: string) => `${kind}:${day}`

interface RecapState {
  userId: string | null
  loaded: boolean
  needsMigration: boolean
  /** Kolom note_next ontbreekt nog (add_recap_note.sql niet gedraaid) */
  noteMissing: boolean
  recaps: Recap[]
  /** kind:day → recap */
  byKey: Record<string, Recap>

  tab: RecapTab
  setTab: (t: RecapTab) => void

  load: (userId: string, force?: boolean) => Promise<void>
  save: (input: RecapInput) => Promise<Recap | null>
  setGoals: (recap: Recap, goals: Goal[]) => Promise<void>
}

const index = (recaps: Recap[]) => Object.fromEntries(recaps.map(r => [recapKey(r.kind, r.day), r]))
const sorted = (recaps: Recap[]) => [...recaps].sort((a, b) => b.day.localeCompare(a.day))

let loading: Promise<void> | null = null

export const useRecapStore = create<RecapState>((set, get) => {
  const putLocal = (row: Recap) => set(s => {
    const recaps = sorted([...s.recaps.filter(r => !(r.kind === row.kind && r.day === row.day)), row])
    return { recaps, byKey: index(recaps) }
  })

  return {
    userId: null,
    loaded: false,
    needsMigration: false,
    noteMissing: false,
    recaps: [],
    byKey: {},

    tab: (readLS(LS_TAB) as RecapTab) || 'today',
    setTab: (tab) => { writeLS(LS_TAB, tab); set({ tab }) },

    load: async (userId, force = false) => {
      if (!force && get().userId === userId && get().loaded) return
      if (loading) return loading
      loading = (async () => {
        const fetchRecaps = (cols: string) => supabase.from('recaps').select(cols)
          .eq('user_id', userId).order('day', { ascending: false }).limit(2000)
        let noteMissing = false
        let { data, error } = await fetchRecaps(NOTE_COLS)
        // Alleen de nieuwe kolom ontbreekt → recaps gewoon laden, bericht-veld tijdelijk uit
        if (error && error.code === '42703') {
          noteMissing = true
          ;({ data, error } = await fetchRecaps(BASE_COLS))
        }
        if (error) {
          if (!isMissing(error)) console.error('[recap]', error)
          set({ userId, loaded: true, needsMigration: isMissing(error), recaps: [], byKey: {} })
          return
        }
        const recaps = ((data || []) as unknown as Recap[]).map(normalize)
        set({ userId, loaded: true, needsMigration: false, noteMissing, recaps, byKey: index(recaps) })
      })().finally(() => { loading = null })
      return loading
    },

    save: async (input) => {
      const userId = get().userId
      if (!userId) return null
      const prev = get().byKey[recapKey(input.kind, input.day)]
      const updated_at = new Date().toISOString()
      putLocal({ ...input, id: prev?.id || `tmp-${input.kind}-${input.day}`, updated_at })
      const noteMissing = get().noteMissing
      const { note_next, ...rest } = input
      const { data, error } = await supabase.from('recaps')
        .upsert({ ...rest, ...(noteMissing ? null : { note_next }), user_id: userId, updated_at }, { onConflict: 'user_id,kind,day' })
        .select(noteMissing ? BASE_COLS : NOTE_COLS).single()
      if (error) {
        console.error('[recap] opslaan', error)
        if (isMissing(error)) set({ needsMigration: true })
        if (prev) putLocal(prev)
        else set(s => { const recaps = s.recaps.filter(r => !(r.kind === input.kind && r.day === input.day)); return { recaps, byKey: index(recaps) } })
        return null
      }
      const row = normalize(data as unknown as Recap)
      putLocal(row)
      window.dispatchEvent(new Event('recapsChanged'))
      return row
    },

    setGoals: async (recap, goals) => {
      putLocal({ ...recap, goals })
      const { error } = await supabase.from('recaps').update({ goals, updated_at: new Date().toISOString() }).eq('id', recap.id)
      if (error) { console.error('[recap] doelen', error); putLocal(recap) }
    },
  }
})
