import { create } from 'zustand'
import { supabase } from '../../supabaseClient'
import type { Course, CourseDate, FocusTab, GradePart, Session, SessionInput, ThemePref, Topic } from '../types'

// Eén store voor de hele Focus-tab: vakken, datums, onderwerpen, cijferonderdelen en sessies
// (laatste 400 dagen). Mutaties gaan direct naar Supabase en worden lokaal meteen toegepast.

const HISTORY_DAYS = 400
const SESSION_COLS = 'id, completed_at, started_at, duration_minutes, course_id, topic_id, kind, rating, note, timer_kind, task_id'
const LS_THEME = 'focus_theme'
const LS_TAB = 'focus_tab'

const readLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* privé-venster */ } }

// Ontbrekende tabel/kolom = migratie nog niet gedraaid
const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(e.code || '') || /does not exist|could not find/i.test(e.message || ''))

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

interface FocusState {
  userId: string | null
  loaded: boolean
  needsMigration: boolean
  courses: Course[]
  dates: CourseDate[]
  topics: Topic[]
  gradeParts: GradePart[]
  sessions: Session[]

  tab: FocusTab
  setTab: (t: FocusTab) => void
  theme: ThemePref
  setTheme: (t: ThemePref) => void

  load: (userId: string, force?: boolean) => Promise<void>

  saveCourse: (c: Partial<Course> & { name: string }) => Promise<Course | null>
  deleteCourse: (id: string) => Promise<void>
  saveDate: (d: Partial<CourseDate> & { course_id: string; title: string; date: string }) => Promise<CourseDate | null>
  deleteDate: (id: string) => Promise<void>
  saveTopic: (t: Partial<Topic> & { course_id: string; name: string }) => Promise<Topic | null>
  deleteTopic: (id: string) => Promise<void>
  saveGradePart: (p: Partial<GradePart> & { course_id: string; name: string }) => Promise<GradePart | null>
  deleteGradePart: (id: string) => Promise<void>

  addSession: (s: SessionInput) => Promise<Session | null>
  updateSession: (id: string, patch: Partial<Session>) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  /** Sessie die elders (timer-engine) al is opgeslagen, lokaal tonen */
  pushSession: (s: Session) => void
}

let loading: Promise<void> | null = null

export const useFocusStore = create<FocusState>((set, get) => {
  const upsertLocal = <K extends 'courses' | 'dates' | 'topics' | 'gradeParts'>(key: K, row: FocusState[K][number]) =>
    set(s => {
      const list = s[key] as { id: string }[]
      const next = list.some(x => x.id === row.id) ? list.map(x => (x.id === row.id ? row : x)) : [...list, row]
      return { [key]: next } as Partial<FocusState>
    })

  async function save<T extends { id?: string }>(table: string, key: 'courses' | 'dates' | 'topics' | 'gradeParts', row: T) {
    const userId = get().userId
    if (!userId) return null
    const { id, ...rest } = row
    const q = id
      ? supabase.from(table).update(rest).eq('id', id).select().single()
      : supabase.from(table).insert({ ...rest, user_id: userId }).select().single()
    const { data, error } = await q
    if (error) { console.error(`[focus] ${table}`, error); if (isMissing(error)) set({ needsMigration: true }); return null }
    upsertLocal(key, data as never)
    return data
  }

  async function remove(table: string, key: 'courses' | 'dates' | 'topics' | 'gradeParts', id: string) {
    set(s => ({ [key]: (s[key] as { id: string }[]).filter(x => x.id !== id) }) as Partial<FocusState>)
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) console.error(`[focus] ${table}`, error)
  }

  return {
    userId: null,
    loaded: false,
    needsMigration: false,
    courses: [],
    dates: [],
    topics: [],
    gradeParts: [],
    sessions: [],

    tab: (readLS(LS_TAB) as FocusTab) || 'home',
    setTab: (tab) => { writeLS(LS_TAB, tab); set({ tab }) },
    theme: (readLS(LS_THEME) as ThemePref) || 'dark',
    setTheme: (theme) => { writeLS(LS_THEME, theme); set({ theme }) },

    load: async (userId, force = false) => {
      if (!force && get().userId === userId && get().loaded) return
      if (loading) return loading
      loading = (async () => {
        const from = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString()
        let needsMigration = false

        const fetchSessions = async (cols: string) => {
          const rows: Session[] = []
          for (let page = 0; page < 20; page++) {
            const { data, error } = await supabase.from('pomodoro_sessions').select(cols)
              .eq('user_id', userId).eq('mode', 'work').gte('completed_at', from)
              .order('completed_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
            if (error) return { rows, error }
            rows.push(...((data || []) as unknown as Session[]))
            if (!data || data.length < 1000) break
          }
          return { rows, error: null }
        }
        let res = await fetchSessions(SESSION_COLS)
        if (res.error && isMissing(res.error)) {
          needsMigration = true
          res = await fetchSessions('id, completed_at, duration_minutes')
        }
        const blank = { started_at: null, course_id: null, topic_id: null, kind: null, rating: null, note: null, timer_kind: null, task_id: null }
        const sessions = res.rows.map(r => ({ ...blank, ...(r as Partial<Session>) }) as Session)

        const table = async <T,>(name: string) => {
          const { data, error } = await supabase.from(name).select('*').eq('user_id', userId)
          if (error) { if (isMissing(error)) needsMigration = true; else console.error(`[focus] ${name}`, error); return [] as T[] }
          return (data || []) as T[]
        }
        const [courses, dates, topics, gradeParts] = await Promise.all([
          table<Course>('focus_courses'), table<CourseDate>('focus_course_dates'),
          table<Topic>('focus_topics'), table<GradePart>('focus_grade_parts'),
        ])
        set({
          userId, loaded: true, needsMigration, sessions,
          courses: courses.sort(bySort), dates: dates.sort((a, b) => a.date.localeCompare(b.date)),
          topics: topics.sort(bySort), gradeParts: gradeParts.sort(bySort),
        })
      })().finally(() => { loading = null })
      return loading
    },

    saveCourse: (c) => save('focus_courses', 'courses', c) as Promise<Course | null>,
    deleteCourse: async (id) => {
      set(s => ({
        dates: s.dates.filter(d => d.course_id !== id), topics: s.topics.filter(t => t.course_id !== id),
        gradeParts: s.gradeParts.filter(p => p.course_id !== id),
        sessions: s.sessions.map(x => (x.course_id === id ? { ...x, course_id: null, topic_id: null } : x)),
      }))
      await remove('focus_courses', 'courses', id)
    },
    saveDate: async (d) => {
      const row = await save('focus_course_dates', 'dates', d) as CourseDate | null
      set(s => ({ dates: [...s.dates].sort((a, b) => a.date.localeCompare(b.date)) }))
      return row
    },
    deleteDate: (id) => remove('focus_course_dates', 'dates', id),
    saveTopic: (t) => save('focus_topics', 'topics', t) as Promise<Topic | null>,
    deleteTopic: (id) => remove('focus_topics', 'topics', id),
    saveGradePart: (p) => save('focus_grade_parts', 'gradeParts', p) as Promise<GradePart | null>,
    deleteGradePart: (id) => remove('focus_grade_parts', 'gradeParts', id),

    addSession: async (s) => {
      const userId = get().userId
      if (!userId) return null
      const { data, error } = await supabase.from('pomodoro_sessions')
        .insert({ ...s, user_id: userId, mode: 'work' }).select(SESSION_COLS).single()
      if (error) { console.error('[focus] sessie', error); return null }
      get().pushSession(data as unknown as Session)
      return data as unknown as Session
    },
    updateSession: async (id, patch) => {
      set(s => ({ sessions: s.sessions.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
      const { error } = await supabase.from('pomodoro_sessions').update(patch).eq('id', id)
      if (error) console.error('[focus] sessie bijwerken', error)
    },
    deleteSession: async (id) => {
      set(s => ({ sessions: s.sessions.filter(x => x.id !== id) }))
      const { error } = await supabase.from('pomodoro_sessions').delete().eq('id', id)
      if (error) console.error('[focus] sessie verwijderen', error)
    },
    pushSession: (row) => set(s => ({
      sessions: [row, ...s.sessions.filter(x => x.id !== row.id)].sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    })),
  }
})

// Handige selectors
export const courseById = (courses: Course[], id: string | null) => (id ? courses.find(c => c.id === id) || null : null)
