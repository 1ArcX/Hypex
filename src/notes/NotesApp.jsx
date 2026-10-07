import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Folder, FolderPlus, SquarePen, Search, X, MoreHorizontal, Pencil, Trash2, CheckCircle2, Circle, Pin, PinOff, FolderInput, Inbox, Layers, Plus, GripVertical, SeparatorHorizontal } from 'lucide-react'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useNotes } from './useNotes'
import NoteList from './NoteList'
import NoteEditor from './NoteEditor'
import { Menu, PromptAlert, useLongPress, FloatBar } from './parts'
import { useSortable } from './useSortable'
import { preview } from './noteFormat'
import './notes.css'

// Notities in Apple Notes-stijl.
//  - Telefoon: Mappen → Lijst → Notitie als iOS-stapel (push/pop-animaties, terugvegen vanaf de linkerrand),
//    grote titels die inklappen, eigen onderbalk.
//  - Desktop: Notities op de Mac — mappen | lijst | notitie.
// Mappen: 'all' = Alle notities, 'none' = Notities (zonder map), anders folder-id.

const isEmpty = (n) => n && !(n.title || '').trim() && !(n.content || '').trim()

function useFolderHelpers(folders) {
  return useMemo(() => ({
    label: (key) => key === 'all' ? 'Alle notities' : key === 'none' ? 'Notities' : (folders.find(f => f.id === key)?.name || 'Map'),
    folder: (key) => folders.find(f => f.id === key) || null,
    checkable: (key) => !!folders.find(f => f.id === key)?.checkable,
  }), [folders])
}

function filterNotes(notes, key, query) {
  let list = key === 'all' ? notes : key === 'none' ? notes.filter(n => !n.folder_id) : notes.filter(n => n.folder_id === key)
  const q = query.trim().toLowerCase()
  if (q) list = list.filter(n => (n.title || '').toLowerCase().includes(q) || preview(n.content, 100000).toLowerCase().includes(q))
  return list
}

const MigrationBanner = () => (
  <div className="nx-banner">Vastzetten en notities afvinken staan nog uit. Draai <code>supabase/migrations/add_notes_apple.sql</code> in Supabase.</div>
)

function SearchField({ value, onChange, placeholder = 'Zoek' }) {
  return (
    <label className="nx-search">
      <Search size={16} aria-hidden="true" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="search" />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Wissen"><X size={16} /></button>}
    </label>
  )
}

/** Telefoonscherm: navigatiebalk + scrollgebied met grote titel die inklapt. */
function Screen({ title, back, onBack, right, toolbar, large = true, children, scrollRef }) {
  const [collapsed, setCollapsed] = useState(!large)
  return (
    <>
      <div className={`nx-nav${collapsed ? ' is-collapsed' : ''}${large ? '' : ' is-plain'}`}>
        <div className="nx-nav__left">
          {onBack && <button type="button" className="nx-back" onClick={onBack}><ChevronLeft size={28} strokeWidth={2.4} />{back}</button>}
        </div>
        <div className="nx-nav__title">{large ? title : ''}</div>
        <div className="nx-nav__right">{right}</div>
      </div>
      <div className="nx-scroll" ref={scrollRef} onScroll={large ? (e => setCollapsed(e.currentTarget.scrollTop > 38)) : undefined}>
        {large && <h1 className="nx-large-title">{title}</h1>}
        {children}
      </div>
      {toolbar}
    </>
  )
}

export default function NotesApp({ userId, syncTrigger, openNoteId, onHome }) {
  const isDesktop = useIsDesktop()
  const data = useNotes(userId, syncTrigger)
  const { folders, notes, loaded, dbError, needsMigration } = data
  const fh = useFolderHelpers(folders)
  const [alert, setAlert] = useState(null) // { kind: 'new' | 'rename', folder }
  const [menu, setMenu] = useState(null) // { at, items }
  const [toast, setToast] = useState(null) // { note }
  const toastTimer = useRef(null)

  // ── Gedeelde acties ────────────────────────────────────────────────
  const removeNote = useCallback((note, { silent = false } = {}) => {
    data.deleteNote(note.id)
    if (silent) return
    clearTimeout(toastTimer.current)
    setToast({ note })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [data])
  const undo = () => { if (toast) data.restoreNote(toast.note); setToast(null) }

  const needMig = (fn) => (...a) => { if (needsMigration) { setToast({ text: 'Draai eerst add_notes_apple.sql in Supabase.' }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4000); return } return fn(...a) }
  const pin = needMig(data.togglePin)
  const done = needMig(data.toggleDone)

  const folderMenuItems = (key, onDeleted) => {
    const f = fh.folder(key)
    if (!f) return []
    return [
      { label: 'Wijzig naam', icon: Pencil, onClick: () => setAlert({ kind: 'rename', folder: f }) },
      { label: f.checkable ? 'Afvinkbaar: aan' : 'Maak afvinkbaar', icon: f.checkable ? CheckCircle2 : Circle, onClick: needMig(() => data.updateFolder(f.id, { checkable: !f.checkable })) },
      'sep',
      { label: 'Verwijder map', icon: Trash2, danger: true, onClick: () => { if (window.confirm(`Map "${f.name}" verwijderen? De notities blijven bewaard onder Notities.`)) { data.deleteFolder(f.id); onDeleted?.() } } },
    ]
  }
  const divMig = (fn) => (...a) => { if (data.needsDividerMigration) { setToast({ text: 'Draai eerst add_notes_dividers.sql in Supabase.' }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4000); return } return fn(...a) }
  const newDividerItem = { label: 'Nieuwe scheidingslijn', icon: SeparatorHorizontal, onClick: divMig(() => setAlert({ kind: 'newDivider' })) }
  const dividerMenuItems = (d) => [
    { label: d.name ? 'Wijzig label' : 'Label toevoegen', icon: Pencil, onClick: () => setAlert({ kind: 'renameDivider', folder: d }) },
    { label: 'Verwijder scheidingslijn', icon: Trash2, danger: true, onClick: () => data.deleteFolder(d.id) },
  ]
  const noteMenuItems = (note, key, extra = {}) => [
    { label: note.pinned ? 'Maak los' : 'Zet vast', icon: note.pinned ? PinOff : Pin, onClick: () => pin(note) },
    fh.checkable(note.folder_id) && { label: note.done_at ? 'Markeer als open' : 'Vink af', icon: note.done_at ? Circle : CheckCircle2, onClick: () => done(note) },
    { label: 'Verplaats…', icon: FolderInput, onClick: () => setMenu({ at: extra.at || { x: window.innerWidth / 2 - 115, y: 120 }, items: [
      { label: 'Notities (geen map)', icon: Inbox, onClick: () => data.moveNote(note, null) },
      ...folders.filter(f => f.id !== note.folder_id).map(f => ({ label: f.name, icon: Folder, onClick: () => data.moveNote(note, f.id) })),
    ] }) },
    'sep',
    { label: 'Verwijder', icon: Trash2, danger: true, onClick: () => { extra.onDelete?.(); removeNote(note) } },
  ]

  const finishAlert = async (name) => {
    const a = alert
    setAlert(null)
    if (name === null) return
    if (a.kind === 'newDivider') { data.createDivider(name); return }
    if (a.kind === 'renameDivider') { data.updateFolder(a.folder.id, { name }); return }
    if (!name) return
    if (a.kind === 'new') { const f = await data.createFolder(name); if (f) a.onCreated?.(f) }
    else data.updateFolder(a.folder.id, { name })
  }

  if (dbError) return (
    <div className="nx"><div className="nx-empty"><b>Notities niet gevonden</b>De tabellen notes / note_folders bestaan niet in Supabase.</div></div>
  )

  const overlays = (
    <>
      {menu && <Menu at={menu.at} items={menu.items} onClose={() => setMenu(null)} />}
      {alert && (alert.kind === 'newDivider' || alert.kind === 'renameDivider'
        ? <PromptAlert title={alert.kind === 'newDivider' ? 'Nieuwe scheidingslijn' : 'Label scheidingslijn'} message="Optioneel: een label, bv. School of Privé."
            placeholder="Label (optioneel)" allowEmpty initial={alert.folder?.name || ''} confirm={alert.kind === 'newDivider' ? 'Voeg toe' : 'Bewaar'} onDone={finishAlert} />
        : <PromptAlert title={alert.kind === 'new' ? 'Nieuwe map' : 'Wijzig naam'} message={alert.kind === 'new' ? 'Voer een naam in voor deze map.' : undefined}
            initial={alert.folder?.name || ''} confirm="Bewaar" onDone={finishAlert} />)}
      {toast && (
        <div className="nx-toast" role="status">
          {toast.note ? <>Notitie verwijderd <button type="button" onClick={undo}>Herstel</button></> : toast.text}
        </div>
      )}
    </>
  )

  const shared = { data, fh, folders, notes, loaded, needsMigration, pin, done, removeNote, setMenu, setAlert, folderMenuItems, noteMenuItems, newDividerItem, dividerMenuItems }
  return isDesktop
    ? <MacNotes {...shared} openNoteId={openNoteId} overlays={overlays} />
    : <PhoneNotes {...shared} openNoteId={openNoteId} onHome={onHome} overlays={overlays} />
}

// ═══════════════════════════════ Mac ═══════════════════════════════════
function MacNotes({ data, fh, folders, notes, loaded, needsMigration, pin, done, removeNote, setMenu, setAlert, folderMenuItems, noteMenuItems, newDividerItem, dividerMenuItems, openNoteId, overlays }) {
  const [folderKey, setFolderKey] = useState(() => localStorage.getItem('notes_folder') || 'all')
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const key = folderKey !== 'all' && folderKey !== 'none' && !fh.folder(folderKey) && loaded ? 'all' : folderKey
  const list = filterNotes(notes, key, query)
  const selected = notes.find(n => n.id === selectedId) || null
  const prevSelected = useRef(null)

  // Lege notitie die je verlaat, verdwijnt (zoals Apple)
  useEffect(() => {
    const prev = prevSelected.current
    if (prev && prev !== selectedId) {
      const n = notes.find(x => x.id === prev)
      if (isEmpty(n)) removeNote(n, { silent: true })
    }
    prevSelected.current = selectedId
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Map gekozen → eerste notitie selecteren
  useEffect(() => {
    if (!loaded) return
    if (!selected || !list.some(n => n.id === selected.id)) setSelectedId(list[0]?.id || null)
  }, [key, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vanuit de zoekpalette
  useEffect(() => {
    if (!openNoteId || !loaded) return
    if (notes.some(n => n.id === openNoteId)) { setFolderKey('all'); setSelectedId(openNoteId) }
  }, [openNoteId, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (k) => { data.flush(); setFolderKey(k); setQuery(''); try { localStorage.setItem('notes_folder', k) } catch {} }
  const newNote = () => {
    const n = data.createNote(key === 'all' || key === 'none' ? null : key)
    if (n) { setQuery(''); setSelectedId(n.id) }
  }
  const sort = useSortable({ ids: data.entries.map(e => e.id), onReorder: data.reorder, disabled: data.needsDividerMigration })
  const newFolderItem = { label: 'Nieuwe map', icon: FolderPlus, onClick: () => setAlert({ kind: 'new', onCreated: f => choose(f.id) }) }
  const folderRow = (k, label, Icon, count) => (
    <button key={k} type="button" className={`nx-mac-folder${key === k ? ' is-on' : ''}`} onClick={() => choose(k)}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        const items = folderMenuItems(k, () => choose('all'))
        setMenu({ at: { x: e.clientX, y: e.clientY }, items: items.length ? [...items, 'sep', newFolderItem, newDividerItem] : [newFolderItem, newDividerItem] })
      }}>
      <Icon size={16} /><span>{label}</span><span className="nx-count tnum">{count || ''}</span>
    </button>
  )

  return (
    <div className="nx is-mac">
      {/* Rechtsklik in de mappenkolom (ook op lege plek) = menu met "Nieuwe map" */}
      <aside className="nx-mac-side" aria-label="Mappen"
        onContextMenu={e => { e.preventDefault(); setMenu({ at: { x: e.clientX, y: e.clientY }, items: [newFolderItem, newDividerItem] }) }}>
        <div className="nx-mac-side__head">Hypex</div>
        <div className="nx-mac-side__list">
          {folderRow('all', 'Alle notities', Layers, data.counts.all)}
          {folderRow('none', 'Notities', Folder, data.counts.none)}
          {/* Eigen mappen + scheidingslijnen: slepen om de volgorde te wijzigen */}
          {data.entries.map(en => (
            <div key={en.id} ref={sort.itemRef(en.id)} {...sort.itemProps(en.id)} className="nx-sortable">
              {en.kind === 'divider' ? (
                <div className="nx-mac-divider" onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ at: { x: e.clientX, y: e.clientY }, items: [...dividerMenuItems(en), 'sep', newFolderItem, newDividerItem] }) }}>
                  {en.name ? <span>{en.name}</span> : null}<i />
                </div>
              ) : folderRow(en.id, en.name, en.checkable ? CheckCircle2 : Folder, data.counts[en.id])}
            </div>
          ))}
        </div>
        <div className="nx-mac-side__foot">
          <button type="button" onClick={() => setAlert({ kind: 'new', onCreated: f => choose(f.id) })}><Plus size={15} /> Nieuwe map</button>
        </div>
      </aside>

      <section className="nx-mac-list" aria-label="Notities">
        <div className="nx-mac-bar">
          <div className="nx-mac-bar__title"><b>{fh.label(key)}</b><span>{list.length} {list.length === 1 ? 'notitie' : 'notities'}</span></div>
          {fh.folder(key) && (
            <button type="button" className="nx-icon-btn" aria-label="Mapopties" title="Mapopties"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ at: { x: r.right, y: r.bottom + 6, alignRight: true }, items: folderMenuItems(key, () => choose('all')) }) }}>
              <MoreHorizontal size={17} />
            </button>
          )}
          <button type="button" className="nx-icon-btn" onClick={newNote} aria-label="Nieuwe notitie" title="Nieuwe notitie"><SquarePen size={17} /></button>
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="Zoek" />
        {needsMigration && <MigrationBanner />}
        <div className="nx-scroll">
          {!loaded ? <div className="nx-empty">Laden…</div> : (
            <NoteList notes={list} mac selectedId={selected?.id} checkable={fh.checkable(key)} showFolder={key === 'all'} folders={folders} query={query}
              emptyText="Maak een notitie met het potloodje rechtsboven."
              onOpen={n => { data.flush(); setSelectedId(n.id) }} onPin={pin} onDone={done}
              onDelete={n => removeNote(n)}
              onContext={(n, at) => setMenu({ at, items: noteMenuItems(n, key, { at }) })} />
          )}
        </div>
      </section>

      <section className="nx-mac-edit" aria-label="Notitie">
        {selected ? (
          <NoteEditor key={selected.id} note={selected} mac saveState={data.saveState} checkable={fh.checkable(selected.folder_id)} folders={folders}
            onEdit={f => data.editNote(selected.id, f)} onPin={() => pin(selected)} onToggleDone={() => done(selected)}
            onDelete={() => removeNote(selected)} onNew={newNote} onMove={fid => data.moveNote(selected, fid)} />
        ) : (
          <div className="nx-empty" style={{ marginTop: '30vh' }}><b>Geen notitie</b>Kies een notitie of maak een nieuwe.</div>
        )}
      </section>
      {overlays}
    </div>
  )
}

// ═══════════════════════════════ iPhone ════════════════════════════════
function PhoneNotes({ data, fh, folders, notes, loaded, needsMigration, pin, done, removeNote, setMenu, setAlert, folderMenuItems, noteMenuItems, newDividerItem, dividerMenuItems, openNoteId, onHome, overlays }) {
  const [editFolders, setEditFolders] = useState(false) // "Wijzig": mappen slepen, scheidingslijnen
  const sort = useSortable({ ids: data.entries.map(e => e.id), onReorder: data.reorder, disabled: data.needsDividerMigration })
  const kbProxy = useRef(null) // onzichtbaar veld: houdt het toetsenbord open tot de nieuwe notitie er is
  const [stack, setStack] = useState([{ type: 'folders', key: 'folders' }])
  const [trans, setTrans] = useState(null) // { kind: 'push' | 'pop', leaving, from }
  const [editing, setEditing] = useState(false)
  const transTimer = useRef(null)
  const screenRefs = useRef(new Map())
  const [queries, setQueries] = useState({}) // zoekterm per scherm

  const runTrans = (t, ms) => { clearTimeout(transTimer.current); setTrans(t); transTimer.current = setTimeout(() => setTrans(null), ms) }
  const push = (s) => { data.flush(); setStack(st => [...st, s]); runTrans({ kind: 'push' }, 430) }
  const pop = (from = 0) => {
    if (stack.length < 2) return
    data.flush()
    const top = stack[stack.length - 1]
    if (top.type === 'note') { const n = notes.find(x => x.id === top.id); if (isEmpty(n)) removeNote(n, { silent: true }) }
    setEditing(false)
    setStack(st => st.slice(0, -1))
    runTrans({ kind: 'pop', leaving: top, from }, 370)
  }

  // Vanuit de zoekpalette
  useEffect(() => {
    if (!openNoteId || !loaded) return
    const n = notes.find(x => x.id === openNoteId)
    if (n) setStack([{ type: 'folders', key: 'folders' }, { type: 'list', folder: n.folder_id || 'none', key: 'list' }, { type: 'note', id: n.id, key: 'note-' + n.id }])
  }, [openNoteId, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // iOS opent het toetsenbord alleen bij focus binnen dezelfde tik: eerst een verborgen veld focussen,
  // de editor neemt de focus over zodra hij er is (dan blijft het toetsenbord open).
  const newNote = (folderKey) => {
    try { kbProxy.current?.focus({ preventScroll: true }) } catch { /* */ }
    const n = data.createNote(folderKey && folderKey !== 'all' && folderKey !== 'none' ? folderKey : null)
    if (n) push({ type: 'note', id: n.id, key: 'note-' + n.id })
  }

  // ── Terugvegen vanaf de linkerrand ──────────────────────────────────
  const edge = useRef(null)
  const edgeDown = (e) => {
    if (stack.length < 2 || trans || e.clientX > 24) return
    edge.current = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, active: false, id: e.pointerId }
  }
  const edgeMove = (e) => {
    const s = edge.current
    if (!s || s.id !== e.pointerId) return
    const dx = Math.max(0, e.clientX - s.x)
    if (!s.active) {
      if (Math.abs(e.clientY - s.y) > 12) { edge.current = null; return }
      if (dx < 8) return
      s.active = true
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* geen echte pointer */ }
    }
    s.dx = dx
    const top = screenRefs.current.get(stack[stack.length - 1].key), under = screenRefs.current.get(stack[stack.length - 2].key)
    const w = top?.offsetWidth || 390
    if (top) { top.style.animation = 'none'; top.style.transform = `translateX(${dx}px)` }
    if (under) { under.style.visibility = 'visible'; under.style.animation = 'none'; under.style.transform = `translateX(${-0.3 * w + dx * 0.3}px)` }
  }
  const edgeUp = (e) => {
    const s = edge.current
    edge.current = null
    if (!s || !s.active) return
    const top = screenRefs.current.get(stack[stack.length - 1].key), under = screenRefs.current.get(stack[stack.length - 2].key)
    const w = top?.offsetWidth || 390
    const v = s.dx / Math.max(1, performance.now() - s.t)
    const reset = (el) => { if (el) { el.style.animation = ''; el.style.transform = ''; el.style.visibility = ''; el.style.transition = '' } }
    if (s.dx > w * 0.35 || v > 0.5) {
      reset(top); reset(under)
      pop(s.dx)
    } else {
      for (const el of [top, under]) if (el) el.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)'
      if (top) top.style.transform = 'translateX(0)'
      if (under) under.style.transform = `translateX(${-0.3 * w}px)`
      setTimeout(() => { reset(top); reset(under) }, 320)
    }
  }

  // ── Schermen ────────────────────────────────────────────────────────
  const q = (k) => queries[k] || ''
  const setQ = (k) => (v) => setQueries(m => ({ ...m, [k]: v }))

  const renderScreen = (s) => {
    if (s.type === 'folders') {
      const term = q('folders')
      const cell = (k, label, Icon, count) => <FolderCell key={k} k={k} label={label} Icon={Icon} count={count} checkable={fh.checkable(k)}
        onOpen={() => push({ type: 'list', folder: k, key: 'list' })}
        onMenu={(at) => { const items = folderMenuItems(k); if (items.length) setMenu({ at, items }) }} />
      return (
        <Screen title="Mappen"
          right={!term && (data.entries.length > 0 || editFolders) && (
            <button type="button" className={`nx-text-btn${editFolders ? ' is-bold' : ''}`} onClick={() => setEditFolders(v => !v)}>{editFolders ? 'Gereed' : 'Wijzig'}</button>
          )}
          toolbar={(
            <FloatBar onHome={onHome}
              left={<button type="button" className="nx-icon-btn" onClick={() => setAlert({ kind: 'new' })} aria-label="Nieuwe map"><FolderPlus size={24} /></button>}
              center={`${data.counts.all} ${data.counts.all === 1 ? 'notitie' : 'notities'}`}
              right={<button type="button" className="nx-icon-btn" onClick={() => newNote('none')} aria-label="Nieuwe notitie"><SquarePen size={24} /></button>} />
          )}>
          <SearchField value={term} onChange={setQ('folders')} />
          {needsMigration && <MigrationBanner />}
          {term ? (
            <NoteList notes={filterNotes(notes, 'all', term)} folders={folders} query={term} showFolder
              onOpen={n => push({ type: 'note', id: n.id, key: 'note-' + n.id })} onPin={pin} onDone={done} onDelete={n => removeNote(n)} />
          ) : editFolders ? (
            <>
              {data.needsDividerMigration && <div className="nx-banner">Volgorde en scheidingslijnen staan nog uit. Draai <code>supabase/migrations/add_notes_dividers.sql</code> in Supabase.</div>}
              <p className="nx-edit-hint">Sleep aan <GripVertical size={14} style={{ display: 'inline-block', verticalAlign: -2 }} /> om de volgorde te wijzigen. Tik op een rij voor opties.</p>
              <div className="nx-group">
                {data.entries.map(en => (
                  <div key={en.id} ref={sort.itemRef(en.id)} className={`nx-cell nx-sortable${en.kind === 'divider' ? ' is-divider' : ''}`}
                    role="button" tabIndex={0}
                    onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ at: { x: r.right - 16, y: r.bottom, alignRight: true }, items: en.kind === 'divider' ? dividerMenuItems(en) : folderMenuItems(en.id) }) }}>
                    <span className="nx-cell__icon">{en.kind === 'divider' ? <SeparatorHorizontal size={22} /> : <Folder size={22} />}</span>
                    <span className="nx-cell__label">{en.kind === 'divider' ? (en.name ? `Scheidingslijn · ${en.name}` : 'Scheidingslijn') : en.name}</span>
                    <span className="nx-grip" aria-label="Sleep om te verplaatsen" {...sort.handleProps(en.id)} onClick={e => e.stopPropagation()}><GripVertical size={20} /></span>
                  </div>
                ))}
              </div>
              <div className="nx-group">
                <button type="button" className="nx-cell" onClick={() => setAlert({ kind: 'new' })}><span className="nx-cell__icon"><FolderPlus size={22} /></span><span className="nx-cell__label" style={{ color: 'var(--nx-yellow)' }}>Nieuwe map</span></button>
                <button type="button" className="nx-cell" onClick={newDividerItem.onClick}><span className="nx-cell__icon"><SeparatorHorizontal size={22} /></span><span className="nx-cell__label" style={{ color: 'var(--nx-yellow)' }}>Scheidingslijn toevoegen</span></button>
              </div>
            </>
          ) : (
            <>
              <div className="nx-group">
                {cell('all', 'Alle notities', Layers, data.counts.all)}
              </div>
              {/* Scheidingslijnen delen de mappen op in groepen, met het label als kop */}
              {(() => {
                const groups = [{ id: 'head', title: 'Mappen', items: [] }]
                for (const en of data.entries) {
                  if (en.kind === 'divider') groups.push({ id: en.id, title: en.name, divider: en, items: [] })
                  else groups[groups.length - 1].items.push(en)
                }
                return groups.map((g, gi) => (
                  <React.Fragment key={g.id}>
                    {g.divider
                      ? <DividerTitle d={g.divider} onMenu={at => setMenu({ at, items: dividerMenuItems(g.divider) })} />
                      : <h2 className="nx-section-title">{g.title}</h2>}
                    {(gi === 0 || g.items.length > 0) && (
                      <div className="nx-group">
                        {gi === 0 && cell('none', 'Notities', Folder, data.counts.none)}
                        {g.items.map(f => cell(f.id, f.name, f.checkable ? CheckCircle2 : Folder, data.counts[f.id]))}
                      </div>
                    )}
                  </React.Fragment>
                ))
              })()}
              {loaded && !folders.length && <p className="nx-empty" style={{ margin: '0 24px' }}>Tik op <FolderPlus size={14} style={{ verticalAlign: -2 }} /> om een map te maken.</p>}
            </>
          )}
        </Screen>
      )
    }
    if (s.type === 'list') {
      const key = s.folder, term = q('list')
      const list = filterNotes(notes, key, term)
      const f = fh.folder(key)
      return (
        <Screen title={fh.label(key)} back="Mappen" onBack={() => pop()}
          right={f && <button type="button" className="nx-icon-btn" aria-label="Mapopties"
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ at: { x: r.right, y: r.bottom + 4, alignRight: true }, items: folderMenuItems(key, () => pop()) }) }}><MoreHorizontal size={24} /></button>}
          toolbar={(
            <FloatBar onHome={onHome}
              center={`${list.length} ${list.length === 1 ? 'notitie' : 'notities'}`}
              right={<button type="button" className="nx-icon-btn" onClick={() => newNote(key)} aria-label="Nieuwe notitie"><SquarePen size={24} /></button>} />
          )}>
          <SearchField value={term} onChange={setQ('list')} />
          {!loaded ? <div className="nx-empty">Laden…</div> : (
            <NoteList notes={list} folders={folders} query={term} checkable={fh.checkable(key)} showFolder={key === 'all'}
              emptyText="Tik op het potloodje om een notitie te maken."
              onOpen={n => push({ type: 'note', id: n.id, key: 'note-' + n.id })} onPin={pin} onDone={done} onDelete={n => removeNote(n)} />
          )}
        </Screen>
      )
    }
    // Notitie
    const note = notes.find(n => n.id === s.id)
    const listScreen = stack.find(x => x.type === 'list')
    const backLabel = listScreen ? fh.label(listScreen.folder) : 'Mappen'
    return (
      <Screen large={false} back={backLabel} onBack={() => pop()}
        right={note && (editing
          ? <button type="button" className="nx-text-btn is-bold" onClick={() => document.activeElement?.blur()}>Gereed</button>
          : <button type="button" className="nx-icon-btn" aria-label="Meer"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ at: { x: r.right, y: r.bottom + 4, alignRight: true }, items: noteMenuItems(note, null, { at: { x: r.right - 230, y: r.bottom + 4 }, onDelete: () => pop() }) }) }}>
              <MoreHorizontal size={24} />
            </button>)}>
        {note ? (
          <NoteEditor key={note.id} note={note} saveState={data.saveState} checkable={fh.checkable(note.folder_id)} folders={folders}
            onEdit={f => data.editNote(note.id, f)} onPin={() => pin(note)} onToggleDone={() => done(note)}
            onDelete={() => { pop(); removeNote(note) }} onNew={() => newNote(note.folder_id || 'none')} onMove={fid => data.moveNote(note, fid)}
            onEditingChange={setEditing} onHome={onHome} />
        ) : <div className="nx-empty">Notitie niet gevonden.</div>}
      </Screen>
    )
  }

  // Zichtbaar: bovenste scherm, het scherm eronder tijdens animaties, en het scherm dat wegschuift
  const shown = trans?.kind === 'pop' && trans.leaving ? [...stack, trans.leaving] : stack
  return (
    <div className="nx">
      <div className="nx-stack" onPointerDown={edgeDown} onPointerMove={edgeMove} onPointerUp={edgeUp} onPointerCancel={edgeUp}>
        {shown.map((s, i) => {
          const leaving = trans?.kind === 'pop' && s === trans.leaving
          const top = !leaving && i === stack.length - 1
          const under = !leaving && i === stack.length - 2
          let cls = 'nx-screen'
          let style
          if (leaving) { cls += ' is-top anim-pop-out'; if (trans.from) style = { '--nx-from': `translateX(${trans.from}px)` } }
          else if (top) {
            cls += ' is-top'
            if (trans?.kind === 'push' && stack.length > 1) cls += ' anim-push-in'
            if (trans?.kind === 'pop') { cls += ' anim-uncover'; if (trans.from) style = { '--nx-under-from': `translateX(calc(-30% + ${trans.from * 0.3}px))` } }
          } else if (under) {
            cls += ' is-under'
            if (trans?.kind === 'push') cls += ' anim-under'
            else cls += ' is-hidden'
          } else cls += ' is-hidden'
          return (
            <div key={s.key} ref={el => { if (el) screenRefs.current.set(s.key, el); else screenRefs.current.delete(s.key) }}
              className={cls} style={style} aria-hidden={!top || undefined}>
              {renderScreen(s)}
            </div>
          )
        })}
      </div>
      <input ref={kbProxy} className="nx-kb-proxy" aria-hidden="true" tabIndex={-1} readOnly={false} />
      {overlays}
    </div>
  )
}

function DividerTitle({ d, onMenu }) {
  const { wasLong, ...lp } = useLongPress(onMenu)
  return (
    <h2 className={`nx-section-title nx-divider-title${d.name ? '' : ' is-blank'}`} {...lp}>
      {d.name || <span aria-label="Scheidingslijn" />}
    </h2>
  )
}

function FolderCell({ label, Icon, count, checkable, onOpen, onMenu }) {
  const { wasLong, ...lp } = useLongPress(onMenu)
  return (
    <button type="button" className="nx-cell" {...lp} onClick={() => { if (!wasLong()) onOpen() }}>
      <span className="nx-cell__icon"><Icon size={22} /></span>
      <span className="nx-cell__label">{label}</span>
      <span className="nx-cell__meta">
        {checkable && <span className="nx-badge">Afvinkbaar</span>}
        <span className="tnum">{count || 0}</span><ChevronRight size={18} />
      </span>
    </button>
  )
}

