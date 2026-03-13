import React, { useState, useEffect, useCallback, useRef } from 'react'
import { StickyNote, Plus, FolderPlus, ChevronLeft, Trash2, Check, Loader } from 'lucide-react'
import { supabase } from '../supabaseClient'

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

const btnBase = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

function formatDate(iso) {
  const d = new Date(iso)
  const months = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export default function NotesWidget({ userId, fullHeight = false }) {
  const [folders, setFolders]       = useState([])
  const [notes, setNotes]           = useState([])
  const [activeNote, setActiveNote] = useState(null)
  const [filterFolder, setFilterFolder] = useState(null) // null = all
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dbError, setDbError]       = useState(false)
  const saveTimer = useRef(null)
  const activeNoteIdRef = useRef(null)

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
  }, [userId])

  useEffect(() => {
    fetchFolders()
    fetchNotes()
  }, [fetchFolders, fetchNotes])

  const createNote = async () => {
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
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, [field]: value } : n))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('notes')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', noteId)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 600)
  }

  const openNote = (note) => {
    setActiveNote(note)
    activeNoteIdRef.current = note.id
  }

  const goBack = () => {
    setActiveNote(null)
    activeNoteIdRef.current = null
    fetchNotes()
  }

  const filteredNotes = filterFolder
    ? notes.filter(n => n.folder_id === filterFolder)
    : notes

  // --- DB tabellen bestaan niet ---
  if (dbError) return (
    <div className="glass-card p-4 text-center" style={fullHeight ? { height: '100%' } : {}}>
      <StickyNote size={20} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 8px' }} />
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
        Notities tabel niet gevonden.<br />Voer het SQL-script uit in Supabase.
      </p>
    </div>
  )

  // ─── Editor view ─────────────────────────────────────────────
  if (activeNote) return (
    <div className="glass-card p-4 flex flex-col" style={fullHeight ? { height: '100%' } : { minHeight: 220 }}>
      {/* Editor header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <button onClick={goBack} style={{ ...btnBase, color: 'rgba(255,255,255,0.45)', gap: 3 }}>
          <ChevronLeft size={15} />
          <span style={{ fontSize: 11 }}>Terug</span>
        </button>
        <div style={{ flex: 1 }} />
        {saving && <Loader size={11} style={{ color: 'rgba(255,255,255,0.25)', animation: 'spin 1s linear infinite' }} />}
        {saved && !saving && <span style={{ fontSize: 9, color: '#1DB954', display: 'flex', alignItems: 'center', gap: 3 }}><Check size={10} />Opgeslagen</span>}
        {/* Folder toewijzen */}
        <select
          value={activeNote.folder_id || ''}
          onChange={e => handleNoteChange('folder_id', e.target.value || null)}
          style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.4)', padding: '2px 6px', cursor: 'pointer' }}
        >
          <option value="">Geen map</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => deleteNote(activeNote.id)} style={{ ...btnBase, color: 'rgba(255,80,80,0.5)', padding: '0 2px' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Titel */}
      <input
        value={activeNote.title}
        onChange={e => handleNoteChange('title', e.target.value)}
        placeholder="Titel..."
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: 'white', fontWeight: 600, fontSize: 15, width: '100%',
          marginBottom: 6, flexShrink: 0, fontFamily: 'inherit',
        }}
      />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 8, flexShrink: 0 }} />

      {/* Inhoud */}
      <textarea
        value={activeNote.content}
        onChange={e => handleNoteChange('content', e.target.value)}
        placeholder="Begin met typen..."
        className="flex-1 resize-none"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontSize: 13,
          fontFamily: 'inherit', minHeight: fullHeight ? 'unset' : 120,
        }}
      />
    </div>
  )

  // ─── List view ────────────────────────────────────────────────
  return (
    <div className="glass-card p-4 flex flex-col" style={fullHeight ? { height: '100%' } : {}}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <StickyNote size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Notities</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setNewFolderMode(v => !v); setNewFolderName('') }}
          style={{ ...btnBase, color: 'rgba(255,255,255,0.3)', marginRight: 4 }}
          title="Nieuwe map"
        >
          <FolderPlus size={14} />
        </button>
        <button onClick={createNote} style={{ ...btnBase, color: 'var(--accent)' }} title="Nieuwe notitie">
          <Plus size={17} />
        </button>
      </div>

      {/* Nieuwe map input */}
      {newFolderMode && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexShrink: 0 }}>
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') setNewFolderMode(false)
            }}
            placeholder="Mapnaam..."
            style={{
              flex: 1, fontSize: 12, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
              padding: '5px 8px', color: 'white', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={createFolder} style={{
            fontSize: 11, padding: '5px 10px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer',
          }}>OK</button>
        </div>
      )}

      {/* Folder filter pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
        {[{ id: null, name: 'Alles' }, ...folders].map(f => (
          <div key={f.id ?? 'all'} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setFilterFolder(f.id)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 12, cursor: 'pointer',
                border: '1px solid',
                borderColor: filterFolder === f.id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(255,255,255,0.1)',
                background: filterFolder === f.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                color: filterFolder === f.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {f.name}
            </button>
            {f.id && (
              <button
                onClick={() => deleteFolder(f.id)}
                style={{ ...btnBase, color: 'rgba(255,255,255,0.2)', marginLeft: 1, padding: '0 2px', fontSize: 11, lineHeight: 1 }}
                title="Map verwijderen"
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* Notitieslijst */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>Geen notities</p>
            <button onClick={createNote} style={{
              ...btnBase, display: 'inline-flex', gap: 4,
              fontSize: 11, color: 'var(--accent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              borderRadius: 8, padding: '6px 12px',
            }}>
              <Plus size={12} /> Nieuwe notitie
            </button>
          </div>
        ) : (
          filteredNotes.map((note, i) => (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '7px 0', textAlign: 'left', gap: 8,
                borderBottom: i < filteredNotes.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title || 'Naamloos'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {note.content ? note.content.replace(/\n/g, ' ').slice(0, 55) : 'Leeg'}
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
                {formatDate(note.updated_at)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
