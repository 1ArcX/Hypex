import { useState } from 'react'
import { useFocusStore } from '../store/focusStore'
import { loadFocusDays } from '../../hooks/useFocusProgress'
import { dayOf, fmtTime, todayISO } from '../lib/format'
import { KINDS } from '../lib/meta'
import { RateInput, Sheet, SheetHead } from '../components/ui'
import type { SessionKind } from '../types'

/** Sessie handmatig toevoegen (sessionId leeg) of een bestaande bewerken/verwijderen */
export function SessionEditor({ sessionId, presetCourseId, onClose }: { sessionId?: string | null; presetCourseId?: string | null; onClose: () => void }) {
  const existing = useFocusStore(s => s.sessions.find(x => x.id === sessionId))
  const courses = useFocusStore(s => s.courses)
  const topics = useFocusStore(s => s.topics)
  const userId = useFocusStore(s => s.userId)
  const { addSession, updateSession, deleteSession } = useFocusStore.getState()

  const startTs = existing ? (existing.started_at || new Date(new Date(existing.completed_at).getTime() - existing.duration_minutes * 60000).toISOString()) : null
  const [courseId, setCourseId] = useState<string>(existing?.course_id || presetCourseId || '')
  const [topicId, setTopicId] = useState<string>(existing?.topic_id || '')
  const [kind, setKind] = useState<SessionKind | null>(existing?.kind || null)
  const [date, setDate] = useState(startTs ? dayOf(startTs) : todayISO())
  const [time, setTime] = useState(startTs ? fmtTime(startTs) : (() => { const d = new Date(Date.now() - 3600000); return `${String(d.getHours()).padStart(2, '0')}:00` })())
  const [hours, setHours] = useState(existing ? Math.floor(existing.duration_minutes / 60) : 1)
  const [mins, setMins] = useState(existing ? existing.duration_minutes % 60 : 0)
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null)
  const [note, setNote] = useState(existing?.note || '')
  const [busy, setBusy] = useState(false)

  const duration = hours * 60 + mins
  const courseTopics = topics.filter(t => t.course_id === courseId)
  const valid = duration >= 1 && duration <= 24 * 60 && date <= todayISO()

  const save = async () => {
    if (!valid) return
    setBusy(true)
    const start = new Date(`${date}T${time || '12:00'}:00`)
    const row = {
      started_at: start.toISOString(),
      completed_at: new Date(start.getTime() + duration * 60000).toISOString(),
      duration_minutes: duration,
      course_id: courseId || null, topic_id: topicId || null, kind, rating, note: note.trim() || null,
    }
    if (existing) await updateSession(existing.id, row)
    else await addSession({ ...row, timer_kind: 'manual' })
    if (userId) loadFocusDays(userId, { force: true })
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!existing || !window.confirm('Deze sessie verwijderen?')) return
    await deleteSession(existing.id)
    if (userId) loadFocusDays(userId, { force: true })
    onClose()
  }

  return (
    <Sheet onClose={onClose} label={existing ? 'Sessie bewerken' : 'Sessie toevoegen'}>
      <SheetHead
        left={<button type="button" className="fx-pillbtn" onClick={onClose}>Annuleer</button>}
        title={existing ? 'Sessie' : 'Sessie toevoegen'}
        right={<button type="button" className="fx-pillbtn is-primary" onClick={save} disabled={!valid || busy}>Bewaar</button>} />

      <div className="fx-field"><span>Vak</span>
        <select className="fx-select" value={courseId} onChange={e => { setCourseId(e.target.value); setTopicId('') }}>
          <option value="">Zonder vak</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
        </select>
      </div>
      {courseTopics.length > 0 && (
        <div className="fx-field"><span>Onderwerp</span>
          <select className="fx-select" value={topicId} onChange={e => setTopicId(e.target.value)}>
            <option value="">Geen</option>
            {courseTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div className="fx-field"><span>Soort</span>
        <div className="fx-chips">
          {KINDS.map(k => {
            const on = kind === k.id
            return (
              <button key={k.id} type="button" className={`fx-chip${on ? ' is-tint' : ''}`} style={on ? { background: k.color } : { color: k.color }} onClick={() => setKind(on ? null : k.id)}>
                <k.Icon size={16} /><span style={{ color: on ? '#fff' : 'var(--fx-text)' }}>{k.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="fx-field-row">
        <label className="fx-field"><span>Datum</span><input className="fx-input" type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="fx-field"><span>Begon om</span><input className="fx-input" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      </div>
      <div className="fx-field-row">
        <label className="fx-field"><span>Uren</span><input className="fx-input" type="number" min={0} max={23} value={hours} onChange={e => setHours(Math.max(0, Math.min(23, +e.target.value || 0)))} /></label>
        <label className="fx-field"><span>Minuten</span><input className="fx-input" type="number" min={0} max={59} value={mins} onChange={e => setMins(Math.max(0, Math.min(59, +e.target.value || 0)))} /></label>
      </div>
      <div className="fx-field"><span>Focus-score</span><RateInput value={rating} onChange={setRating} /></div>
      <div className="fx-field"><span>Notitie</span><textarea className="fx-textarea" value={note} onChange={e => setNote(e.target.value)} /></div>
      {existing && <button type="button" className="fx-btn is-danger is-block" onClick={remove}>Sessie verwijderen</button>}
    </Sheet>
  )
}
