import React, { useEffect, useState } from 'react'
import { CalendarDays, Link, RefreshCw, Trash2, X } from 'lucide-react'
import { connectMyxCalendar, disconnectCalendar, listCalendarConnections, startGoogleCalendar, syncCalendars } from '../utils/calendarSync'

const button = { border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '8px 10px', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.8)', cursor: 'pointer', fontSize: 12 }

export default function CalendarConnections({ onClose }) {
  const [connections, setConnections] = useState([])
  const [feedUrl, setFeedUrl] = useState('')
  const [name, setName] = useState('MijnX rooster')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const load = async () => { try { setConnections((await listCalendarConnections()).connections || []) } catch (e) { setMessage(e.message) } }
  useEffect(() => { load() }, [])
  useEffect(() => {
    const received = (e) => {
      if (e.origin !== window.location.origin || !e.data?.calendarOAuth) return
      setMessage(e.data.calendarOAuth.error || 'Google Agenda gekoppeld.')
      load()
      if (!e.data.calendarOAuth.error) window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
    }
    window.addEventListener('message', received)
    return () => window.removeEventListener('message', received)
  }, [])
  const google = async () => {
    try {
      setBusy(true); const { url } = await startGoogleCalendar()
      const popup = window.open(url, 'hypex-google-calendar', 'width=520,height=700')
      if (!popup) setMessage('Sta pop-ups toe om Google te koppelen.')
    } catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  const myx = async (e) => {
    e.preventDefault()
    try {
      setBusy(true); await connectMyxCalendar(feedUrl, name); setFeedUrl(''); setMessage('MijnX-feed gekoppeld en gesynchroniseerd.'); await load(); window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  const sync = async (id) => { try { setBusy(true); await syncCalendars(id); setMessage('Agenda bijgewerkt.'); await load(); window.dispatchEvent(new Event('refreshExternalCalendarEvents')) } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
  const remove = async (id) => { if (!window.confirm('Deze koppeling en de ingelezen afspraken verwijderen?')) return; try { await disconnectCalendar(id); await load(); window.dispatchEvent(new Event('refreshExternalCalendarEvents')) } catch (e) { setMessage(e.message) } }
  return <div style={{ position: 'fixed', inset: 0, zIndex: 110, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)' }}>
    <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><h2 style={{ margin: 0, color: 'white', fontSize: 17 }}><CalendarDays size={17} style={{ display: 'inline', marginRight: 7, color: 'var(--accent)' }} />Agenda's koppelen</h2><button onClick={onClose} style={{ ...button, padding: 5 }}><X size={16} /></button></div>
      <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,.5)', fontSize: 12, lineHeight: 1.5 }}>Externe afspraken zijn alleen-lezen in Hypex. Je eigen afspraken blijven gescheiden.</p>
      <button disabled={busy} onClick={google} style={{ ...button, width: '100%', color: '#fff', background: 'rgba(66,133,244,.2)', borderColor: 'rgba(66,133,244,.5)', marginBottom: 16 }}><Link size={13} style={{ display: 'inline', marginRight: 6 }} />Google Agenda koppelen</button>
      <form onSubmit={myx} style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 14 }}>
        <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>MijnX-rooster (ICS-feed)</div>
        <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 11, margin: '0 0 8px', lineHeight: 1.45 }}>In MijnX: Rooster opties → selecteer rooster → Feed. Plak de persoonlijke URL hier.</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Naam" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 7, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.2)', color: 'white' }} />
        <input required type="url" value={feedUrl} onChange={e => setFeedUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.2)', color: 'white' }} />
        <button disabled={busy} style={{ ...button, width: '100%', color: 'var(--accent)' }}>Feed koppelen</button>
      </form>
      {message && <p style={{ color: message.includes('mislukt') || message.includes('niet') ? '#fca5a5' : '#86efac', fontSize: 12, margin: '12px 0 0' }}>{message}</p>}
      {connections.length > 0 && <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 15, paddingTop: 10 }}>{connections.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 0', color: 'white', fontSize: 12 }}><span style={{ flex: 1 }}>{c.provider === 'google' ? 'Google' : 'MijnX'} · {c.name}{c.last_error ? <small style={{ display: 'block', color: '#fca5a5' }}>{c.last_error}</small> : null}</span><button disabled={busy} onClick={() => sync(c.id)} style={button} title="Vernieuwen"><RefreshCw size={13} /></button><button disabled={busy} onClick={() => remove(c.id)} style={{ ...button, color: '#fca5a5' }} title="Verwijderen"><Trash2 size={13} /></button></div>)}</div>}
    </div>
  </div>
}
