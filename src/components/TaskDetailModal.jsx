import React, { useState } from 'react'
import { X, Pencil, Trash2, BookOpen, Clock, Calendar, Tag, FileText, Link } from 'lucide-react'

const DAYS_NL    = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const MONTHS_NL  = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = (d - today) / 86400000
  if (diff === 0) return 'Vandaag'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gisteren'
  return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
}

export default function TaskDetailModal({ task, subjects, subjectLinks = {}, onEdit, onDelete, onClose, onStartPomodoro, onSaveDescription }) {
  const [closing, setClosing] = useState(false)
  const handleClose = () => {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 200)
  }
  const [editingBook, setEditingBook] = useState(false)
  const [bookInput, setBookInput] = useState('')
  const [desc, setDesc] = useState(task?.description || '')
  const [descDirty, setDescDirty] = useState(false)
  const descRef = React.useRef(null)

  // Laat het beschrijvingsveld meegroeien met de inhoud (geen interne scroll)
  const autoSize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  React.useEffect(() => { autoSize(descRef.current) }, [task?.id])

  if (!task) return null
  const subject = subjects.find(s => s.id === task.subject_id)
  // Magister-link (Supabase) heeft voorrang op handmatig ingestelde localStorage-link
  const bookUrl = subject
    ? (subjectLinks[subject.name] || localStorage.getItem(`subject_book_url_${subject.id}`))
    : null
  const isAllDay = !task.start_time && !task.time && !task.end_time

  const saveBookUrl = () => {
    if (subject) {
      if (bookInput.trim()) localStorage.setItem(`subject_book_url_${subject.id}`, bookInput.trim())
      else localStorage.removeItem(`subject_book_url_${subject.id}`)
    }
    setEditingBook(false)
  }

  const startEditBook = () => {
    setBookInput(bookUrl || '')
    setEditingBook(true)
  }

  const mouseDownedInside = React.useRef(false)

  return (
    <div
      className={closing ? 'modal-overlay modal-closing' : 'modal-overlay'}
      style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',padding:'16px' }}
      onMouseDown={() => { mouseDownedInside.current = false }}
      onClick={() => { if (!mouseDownedInside.current) handleClose() }}
    >
      <div
        className={`glass-card modal-content${closing ? ' modal-closing' : ''}`}
        style={{ width:'100%',maxWidth:'420px',padding:'24px',maxHeight:'88vh',overflowY:'auto' }}
        onMouseDown={e => { e.stopPropagation(); mouseDownedInside.current = true }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px' }}>
          <div style={{ flex:1,minWidth:0,paddingRight:8 }}>
            <h2 style={{ color:'white',fontWeight:700,fontSize:'18px',margin:0,lineHeight:1.3 }}>{task.title}</h2>
            {subject && (
              <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:4 }}>
                <Tag size={11} style={{ color:'var(--accent)' }} />
                <span style={{ fontSize:12,color:'var(--accent)' }}>{subject.name}</span>
              </div>
            )}
          </div>
          <button onClick={handleClose} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',flexShrink:0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Meta info */}
        <div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:16 }}>
          {task.date && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Calendar size={13} style={{ color:'rgba(255,255,255,0.35)',flexShrink:0 }} />
              <span style={{ fontSize:13,color:'rgba(255,255,255,0.7)' }}>{fmtDate(task.date)}</span>
            </div>
          )}
          {!isAllDay && (task.start_time || task.time) && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Clock size={13} style={{ color:'rgba(255,255,255,0.35)',flexShrink:0 }} />
              <span style={{ fontSize:13,color:'rgba(255,255,255,0.7)' }}>
                {task.start_time || task.time}
                {task.end_time ? ` – ${task.end_time}` : ''}
              </span>
            </div>
          )}
          {isAllDay && task.date && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Clock size={13} style={{ color:'rgba(255,255,255,0.35)',flexShrink:0 }} />
              <span style={{ fontSize:13,color:'rgba(255,255,255,0.5)' }}>Hele dag</span>
            </div>
          )}
        </div>

        {/* Duration */}
        {task.duration_minutes > 0 && (
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
            <Clock size={13} style={{ color:'rgba(255,255,255,0.35)',flexShrink:0 }} />
            <span style={{ fontSize:13,color:'rgba(255,255,255,0.7)' }}>
              {task.duration_minutes >= 60
                ? `${Math.floor(task.duration_minutes/60)}u${task.duration_minutes%60>0?' '+task.duration_minutes%60+'min':''}`
                : `${task.duration_minutes} min`}
            </span>
          </div>
        )}

        {/* Description — editable */}
        <div style={{ marginBottom:16,padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
            <FileText size={11} style={{ color:'rgba(255,255,255,0.3)' }} />
            <span style={{ fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.06em',textTransform:'uppercase' }}>Beschrijving</span>
            {descDirty && <span style={{ marginLeft:'auto',fontSize:10,color:'var(--accent)' }}>opgeslagen</span>}
          </div>
          <textarea
            ref={descRef}
            value={desc}
            onChange={e => { setDesc(e.target.value); setDescDirty(false); autoSize(e.target) }}
            onBlur={() => { if (onSaveDescription) { onSaveDescription(task.id, desc); setDescDirty(true) } }}
            onFocus={e => { const t = e.target; setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350) }}
            placeholder="Voeg een beschrijving toe..."
            style={{
              width:'100%', background:'transparent', border:'none', outline:'none',
              color:'rgba(255,255,255,0.7)', fontSize:13, lineHeight:1.5,
              fontFamily:'inherit', resize:'none', overflow:'hidden', minHeight:'48px', boxSizing:'border-box',
            }}
          />
        </div>

        {/* Online book */}
        {subject && (
          <div style={{ marginBottom: 12 }}>
            {editingBook ? (
              <div style={{ display:'flex',gap:6 }}>
                <input
                  className="glass-input"
                  placeholder="https://..."
                  value={bookInput}
                  onChange={e => setBookInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveBookUrl(); if (e.key === 'Escape') setEditingBook(false) }}
                  autoFocus
                  style={{ flex:1,fontSize:12 }}
                />
                <button onClick={saveBookUrl} style={{ padding:'6px 12px',borderRadius:8,border:'none',background:'var(--accent)',color:'#000',cursor:'pointer',fontSize:12,fontWeight:600 }}>
                  Opslaan
                </button>
                <button onClick={() => setEditingBook(false)} style={{ padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:12 }}>
                  <X size={13} />
                </button>
              </div>
            ) : bookUrl ? (
              <div style={{ display:'flex',gap:6 }}>
                <a
                  href={bookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',borderRadius:10,background:'rgba(129,140,248,0.12)',border:'1px solid rgba(129,140,248,0.3)',color:'#818CF8',textDecoration:'none',fontSize:13,fontWeight:600 }}
                >
                  <BookOpen size={14} /> Online boek openen
                </a>
                <button onClick={startEditBook} title="Bewerk link" style={{ padding:'9px 12px',borderRadius:10,border:'1px solid rgba(129,140,248,0.3)',background:'rgba(129,140,248,0.08)',color:'#818CF8',cursor:'pointer' }}>
                  <Pencil size={13} />
                </button>
              </div>
            ) : (
              <button onClick={startEditBook} style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',borderRadius:10,border:'1px dashed rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:12 }}>
                <Link size={13} /> Voeg boeklink toe
              </button>
            )}
          </div>
        )}

        {/* Actions — twee rijen zodat alles op smalle schermen past */}
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          <div style={{ display:'flex',gap:8 }}>
            <button
              onClick={() => onEdit(task)}
              style={{ flex:1,padding:'10px',borderRadius:10,border:'1px solid color-mix(in srgb, var(--accent) 40%, transparent)',background:'color-mix(in srgb, var(--accent) 12%, transparent)',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}
            >
              <Pencil size={14} /> Bewerken
            </button>
            {onStartPomodoro && (
              <button
                onClick={onStartPomodoro}
                style={{ flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,100,100,0.3)',background:'rgba(255,100,100,0.08)',color:'#ff8080',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}
              >
                🍅 Pomodoro
              </button>
            )}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button
              onClick={() => onDelete(task.id)}
              style={{ flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,80,80,0.08)',color:'#ff6b6b',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}
            >
              <Trash2 size={14} /> Verwijder
            </button>
            <button
              onClick={handleClose}
              style={{ flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.45)',cursor:'pointer',fontSize:13 }}
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
