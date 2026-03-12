import React, { useState, useEffect } from 'react'
import { X, Trash2, Save } from 'lucide-react'

const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']

export default function TaskModal({ task, defaultTime, defaultDate, subjects, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [subjectId, setSubjectId] = useState('')
  const [color, setColor] = useState(EVENT_COLORS[0])
  const [completed, setCompleted] = useState(false)
  const [allDay, setAllDay] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setDate(task.date || '')
      const isAllDay = !task.start_time && !task.time && !task.end_time
      setAllDay(isAllDay)
      setStartTime(task.start_time || task.time || '09:00')
      setEndTime(task.end_time || '10:00')
      setSubjectId(task.subject_id || '')
      setColor(task.color || EVENT_COLORS[0])
      setCompleted(task.completed || false)
    } else {
      setDate(defaultDate || new Date().toISOString().slice(0,10))
      setStartTime(defaultTime || '09:00')
      setEndTime(defaultTime ? (defaultTime.slice(0,2) < '23' ? `${String(parseInt(defaultTime)+1).padStart(2,'0')}:00` : '23:59') : '10:00')
      setAllDay(false)
    }
  }, [task, defaultTime, defaultDate])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      id: task?.id, title, description, date,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      time: allDay ? null : startTime,
      subject_id: subjectId || null, color, completed
    })
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',padding:'16px'}}
      onClick={onClose}>
      <div className="glass-card" style={{width:'100%',maxWidth:'440px',padding:'24px',maxHeight:'90vh',overflowY:'auto'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <h2 style={{color:'white',fontWeight:700,fontSize:'16px',margin:0}}>
            {task ? '✏️ Taak bewerken' : '📝 Nieuwe taak'}
          </h2>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)'}}><X size={18}/></button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <input className="glass-input" placeholder="Titel *" value={title}
            onChange={e=>setTitle(e.target.value)} style={{ fontSize: '16px' }} />
          <textarea className="glass-input" placeholder="Beschrijving (optioneel)" value={description}
            onChange={e=>setDescription(e.target.value)}
            style={{resize:'vertical',minHeight:'60px'}}/>
          <div>
            <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Datum</label>
            <input type="date" className="glass-input" value={date} style={{colorScheme:'dark'}}
              onChange={e=>setDate(e.target.value)}/>
          </div>
          {/* All-day toggle */}
          <button type="button" onClick={()=>setAllDay(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',color:allDay?'var(--accent)':'rgba(255,255,255,0.4)',fontSize:13,padding:0,width:'fit-content'}}>
            <div style={{width:20,height:20,borderRadius:6,background:allDay?'color-mix(in srgb, var(--accent) 20%, transparent)':'rgba(255,255,255,0.05)',border:`1px solid ${allDay?'color-mix(in srgb, var(--accent) 50%, transparent)':'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',flexShrink:0}}>
              {allDay && <span style={{fontSize:12}}>✓</span>}
            </div>
            Hele dag
          </button>
          {!allDay && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div>
                <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Starttijd</label>
                <input type="time" className="glass-input" value={startTime} style={{colorScheme:'dark',width:'100%'}}
                  onChange={e=>setStartTime(e.target.value)}/>
              </div>
              <div>
                <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Eindtijd</label>
                <input type="time" className="glass-input" value={endTime} style={{colorScheme:'dark',width:'100%'}}
                  onChange={e=>setEndTime(e.target.value)}/>
              </div>
            </div>
          )}

          <div>
            <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Vak</label>
            <select className="glass-input" value={subjectId} style={{colorScheme:'dark'}}
              onChange={e=>setSubjectId(e.target.value)}>
              <option value="">Geen vak</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'6px'}}>Kleur</label>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
              {EVENT_COLORS.map(c=>(
                <button key={c} type="button" onClick={()=>setColor(c)}
                  style={{width:'24px',height:'24px',borderRadius:'50%',background:c,border:color===c?'3px solid white':'2px solid transparent',cursor:'pointer',flexShrink:0,transition:'transform 0.1s',transform:color===c?'scale(1.2)':'scale(1)'}}/>
              ))}
            </div>
          </div>

          {task && (
            <button onClick={()=>setCompleted(!completed)}
              style={{display:'flex',alignItems:'center',gap:'8px',background:'none',border:'none',cursor:'pointer',color:completed?'#00FFD1':'rgba(255,255,255,0.4)',fontSize:'13px',padding:0}}>
              <div style={{width:'20px',height:'20px',borderRadius:'6px',background:completed?'rgba(0,255,209,0.2)':'rgba(255,255,255,0.05)',border:`1px solid ${completed?'rgba(0,255,209,0.5)':'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                {completed && <span style={{fontSize:'12px'}}>✓</span>}
              </div>
              Afgerond
            </button>
          )}
        </div>

        <div style={{display:'flex',gap:'8px',marginTop:'20px'}}>
          {task && (
            <button onClick={()=>onDelete(task.id)}
              style={{padding:'9px 14px',borderRadius:'10px',border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,80,80,0.08)',color:'#ff6b6b',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:'4px'}}>
              <Trash2 size={13}/> Verwijder
            </button>
          )}
          <button onClick={onClose}
            style={{flex:1,padding:'9px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:'12px'}}>
            Annuleer
          </button>
          <button onClick={handleSave} disabled={!title.trim()}
            style={{flex:2,padding:'9px',borderRadius:'10px',border:'1px solid rgba(0,255,209,0.4)',background:'rgba(0,255,209,0.12)',color:'#00FFD1',cursor:'pointer',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:'4px'}}>
            <Save size={13}/> Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}
