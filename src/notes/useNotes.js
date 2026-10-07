import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// Data voor de Notities-app: mappen + notities, optimistisch bijwerken, typen gebundeld opslaan.
// Vastzetten / afvinken / afvinkbare mappen vragen de migratie add_notes_apple.sql;
// zonder die kolommen werkt de rest gewoon en is `needsMigration` true.

export function useNotes(userId, syncTrigger = 0) {
  const [folders, setFolders] = useState([])
  const [notes, setNotes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved
  const pending = useRef(new Map()) // noteId → velden die nog weg moeten
  const timer = useRef(null)
  const savedTimer = useRef(null)

  const load = useCallback(async () => {
    if (!userId) return
    const [f, n, probe] = await Promise.all([
      supabase.from('note_folders').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('notes').select('id,pinned,done_at').limit(1),
    ])
    if (f.error || n.error) { setDbError(true); setLoaded(true); return }
    setNeedsMigration(!!probe.error)
    setFolders(f.data || [])
    // Lokale, nog niet opgeslagen wijzigingen niet overschrijven
    setNotes((n.data || []).map(row => {
      const p = pending.current.get(row.id)
      return p ? { ...row, ...p } : row
    }))
    setLoaded(true)
  }, [userId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (syncTrigger) load() }, [syncTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!pending.current.size) return
    const batch = [...pending.current.entries()]
    pending.current.clear()
    setSaveState('saving')
    await Promise.all(batch.map(([id, fields]) => supabase.from('notes').update(fields).eq('id', id)))
    setSaveState('saved')
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaveState('idle'), 1500)
  }, [])

  // Niets verliezen bij weggaan / tab sluiten
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', flush)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', flush); flush() }
  }, [flush])

  const patchLocal = (id, fields) => setNotes(prev => prev.map(n => n.id === id ? { ...n, ...fields } : n))

  /** Typen: lokaal meteen, opslaan gebundeld na 600ms stilte. */
  const editNote = useCallback((id, fields) => {
    const stamped = { ...fields, updated_at: new Date().toISOString() }
    patchLocal(id, stamped)
    pending.current.set(id, { ...(pending.current.get(id) || {}), ...stamped })
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 600)
  }, [flush])

  /** Direct opslaan (vastzetten, afvinken, verplaatsen) — wijzigt de bewerkdatum niet. */
  const setNoteNow = useCallback(async (id, fields) => {
    patchLocal(id, fields)
    const { error } = await supabase.from('notes').update(fields).eq('id', id)
    if (error) { load(); return false }
    return true
  }, [load])

  const createNote = useCallback(async (folderId = null) => {
    await flush()
    const { data, error } = await supabase.from('notes')
      .insert({ user_id: userId, title: '', content: '', folder_id: folderId }).select().single()
    if (error || !data) return null
    setNotes(prev => [data, ...prev])
    return data
  }, [userId, flush])

  const deleteNote = useCallback(async (id) => {
    pending.current.delete(id)
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from('notes').delete().eq('id', id)
  }, [])

  /** Ongedaan maken na verwijderen: dezelfde rij (zelfde id) terugzetten. */
  const restoreNote = useCallback(async (note) => {
    setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)])
    const { error } = await supabase.from('notes').insert(note)
    if (error) load()
  }, [load])

  const togglePin = useCallback((note) => setNoteNow(note.id, { pinned: !note.pinned }), [setNoteNow])
  const toggleDone = useCallback((note) => setNoteNow(note.id, { done_at: note.done_at ? null : new Date().toISOString() }), [setNoteNow])
  const moveNote = useCallback((note, folderId) => setNoteNow(note.id, { folder_id: folderId }), [setNoteNow])

  const createFolder = useCallback(async (name) => {
    const { data } = await supabase.from('note_folders').insert({ user_id: userId, name }).select().single()
    if (data) setFolders(prev => [...prev, data])
    return data
  }, [userId])

  const updateFolder = useCallback(async (id, fields) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...fields } : f))
    const { error } = await supabase.from('note_folders').update(fields).eq('id', id)
    if (error) load()
  }, [load])

  const deleteFolder = useCallback(async (id) => {
    setFolders(prev => prev.filter(f => f.id !== id))
    setNotes(prev => prev.map(n => n.folder_id === id ? { ...n, folder_id: null } : n))
    await supabase.from('note_folders').delete().eq('id', id)
  }, [])

  const counts = useMemo(() => {
    const c = { all: notes.length, none: 0 }
    for (const n of notes) { if (n.folder_id) c[n.folder_id] = (c[n.folder_id] || 0) + 1; else c.none++ }
    return c
  }, [notes])

  return {
    folders, notes, loaded, dbError, needsMigration, saveState, counts,
    editNote, setNoteNow, createNote, deleteNote, restoreNote, togglePin, toggleDone, moveNote,
    createFolder, updateFolder, deleteFolder, flush, reload: load,
  }
}
