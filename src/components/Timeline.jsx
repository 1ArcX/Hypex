import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2, Clock, AlignLeft, Repeat, Check } from 'lucide-react'
import { openBookLink } from '../utils/openBook'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MONTHS = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
const DAYS_NL = ['Zo','Ma','Di','Wo','Do','Vr','Za']
const DAYS_FULL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
const EVENT_COLORS = ['#00FFD1','#818CF8','#FF8C42','#FF6B6B','#4ADE80','#FACC15','#38BDF8']

function pad(n) { return String(n).padStart(2,'0') }
function formatTime(h, m = 0) { return `${pad(h)}:${pad(m)}` }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function getWeekDays(date) {
  const start = new Date(date)
  const day = date.getDay()
  start.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d })
}

const emptyForm = (date, hour) => ({
  title: '', description: '', date: toDateStr(date || new Date()),
  startTime: hour !== undefined ? formatTime(hour) : '09:00',
  endTime: hour !== undefined ? formatTime(Math.min(hour+1,23)) : '10:00',
  color: '#818CF8', recurrence: '', recurrence_days: [], completed: false
})

export default function Timeline({ userId, tasks, subjects, onToggleTask, onEditTask, isAdmin }) {
  const [view, setView] = useState('day')
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState([])
  const [modal, setModal] = useState(null) // null | { mode: 'new'|'edit', data: {} }
  const [form, setForm] = useState(emptyForm(new Date()))
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef(null)
  const now = new Date()

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 2) * 60)
    }
  }, [view])

  const fetchEvents = async () => {
    const { data } = await supabase.from('calendar_events').select('*').eq('user_id', userId)
    if (data) setEvents(data)
  }

  const getEventsForDay = (date) => events.filter(ev => {
    const start = new Date(ev.start_time)
    if (isSameDay(start, date)) return true
    if (ev.recurrence === 'daily') return start <= date
    if (ev.recurrence === 'weekly' && ev.recurrence_days?.includes(date.getDay())) return start <= date
    if (ev.recurrence === 'monthly' && start.getDate() === date.getDate()) return start <= date
    return false
  })

  const getTasksForDay = (date) => (tasks || []).filter(t => {
    if (!t.start_time && !t.time) return false
    const taskDate = t.date ? new Date(t.date) : now
    return isSameDay(taskDate, date)
  })

  const openNew = (date, hour) => {
    setForm(emptyForm(date || current, hour))
    setModal({ mode: 'new' })
  }

  const openEditEvent = (ev, e) => {
    e?.stopPropagation()
    const start = new Date(ev.start_time)
    const end = new Date(ev.end_time)
    setForm({
      title: ev.title, description: ev.description || '',
      date: toDateStr(start),
      startTime: formatTime(start.getHours(), start.getMinutes()),
      endTime: formatTime(end.getHours(), end.getMinutes()),
      color: ev.color || '#818CF8',
      recurrence: ev.recurrence || '', recurrence_days: ev.recurrence_days || [],
      completed: false
    })
    setModal({ mode: 'edit', event: ev })
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const start = new Date(`${form.date}T${form.startTime}`)
    const end = new Date(`${form.date}T${form.endTime}`)
    const payload = {
      user_id: userId, title: form.title, description: form.description,
      start_time: start.toISOString(), end_time: end.toISOString(),
      color: form.color,
      recurrence: form.recurrence || null,
      recurrence_days: form.recurrence_days?.length ? form.recurrence_days : null
    }
    if (modal?.mode === 'edit' && modal.event) {
      await supabase.from('calendar_events').update(payload).eq('id', modal.event.id)
    } else {
      const { error } = await supabase.from('calendar_events').insert(payload)
      if (error) { console.error(error); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    fetchEvents()
  }

  const handleDelete = async () => {
    if (!modal?.event) return
    await supabase.from('calendar_events').delete().eq('id', modal.event.id)
    setModal(null)
    fetchEvents()
  }

  const navigate = (dir) => {
    const d = new Date(current)
    if (view==='day') d.setDate(d.getDate()+dir)
    else if (view==='week') d.setDate(d.getDate()+dir*7)
    else d.setMonth(d.getMonth()+dir)
    setCurrent(d)
  }

  const headerLabel = () => {
    if (view==='day') return `${DAYS_FULL[current.getDay()]} ${current.getDate()} ${MONTHS[current.getMonth()]}`
    if (view==='week') {
      const days = getWeekDays(current)
      return `${days[0].getDate()} – ${days[6].getDate()} ${MONTHS[current.getMonth()]} ${current.getFullYear()}`
    }
    return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
  }

  // ---- MONTH VIEW ----
  const MonthView = () => {
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1)
    const lastDay = new Date(current.getFullYear(), current.getMonth()+1, 0)
    const startPad = (firstDay.getDay()+6)%7
    const cells = [...Array(startPad).fill(null)]
    for (let d=1; d<=lastDay.getDate(); d++) cells.push(new Date(current.getFullYear(), current.getMonth(), d))

    return (
      <div style={{flex:1, overflow:'auto', minHeight:0}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d=>(
            <div key={d} style={{padding:'6px', textAlign:'center', fontSize:'10px', color:'rgba(255,255,255,0.25)', fontWeight:600}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)'}}>
          {cells.map((date,i)=>{
            const dayItems = date ? [...getEventsForDay(date), ...getTasksForDay(date)] : []
            const isToday = date && isSameDay(date, now)
            return (
              <div key={i} onClick={()=>{ if(date){setCurrent(date);setView('day')} }}
                style={{minHeight:'60px', padding:'3px', borderRight:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:date?'pointer':'default', background:isToday?'rgba(0,255,209,0.04)':'transparent'}}>
                {date && <>
                  <div style={{width:'20px',height:'20px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:isToday?'#00FFD1':'transparent',color:isToday?'#000':'rgba(255,255,255,0.6)',fontSize:'10px',fontWeight:isToday?700:400,marginBottom:'2px'}}>
                    {date.getDate()}
                  </div>
                  {dayItems.slice(0,2).map((ev,idx)=>(
                    <div key={ev.id||idx} style={{background:(ev.color||'#818CF8')+'22',borderRadius:'3px',padding:'1px 3px',fontSize:'9px',color:ev.color||'#818CF8',marginBottom:'1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {ev.title}
                    </div>
                  ))}
                  {dayItems.length>2 && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.25)'}}>+{dayItems.length-2}</div>}
                </>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- TIME GRID ----
  const TimeGridView = ({ days }) => {
    const nowMins = now.getHours()*60+now.getMinutes()
    const todayIdx = days.findIndex(d=>isSameDay(d,now))

    return (
      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0}}>
        {/* Day headers for week view */}
        {days.length>1 && (
          <div style={{display:'grid', gridTemplateColumns:`48px repeat(${days.length},1fr)`, borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0}}>
            <div/>
            {days.map((d,i)=>{
              const isToday=isSameDay(d,now)
              return (
                <div key={i} style={{padding:'4px',textAlign:'center'}}>
                  <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)'}}>{DAYS_NL[(d.getDay()+6)%7]}</div>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'1px auto 0',background:isToday?'#00FFD1':'transparent',color:isToday?'#000':'rgba(255,255,255,0.7)',fontSize:'11px',fontWeight:isToday?700:400}}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Scrollable grid */}
        <div ref={scrollRef} style={{flex:1, overflowY:'auto', overflowX:'hidden', position:'relative'}}>
          <div style={{display:'grid', gridTemplateColumns:`48px repeat(${days.length},1fr)`, position:'relative', width:'100%'}}>
            {HOURS.map(h=>(
              <React.Fragment key={h}>
                <div style={{height:'60px',display:'flex',alignItems:'flex-start',paddingTop:'4px',paddingRight:'8px',justifyContent:'flex-end',flexShrink:0}}>
                  <span style={{fontSize:'9px',color:'rgba(255,255,255,0.18)'}}>{formatTime(h)}</span>
                </div>
                {days.map((d,di)=>{
                  const dayEvs = getEventsForDay(d).filter(ev=>new Date(ev.start_time).getHours()===h)
                  const dayTasks = getTasksForDay(d).filter(t=>{
                    const timeStr = t.start_time || t.time
                    return timeStr && parseInt(timeStr.split(':')[0])===h
                  })
                  return (
                    <div key={di} onClick={()=>openNew(d,h)}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={async e=>{
                        e.preventDefault()
                        const taskId=e.dataTransfer.getData('taskId')
                        if(!taskId) return
                        await supabase.from('tasks').update({time:formatTime(h),date:toDateStr(d)}).eq('id',taskId)
                        window.dispatchEvent(new Event('refreshTasks'))
                      }}
                      style={{height:'60px',borderLeft:'1px solid rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.04)',position:'relative',cursor:'pointer',boxSizing:'border-box'}}>

                      {/* Events */}
                      {dayEvs.map(ev=>{
                        const s=new Date(ev.start_time), en=new Date(ev.end_time)
                        const dur=Math.max(20,(en-s)/60000)
                        const top=(s.getMinutes()/60)*60
                        const height=Math.min((dur/60)*60, 60-top)
                        return (
                          <div key={ev.id} onClick={e=>openEditEvent(ev,e)}
                            style={{position:'absolute',left:'2px',right:'2px',top:`${top}px`,height:`${height}px`,background:ev.color+'25',border:`1px solid ${ev.color}66`,borderRadius:'5px',padding:'2px 4px',overflow:'hidden',cursor:'pointer',zIndex:2}}>
                            <p style={{fontSize:'9px',color:ev.color,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:0}}>{ev.title}</p>
                          </div>
                        )
                      })}

                      {/* Tasks */}
                      {dayTasks.map((task,ti)=>{
                        const timeStr = task.start_time || task.time || '00:00'
                        const mins=parseInt(timeStr.split(':')[1]||0)
                        const top=(mins/60)*60
                        const subject=subjects?.find(s=>s.id===task.subject_id)
                        return (
                          <div key={task.id}
                            draggable
                            onDragStart={e=>e.dataTransfer.setData('taskId',task.id)}
                            onClick={e=>{e.stopPropagation(); onEditTask?.(task)}}
                            style={{position:'absolute',left:'2px',right:'2px',top:`${top+ti*17}px`,height:'15px',background:task.completed?'rgba(0,255,100,0.08)':'rgba(255,255,255,0.05)',border:`1px solid ${task.completed?'rgba(0,255,100,0.25)':'rgba(255,255,255,0.1)'}`,borderRadius:'4px',padding:'0 4px',overflow:'hidden',cursor:'pointer',zIndex:3,display:'flex',alignItems:'center',gap:'3px'}}>
                            <div style={{width:'4px',height:'4px',borderRadius:'50%',background:task.completed?'#00ff88':'#00FFD1',flexShrink:0}}/>
                            <p style={{fontSize:'9px',color:task.completed?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.65)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:task.completed?'line-through':'none',margin:0}}>
                              {task.title}{subject?` · ${subject.name}`:''}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}

            {/* Huidige tijd lijn — volledig van links naar rechts */}
            {todayIdx>=0 && (
              <div style={{
                position:'absolute',
                top:`${nowMins}px`,
                left:'48px',
                right:'0',
                height:'2px',
                background:'#FF6B6B',
                zIndex:5,
                pointerEvents:'none'
              }}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#FF6B6B',position:'absolute',left:'-3px',top:'-2.5px'}}/>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays(current)

  return (
    <div className="glass-card" style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Sticky toolbar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,flexWrap:'wrap',gap:'6px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <button onClick={()=>setCurrent(new Date())}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'3px 7px',cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:'10px'}}>
            Vandaag
          </button>
          <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.35)',padding:'2px'}}><ChevronLeft size={14}/></button>
          <button onClick={()=>navigate(1)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.35)',padding:'2px'}}><ChevronRight size={14}/></button>
          <span style={{color:'white',fontWeight:600,fontSize:'12px',whiteSpace:'nowrap'}}>{headerLabel()}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'3px'}}>
          {['day','week','month'].map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{padding:'3px 8px',borderRadius:'6px',fontSize:'10px',cursor:'pointer',border:'1px solid',borderColor:view===v?'rgba(0,255,209,0.5)':'rgba(255,255,255,0.08)',background:view===v?'rgba(0,255,209,0.12)':'transparent',color:view===v?'#00FFD1':'rgba(255,255,255,0.35)'}}>
              {v==='day'?'Dag':v==='week'?'Week':'Maand'}
            </button>
          ))}
          <button onClick={()=>openNew(current)}
            style={{background:'rgba(0,255,209,0.1)',border:'1px solid rgba(0,255,209,0.25)',borderRadius:'6px',padding:'3px 8px',cursor:'pointer',color:'#00FFD1',display:'flex',alignItems:'center',gap:'3px',fontSize:'10px',marginLeft:'4px'}}>
            <Plus size={11}/> Nieuw
          </button>
        </div>
      </div>

      {/* Views */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
        {view==='month' && <MonthView/>}
        {view==='week' && <TimeGridView days={weekDays}/>}
        {view==='day' && <TimeGridView days={[current]}/>}
      </div>

      {/* Modal — fixed over hele scherm */}
      {modal && (
        <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',padding:'16px'}}
          onClick={()=>setModal(null)}>
          <div className="glass-card" style={{width:'100%',maxWidth:'440px',padding:'24px',maxHeight:'90vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{color:'white',fontWeight:700,fontSize:'16px',margin:0}}>
                {modal.mode==='edit'?'✏️ Bewerk event':'📅 Nieuw event'}
              </h2>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)'}}><X size={18}/></button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              <input className="glass-input" placeholder="Titel *" value={form.title}
                onChange={e=>setForm(p=>({...p,title:e.target.value}))} autoFocus/>
              <textarea className="glass-input" placeholder="Beschrijving (optioneel)" value={form.description}
                onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                style={{resize:'vertical',minHeight:'60px'}}/>
              <div>
                <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Datum</label>
                <input type="date" className="glass-input" value={form.date}
                  onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <div>
                  <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Starttijd</label>
                  <input type="time" className="glass-input" value={form.startTime}
                    onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/>
                </div>
                <div>
                  <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Eindtijd</label>
                  <input type="time" className="glass-input" value={form.endTime}
                    onChange={e=>setForm(p=>({...p,endTime:e.target.value}))}/>
                </div>
              </div>

              {/* Herhaling */}
              <div>
                <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'4px'}}>Herhaling</label>
                <select className="glass-input" value={form.recurrence}
                  onChange={e=>setForm(p=>({...p,recurrence:e.target.value}))}>
                  <option value="">Geen herhaling</option>
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="monthly">Maandelijks</option>
                </select>
              </div>

              {form.recurrence==='weekly' && (
                <div>
                  <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'6px'}}>Dagen</label>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                    {['Ma','Di','Wo','Do','Vr','Za','Zo'].map((d,i)=>{
                      const dayNum=(i+1)%7
                      const sel=form.recurrence_days.includes(dayNum)
                      return (
                        <button key={i} type="button" onClick={()=>setForm(p=>({...p,recurrence_days:sel?p.recurrence_days.filter(x=>x!==dayNum):[...p.recurrence_days,dayNum]}))}
                          style={{padding:'4px 8px',borderRadius:'6px',fontSize:'11px',cursor:'pointer',border:'1px solid',borderColor:sel?'rgba(0,255,209,0.5)':'rgba(255,255,255,0.1)',background:sel?'rgba(0,255,209,0.15)':'transparent',color:sel?'#00FFD1':'rgba(255,255,255,0.4)'}}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Kleur */}
              <div>
                <label style={{color:'rgba(255,255,255,0.35)',fontSize:'11px',display:'block',marginBottom:'6px'}}>Kleur</label>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {EVENT_COLORS.map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(p=>({...p,color:c}))}
                      style={{width:'24px',height:'24px',borderRadius:'50%',background:c,border:form.color===c?'3px solid white':'2px solid transparent',cursor:'pointer',flexShrink:0,transition:'transform 0.1s',transform:form.color===c?'scale(1.2)':'scale(1)'}}/>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:'8px',marginTop:'20px'}}>
              {modal.mode==='edit' && (
                <button onClick={handleDelete}
                  style={{padding:'9px 14px',borderRadius:'10px',border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,80,80,0.08)',color:'#ff6b6b',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:'4px'}}>
                  <Trash2 size={13}/> Verwijder
                </button>
              )}
              <button onClick={()=>setModal(null)}
                style={{flex:1,padding:'9px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:'12px'}}>
                Annuleer
              </button>
              <button onClick={handleSave} disabled={!form.title.trim()||saving}
                style={{flex:2,padding:'9px',borderRadius:'10px',border:'1px solid rgba(0,255,209,0.4)',background:'rgba(0,255,209,0.12)',color:'#00FFD1',cursor:'pointer',fontSize:'12px',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:'4px'}}>
                <Save size={13}/> {saving?'Opslaan...':'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}