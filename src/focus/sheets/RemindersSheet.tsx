import { useMemo, useState } from 'react'
import { BellOff, BellRing, Clock, GraduationCap, Plus, Trash2, X } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { registerPushSubscription } from '../../components/pomodoro/usePomodoroEngine'
import { fmtLongDate, parseDay, MONTHS_SHORT, todayISO } from '../lib/format'
import { MAX_OFFSETS, OFFSET_OPTIONS, offsetLabel, reminderAt, reminderBody } from '../lib/reminders'
import { Sheet, SheetHead } from '../components/ui'

interface Draft { id?: string; title: string; date: string; is_final: boolean; offsets: string[]; deleted?: boolean }

/** Herinneringen + belangrijke datums van één vak (zoals "Never Miss a Key Date") */
export function RemindersSheet({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const store = useFocusStore.getState()
  const course = useFocusStore(s => s.courses.find(c => c.id === courseId))
  const userId = useFocusStore(s => s.userId)
  const allDates = useFocusStore(s => s.dates)
  const existing = useMemo(() => allDates.filter(d => d.course_id === courseId), [allDates, courseId])
  const [drafts, setDrafts] = useState<Draft[]>(existing.map(d => ({ id: d.id, title: d.title, date: d.date, is_final: d.is_final, offsets: d.reminder_offsets || [] })))
  const [time, setTime] = useState((existing[0]?.reminder_time || '09:00').slice(0, 5))
  const [defaults, setDefaults] = useState<string[]>(existing[0]?.reminder_offsets?.length ? existing[0].reminder_offsets : ['1d', '1w'])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newFinal, setNewFinal] = useState(false)
  const [picker, setPicker] = useState<number | 'all' | null>(null)
  const [busy, setBusy] = useState(false)
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied'

  const live = drafts.filter(d => !d.deleted).sort((a, b) => a.date.localeCompare(b.date))
  const next = useMemo(() => {
    const now = new Date()
    return live.flatMap(d => d.offsets.map(o => ({ d, o, at: reminderAt(d.date, time, o) }))).filter(x => x.at > now).sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [live, time])

  if (!course) return null
  const color = course.color

  const toggleDefault = (o: string) => {
    const on = defaults.includes(o)
    const nextDefaults = on ? defaults.filter(x => x !== o) : defaults.length < MAX_OFFSETS ? [...defaults, o] : defaults
    setDefaults(nextDefaults)
    setDrafts(ds => ds.map(d => ({ ...d, offsets: on ? d.offsets.filter(x => x !== o) : d.offsets.includes(o) || d.offsets.length >= MAX_OFFSETS ? d.offsets : [...d.offsets, o] })))
  }
  const toggleDate = (i: number, o: string) => setDrafts(ds => ds.map((d, j) => j !== i ? d : { ...d, offsets: d.offsets.includes(o) ? d.offsets.filter(x => x !== o) : d.offsets.length < MAX_OFFSETS ? [...d.offsets, o] : d.offsets }))
  const muteAll = () => { setDefaults([]); setDrafts(ds => ds.map(d => ({ ...d, offsets: [] }))) }

  const addDate = () => {
    if (!newTitle.trim() || !newDate) return
    setDrafts(ds => [...ds, { title: newTitle.trim(), date: newDate, is_final: newFinal, offsets: [...defaults] }])
    setNewTitle(''); setNewDate(''); setNewFinal(false); setAdding(false)
  }

  const save = async () => {
    setBusy(true)
    if (live.some(d => d.offsets.length) && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      if (await Notification.requestPermission() === 'granted' && userId) await registerPushSubscription(userId)
    } else if (userId && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registerPushSubscription(userId)
    }
    for (const d of drafts) {
      if (d.deleted) { if (d.id) await store.deleteDate(d.id); continue }
      await store.saveDate({ ...(d.id ? { id: d.id } : {}), course_id: courseId, title: d.title, date: d.date, is_final: d.is_final, reminder_offsets: d.offsets, reminder_time: time, sent_offsets: [] })
    }
    const fin = live.find(d => d.is_final)
    if (fin && fin.date !== course.final_date) await store.saveCourse({ id: course.id, name: course.name, final_date: fin.date })
    setBusy(false)
    onClose()
  }

  const idxOf = (d: Draft) => drafts.indexOf(d)
  const today = todayISO()

  return (
    <Sheet onClose={onClose} label="Herinneringen">
      <div className="fx-remind" style={{ '--course': color } as React.CSSProperties}>
        <SheetHead
          left={<button type="button" className="fx-pillbtn" onClick={onClose}>Annuleer</button>}
          title="Herinneringen"
          right={<button type="button" className="fx-pillbtn" onClick={muteAll} aria-label="Alle herinneringen uit" title="Alle herinneringen uit"><BellOff size={20} /></button>} />

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '6px 0 18px' }}>
          <span className="fx-remind-icon"><BellRing size={28} fill="currentColor" /></span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{course.name}</div>
            <div className="fx-muted" style={{ fontSize: 15 }}>Voor de eindtoets en elke belangrijke datum.</div>
          </div>
        </div>

        <div className="fx-remind-row">
          <b style={{ fontSize: 19 }}>Herinner me</b>
          {defaults.map(o => <button key={o} type="button" className="fx-rchip is-on" onClick={() => toggleDefault(o)}>{offsetLabel(o, true)}</button>)}
          {defaults.length < MAX_OFFSETS && (
            <span style={{ position: 'relative' }}>
              <button type="button" className="fx-rchip is-add" onClick={() => setPicker(picker === 'all' ? null : 'all')} aria-label="Herinnering toevoegen"><Plus size={18} /></button>
              {picker === 'all' && <OffsetPicker taken={defaults} onPick={o => { toggleDefault(o); setPicker(null) }} />}
            </span>
          )}
          <b style={{ fontSize: 19 }}>om</b>
          <label className="fx-rchip is-on" style={{ gap: 6 }}><Clock size={17} /><input type="time" value={time} onChange={e => setTime(e.target.value)} className="fx-rtime" aria-label="Tijd van de herinnering" /></label>
        </div>
        <p className="fx-muted" style={{ fontSize: 14, margin: '10px 0 0' }}>Maximaal 3 per datum. "2 uur van tevoren" telt terug vanaf de herinneringstijd op de dag zelf.</p>

        {perm === 'denied' && <p className="fx-banner">Meldingen zijn geblokkeerd in je browser. Sta ze toe in de site-instellingen om herinneringen te krijgen.</p>}

        <div className="fx-remind-head"><span className="fx-overline">Volgende herinnering</span><span className="fx-muted" style={{ fontSize: 15 }}>{next.length} gepland</span></div>
        {next[0] ? (
          <div className="fx-notif-preview">
            <span className="fx-notif-app">F</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="fx-overline" style={{ fontSize: 12 }}>Hypex Focus</span>
                <span className="fx-muted" style={{ fontSize: 13 }}>{next[0].at.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} om {next[0].at.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <b style={{ display: 'block', fontSize: 16 }}>{course.name}</b>
              <span style={{ fontSize: 15 }}>{reminderBody(next[0].d.title, next[0].d.date, next[0].o)}</span>
            </div>
          </div>
        ) : <div className="fx-card is-pad fx-muted" style={{ fontSize: 15 }}>Geen herinneringen gepland.</div>}

        <div className="fx-remind-head"><span className="fx-overline">Datums</span>
          <button type="button" className="fx-rchip is-add" onClick={() => setAdding(a => !a)} aria-label="Datum toevoegen">{adding ? <X size={18} /> : <Plus size={18} />}</button>
        </div>
        {adding && (
          <div className="fx-card is-pad" style={{ marginBottom: 12 }}>
            <label className="fx-field"><span>Wat</span><input className="fx-input" autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Bijv. Toets H4, Practicum" /></label>
            <label className="fx-field"><span>Datum</span><input className="fx-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 15 }}><input type="checkbox" checked={newFinal} onChange={e => setNewFinal(e.target.checked)} /> Dit is de eindtoets</label>
            <button type="button" className="fx-btn is-primary is-block" onClick={addDate} disabled={!newTitle.trim() || !newDate}>Datum toevoegen</button>
          </div>
        )}
        <div className="fx-remind-dates">
          {live.length === 0 && <p className="fx-muted">Nog geen datums. Voeg je toetsen toe met de +.</p>}
          {live.map(d => {
            const i = idxOf(d)
            const dt = parseDay(d.date)
            return (
              <div key={`${d.id || 'new'}-${i}`} className={`fx-remind-date${d.date < today ? ' is-past' : ''}`}>
                <span className="fx-datebadge"><small>{MONTHS_SHORT[dt.getMonth()]}</small><b>{dt.getDate()}</b></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <b style={{ fontSize: 20 }}>{d.title}</b>{d.is_final && <GraduationCap size={20} color={color} />}
                    <button type="button" className="fx-iconbtn" style={{ marginLeft: 'auto', width: 34, height: 34 }} aria-label={`${d.title} verwijderen`}
                      onClick={() => setDrafts(ds => ds.map((x, j) => j === i ? { ...x, deleted: true } : x))}><Trash2 size={16} /></button>
                  </div>
                  <div className="fx-muted" style={{ fontSize: 15, textTransform: 'capitalize' }}>{fmtLongDate(d.date)}</div>
                  {d.date >= today && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, position: 'relative' }}>
                      {d.offsets.map(o => <button key={o} type="button" className="fx-rchip is-soft" onClick={() => toggleDate(i, o)} title="Tik om te verwijderen">{offsetLabel(o)}</button>)}
                      {d.offsets.length < MAX_OFFSETS && <>
                        <button type="button" className="fx-rchip is-soft" onClick={() => setPicker(picker === i ? null : i)} aria-label="Herinnering toevoegen"><Plus size={16} /></button>
                        {picker === i && <OffsetPicker taken={d.offsets} onPick={o => { toggleDate(i, o); setPicker(null) }} />}
                      </>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button type="button" className="fx-btn is-block fx-remind-save" onClick={save} disabled={busy}>{busy ? 'Opslaan…' : 'Herinneringen opslaan'}</button>
      </div>
    </Sheet>
  )
}

function OffsetPicker({ taken, onPick }: { taken: string[]; onPick: (o: string) => void }) {
  return (
    <div className="fx-menu" style={{ left: 0, right: 'auto' }}>
      {OFFSET_OPTIONS.filter(o => !taken.includes(o)).map(o => <button key={o} type="button" onClick={() => onPick(o)}>{offsetLabel(o, true)}</button>)}
    </div>
  )
}
