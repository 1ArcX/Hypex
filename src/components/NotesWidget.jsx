import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { StickyNote, Plus, FolderPlus, ChevronLeft, Trash2, Check, Loader, Search, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { IconButton, Pill, EmptyState } from './ui'

/*
  Voer dit SQL uit in Supabase → SQL Editor:

  create table if not exists note_folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    created_at timestamptz default now()
  );
  alter table note_folders enable row level security;
  create policy "Users own folders" on note_folders for all using (auth.uid() = user_id);

  create table if not exists notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    folder_id uuid references note_folders(id) on delete set null,
    title text not null default 'Naamloos',
    content text not null default '',
    updated_at timestamptz default now(),
    created_at timestamptz default now()
  );
  alter table notes enable row level security;
  create policy "Users own notes" on notes for all using (auth.uid() = user_id);
*/

const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function formatRelTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'zojuist'
  if (mins < 60) return `${mins}m geleden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}u geleden`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d geleden`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function formatLongDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Mappen hebben geen kleur in de database (beslissing D5/D6): vaste kleur afgeleid van het map-id.
const FOLDER_COLORS = ['#FACC15', '#FB923C', '#A78BFA', '#34D399', '#60A5FA', '#F472B6', '#2DD4BF', '#F87171']
export function folderColor(id) {
  if (!id) return 'var(--c-text-3)'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FOLDER_COLORS[h % FOLDER_COLORS.length]
}

const SORTS = [
  { id: 'updated', label: 'Laatst bewerkt' },
  { id: 'created', label: 'Nieuwste eerst' },
  { id: 'title',   label: 'Titel A–Z' },
]

export default function NotesWidget({ userId, fullHeight = false, syncTrigger = 0, seamless = false, openNoteId = null, split = false }) {
  const [folders, setFolders]       = useState([])
  const [notes, setNotes]           = useState([])
  const [loaded, setLoaded]         = useState(false)
  const [activeNote, setActiveNote] = useState(null)
  const [filterFolder, setFilterFolder] = useState(null) // null = all
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dbError, setDbError]       = useState(false)
  const [query, setQuery]           = useState('')
  const [sort, setSort]             = useState(() => { try { return localStorage.getItem('notes_sort') || 'updated' } catch { return 'updated' } })
  const saveTimer = useRef(null)
  const activeNoteIdRef = useRef(null)
  const pendingRef = useRef(null) // { noteId, fields } — nog niet opgeslagen wijzigingen

  const fetchFolders = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('note_folders').select('*').eq('user_id', userId).order('created_at')
    if (error) { setDbError(true); return }
    setFolders(data || [])
  }, [userId])

  const fetchNotes = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (error) { setDbError(true); return }
    setNotes(data || [])
    setLoaded(true)
  }, [userId])

  useEffect(() => {
    fetchFolders()
    fetchNotes()
  }, [fetchFolders, fetchNotes])

  // Hersync bij externe trigger (alleen als de editor niet open is)
  useEffect(() => {
    if (syncTrigger === 0 || activeNote) return
    fetchFolders()
    fetchNotes()
  }, [syncTrigger])

  // ── Opslaan: wijzigingen per notitie bundelen, zodat snel wisselen tussen titel/inhoud
  //    of naar een andere notitie geen eerdere wijziging laat vallen ──
  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current)
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    setSaving(true)
    await supabase.from('notes')
      .update({ ...p.fields, updated_at: new Date().toISOString() })
      .eq('id', p.noteId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [])

  useEffect(() => () => { flushSave() }, [flushSave]) // bij unmount niets verliezen

  const createNote = async () => {
    await flushSave()
    const { data } = await supabase.from('notes').insert({
      user_id: userId,
      title: 'Naamloos',
      content: '',
      folder_id: filterFolder || null,
    }).select().single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setActiveNote(data)
      activeNoteIdRef.current = data.id
    }
  }

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setNewFolderMode(false); return }
    const { data } = await supabase.from('note_folders')
      .insert({ user_id: userId, name }).select().single()
    if (data) setFolders(prev => [...prev, data])
    setNewFolderMode(false)
    setNewFolderName('')
  }

  const deleteNote = async (id) => {
    const note = notes.find(n => n.id === id)
    if (!window.confirm(`Notitie "${note?.title || 'Naamloos'}" verwijderen?`)) return
    if (pendingRef.current?.noteId === id) { clearTimeout(saveTimer.current); pendingRef.current = null }
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setActiveNote(null)
    activeNoteIdRef.current = null
  }

  const deleteFolder = async (id) => {
    await supabase.from('note_folders').delete().eq('id', id)
    setFolders(prev => prev.filter(f => f.id !== id))
    if (filterFolder === id) setFilterFolder(null)
  }

  const handleNoteChange = (field, value) => {
    const noteId = activeNoteIdRef.current
    setActiveNote(prev => ({ ...prev, [field]: value }))
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, [field]: value, updated_at: new Date().toISOString() } : n))
    if (pendingRef.current && pendingRef.current.noteId !== noteId) flushSave()
    pendingRef.current = { noteId, fields: { ...(pendingRef.current?.fields || {}), [field]: value } }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushSave, 600)
  }

  const openNote = async (note) => {
    if (activeNoteIdRef.current === note.id) return
    await flushSave()
    setActiveNote(note)
    activeNoteIdRef.current = note.id
  }

  // Direct een notitie openen (bv. vanuit de zoekpalette)
  const openedFromJumpRef = useRef(null)
  useEffect(() => {
    if (!openNoteId || openedFromJumpRef.current === openNoteId) return
    const note = notes.find(n => n.id === openNoteId)
    if (note) { openedFromJumpRef.current = openNoteId; openNote(note) }
  }, [openNoteId, notes])

  const goBack = async () => {
    await flushSave()
    setActiveNote(null)
    activeNoteIdRef.current = null
    fetchNotes()
  }

  const changeSort = (v) => { setSort(v); try { localStorage.setItem('notes_sort', v) } catch {} }

  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = filterFolder ? notes.filter(n => n.folder_id === filterFolder) : notes
    if (q) list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
    const sorted = [...list]
    if (sort === 'title') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nl'))
    else if (sort === 'created') sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    else sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    return sorted
  }, [notes, filterFolder, query, sort])

  const folderOf = (id) => folders.find(f => f.id === id)

  // --- DB tabellen bestaan niet ---
  if (dbError) return (
    <div className="card" style={{ padding: 16, ...(fullHeight ? { height: '100%' } : {}) }}>
      <EmptyState icon={StickyNote} text={<>Notities tabel niet gevonden.<br />Voer het SQL-script uit in Supabase.</>} />
    </div>
  )

  // ─── Detail / editor ─────────────────────────────────────────
  const editor = activeNote && (
    <div className={split ? 'notes-detail glow-bg' : 'card glow-bg'} style={{ '--glow': activeNote?.folder_id ? folderColor(activeNote.folder_id) : 'var(--accent)', ...(split ? {} : { padding: 16, display: 'flex', flexDirection: 'column' }) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        {!split && (
          <button onClick={goBack} className="btn-ghost" style={{ padding: '4px 10px 4px 6px' }}>
            <ChevronLeft size={15} aria-hidden="true" /> Terug
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span aria-live="polite" style={{ display: 'flex', alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' }}>
          {saving && <Loader size={12} aria-label="Opslaan…" style={{ color: 'var(--c-text-3)', animation: 'spin 1s linear infinite' }} />}
          {saved && !saving && <span style={{ fontSize: 11, color: 'var(--c-success)', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={11} aria-hidden="true" />Opgeslagen</span>}
        </span>
        <IconButton icon={Trash2} label="Notitie verwijderen" tone="danger" variant="soft" onClick={() => deleteNote(activeNote.id)} />
      </div>

      <input
        value={activeNote.title}
        onChange={e => handleNoteChange('title', e.target.value)}
        placeholder="Titel..."
        aria-label="Titel"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--c-text)', fontWeight: 700, fontSize: 20, width: '100%',
          marginBottom: 4, flexShrink: 0, fontFamily: 'inherit', letterSpacing: '-0.01em',
        }}
      />
      <p className="t-meta" style={{ margin: '0 0 10px', fontSize: 12 }}>
        Bewerkt {formatLongDate(activeNote.updated_at || activeNote.created_at)}
      </p>

      {/* Map als tag (+ wijzigen) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        {activeNote.folder_id && folderOf(activeNote.folder_id) && (
          <Pill tone={folderColor(activeNote.folder_id)} dot>{folderOf(activeNote.folder_id).name}</Pill>
        )}
        <select
          value={activeNote.folder_id || ''}
          onChange={e => handleNoteChange('folder_id', e.target.value || null)}
          aria-label="Map"
          style={{ fontSize: 11, height: 22, border: '1px solid var(--c-border)', borderRadius: 'var(--r-xs)', color: 'var(--c-text-2)', padding: '0 24px 0 8px', cursor: 'pointer', backgroundPosition: 'right 0.4rem center', backgroundSize: '0.8em' }}
        >
          <option value="">{activeNote.folder_id ? 'Uit map halen' : 'Geen map'}</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <textarea
        value={activeNote.content}
        onChange={e => {
          handleNoteChange('content', e.target.value)
          if (!split) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }
        }}
        onFocus={e => {
          if (!split) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }
        }}
        placeholder="Begin met typen..."
        aria-label="Inhoud"
        className="notes-content"
        style={split ? undefined : { minHeight: 'calc(var(--app-height, 100vh) + 60px)', overflow: 'hidden' }}
      />
    </div>
  )

  // ─── Lijst ────────────────────────────────────────────────────
  const list = (
    <div className={split ? 'notes-list glow-bg' : seamless ? 'flex flex-col' : 'card glow-bg flex flex-col'}
      style={{ '--glow': 'var(--accent)', ...(split ? {} : { ...(seamless ? {} : { padding: 16 }), ...(fullHeight ? { height: '100%' } : {}) }) }}>
      {/* Kop: zoeken + nieuw */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <div className="notes-search">
          <Search size={14} aria-hidden="true" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoek notities…" aria-label="Zoek notities" />
          {query && <button onClick={() => setQuery('')} aria-label="Zoekopdracht wissen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', padding: 0 }}><X size={13} /></button>}
        </div>
        <button onClick={createNote} className="btn-primary" style={{ flexShrink: 0 }}>
          <Plus size={15} aria-hidden="true" /> Nieuw
        </button>
      </div>

      {/* Mappen + sorteren */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        {[{ id: null, name: 'Alles' }, ...folders].map(f => {
          const active = filterFolder === f.id
          return (
            <button key={f.id ?? 'all'} onClick={() => setFilterFolder(f.id)} aria-pressed={active}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 'var(--r-xs)', cursor: 'pointer',
                fontSize: 11, fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? 'var(--accent-border)' : 'var(--c-border)'}`,
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--c-text-2)',
              }}>
              {f.id && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: folderColor(f.id) }} />}
              {f.name}
            </button>
          )
        })}
        <IconButton icon={FolderPlus} label="Nieuwe map" size={24} iconSize={13} onClick={() => { setNewFolderMode(v => !v); setNewFolderName('') }} />
        {filterFolder && (
          <IconButton icon={Trash2} label="Map verwijderen" size={24} iconSize={12} tone="danger"
            onClick={() => {
              if (window.confirm(`Map "${folders.find(f => f.id === filterFolder)?.name}" verwijderen? Notities blijven bewaard.`))
                deleteFolder(filterFolder)
            }} />
        )}
        <select value={sort} onChange={e => changeSort(e.target.value)} aria-label="Sorteren"
          style={{ marginLeft: 'auto', fontSize: 11, height: 24, border: '1px solid var(--c-border)', borderRadius: 'var(--r-xs)', color: 'var(--c-text-2)', padding: '0 24px 0 8px', cursor: 'pointer', backgroundPosition: 'right 0.4rem center', backgroundSize: '0.8em' }}>
          {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {newFolderMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexShrink: 0 }}>
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') setNewFolderMode(false)
            }}
            placeholder="Mapnaam..."
            aria-label="Naam nieuwe map"
            className="glass-input"
            style={{ flex: 1, padding: '6px 10px' }}
          />
          <button onClick={createFolder} className="btn-ghost">OK</button>
        </div>
      )}

      {/* Notitieslijst */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!loaded ? (
          <p className="t-meta" style={{ padding: '16px 4px', margin: 0 }}>Notities laden…</p>
        ) : visibleNotes.length === 0 ? (
          <EmptyState icon={StickyNote} compact
            title={query ? 'Geen resultaten' : 'Geen notities'}
            text={query ? `Niets gevonden voor “${query}”.` : undefined}
            action={!query && <button onClick={createNote} className="btn-ghost"><Plus size={13} aria-hidden="true" /> Nieuwe notitie</button>} />
        ) : visibleNotes.map(note => {
          const active = activeNote?.id === note.id
          return (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              aria-current={active ? 'true' : undefined}
              className={`notes-row${active ? ' is-active' : ''}`}
            >
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: folderColor(note.folder_id), flexShrink: 0, marginTop: 5 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--c-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title || 'Naamloos'}
                  </span>
                  <span className="t-meta tnum" style={{ flexShrink: 0 }}>{formatRelTime(note.updated_at)}</span>
                </span>
                <span className="t-meta" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {note.content ? note.content.replace(/\n/g, ' ').slice(0, 90) : 'Leeg'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (split) return (
    <div className="notes-split" style={fullHeight ? { height: '100%' } : undefined}>
      {list}
      {editor || (
        <div className="notes-detail glow-bg" style={{ '--glow': 'var(--accent)', justifyContent: 'center' }}>
          <EmptyState icon={StickyNote} title="Geen notitie geselecteerd" text="Kies een notitie links of maak een nieuwe."
            action={<button onClick={createNote} className="btn-primary"><Plus size={15} aria-hidden="true" /> Nieuwe notitie</button>} />
        </div>
      )}
    </div>
  )

  return activeNote ? editor : list
}
