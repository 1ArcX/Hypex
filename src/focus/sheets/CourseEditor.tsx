import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { COURSE_COLORS, STATUSES } from '../lib/meta'
import { todayISO } from '../lib/format'
import { Sheet, SheetHead } from '../components/ui'
import type { CourseStatus } from '../types'

interface TopicDraft { id?: string; name: string; hours: number }

/** Vak aanmaken/bewerken: naam, code, kleur, status, start, eindtoets, onderwerpen met doeluren */
export function CourseEditor({ courseId, onClose, onCreated }: { courseId?: string | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const store = useFocusStore.getState()
  const course = useFocusStore(s => s.courses.find(c => c.id === courseId))
  const allTopics = useFocusStore(s => s.topics)
  const existingTopics = useMemo(() => allTopics.filter(t => t.course_id === courseId), [allTopics, courseId])
  const finalDate = useFocusStore(s => s.dates.find(d => d.course_id === courseId && d.is_final))
  const count = useFocusStore(s => s.courses.length)

  const [name, setName] = useState(course?.name || '')
  const [code, setCode] = useState(course?.code || '')
  const [color, setColor] = useState(course?.color || COURSE_COLORS[count % COURSE_COLORS.length])
  const [status, setStatus] = useState<CourseStatus>(course?.status || 'active')
  const [start, setStart] = useState(course?.start_date || todayISO())
  const [final, setFinal] = useState(course?.final_date || finalDate?.date || '')
  const [finalTitle, setFinalTitle] = useState(finalDate?.title || 'Eindtoets')
  const [topics, setTopics] = useState<TopicDraft[]>(existingTopics.map(t => ({ id: t.id, name: t.name, hours: Math.round((t.target_minutes / 60) * 10) / 10 })))
  const [busy, setBusy] = useState(false)

  const valid = name.trim().length > 0

  const save = async () => {
    if (!valid) return
    setBusy(true)
    const saved = await store.saveCourse({
      ...(course ? { id: course.id } : { sort_order: count }),
      name: name.trim(), code: code.trim() || null, color, status,
      start_date: start || null, final_date: final || null,
    })
    if (!saved) { setBusy(false); return }
    // Eindtoets als belangrijke datum (met herinneringen)
    if (final) await store.saveDate({ ...(finalDate ? { id: finalDate.id } : { reminder_offsets: ['1d', '1w'], reminder_time: '09:00' }), course_id: saved.id, title: finalTitle.trim() || 'Eindtoets', date: final, is_final: true })
    else if (finalDate) await store.deleteDate(finalDate.id)
    // Onderwerpen
    const keep = new Set<string>()
    for (const [i, t] of topics.entries()) {
      if (!t.name.trim()) continue
      const row = await store.saveTopic({ ...(t.id ? { id: t.id } : {}), course_id: saved.id, name: t.name.trim(), target_minutes: Math.max(15, Math.round((t.hours || 1) * 60)), sort_order: i })
      if (row) keep.add(row.id)
    }
    for (const t of existingTopics) if (!keep.has(t.id)) await store.deleteTopic(t.id)
    setBusy(false)
    if (!course) onCreated?.(saved.id)
    onClose()
  }

  return (
    <Sheet onClose={onClose} label={course ? 'Vak bewerken' : 'Nieuw vak'}>
      <SheetHead
        left={<button type="button" className="fx-pillbtn" onClick={onClose}>Annuleer</button>}
        title={course ? 'Vak bewerken' : 'Nieuw vak'}
        right={<button type="button" className="fx-pillbtn is-primary" onClick={save} disabled={!valid || busy}>Bewaar</button>} />

      <div className="fx-editor-preview" style={{ background: color }}>
        <b>{code || name || 'Vak'}</b>
      </div>

      <label className="fx-field"><span>Naam</span><input className="fx-input" autoFocus={!course} value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. Wiskunde B" /></label>
      <label className="fx-field"><span>Code (op de rug van het boek)</span><input className="fx-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Bijv. WISB 5" /></label>
      <div className="fx-field"><span>Kleur</span>
        <div className="fx-swatches">
          {COURSE_COLORS.map(c => <button key={c} type="button" className={`fx-swatch${color === c ? ' is-active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Kleur ${c}`} />)}
        </div>
      </div>
      {course && (
        <div className="fx-field"><span>Status</span>
          <div className="fx-seg">
            {STATUSES.map(s => <button key={s.id} type="button" className={status === s.id ? 'is-active' : ''} onClick={() => setStatus(s.id)}>{s.label}</button>)}
          </div>
        </div>
      )}
      <div className="fx-field-row">
        <label className="fx-field"><span>Start</span><input className="fx-input" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="fx-field"><span>Eindtoets</span><input className="fx-input" type="date" value={final} onChange={e => setFinal(e.target.value)} /></label>
      </div>
      {final && <label className="fx-field"><span>Naam van de eindtoets</span><input className="fx-input" value={finalTitle} onChange={e => setFinalTitle(e.target.value)} /></label>}

      <div className="fx-field"><span>Onderwerpen (doel in uren)</span>
        {topics.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="fx-input" style={{ flex: 1 }} value={t.name} placeholder={`Onderwerp ${i + 1}, bijv. H${i + 1}`}
              onChange={e => setTopics(ts => ts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input className="fx-input" style={{ width: 80 }} type="number" min={0.5} step={0.5} value={t.hours} aria-label="Doeluren"
              onChange={e => setTopics(ts => ts.map((x, j) => j === i ? { ...x, hours: +e.target.value } : x))} />
            <button type="button" className="fx-iconbtn" onClick={() => setTopics(ts => ts.filter((_, j) => j !== i))} aria-label="Onderwerp verwijderen"><Trash2 size={18} /></button>
          </div>
        ))}
        <button type="button" className="fx-chip" onClick={() => setTopics(ts => [...ts, { name: '', hours: 3 }])}><Plus size={16} /> Onderwerp</button>
      </div>
    </Sheet>
  )
}
