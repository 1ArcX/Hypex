import { useMemo, useState } from 'react'
import { GraduationCap, Plus, Trash2 } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { neededFinal } from '../lib/grade'
import { fmtDec } from '../lib/format'
import { Sheet, SheetHead } from '../components/ui'
import type { GradePart } from '../types'

interface Draft { id?: string; name: string; weight: string; grade: string; is_final: boolean; deleted?: boolean }

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : null }

/** Welk cijfer heb je nodig op het tentamen om je doel te halen? (NL-schaal 1–10, weging in %) */
export function GradeCalculator({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const store = useFocusStore.getState()
  const course = useFocusStore(s => s.courses.find(c => c.id === courseId))
  const allParts = useFocusStore(s => s.gradeParts)
  const existing = useMemo(() => allParts.filter(p => p.course_id === courseId), [allParts, courseId])
  const [target, setTarget] = useState(course?.target_grade != null ? String(course.target_grade).replace('.', ',') : '6,0')
  const [drafts, setDrafts] = useState<Draft[]>(existing.length
    ? existing.map(p => ({ id: p.id, name: p.name, weight: String(p.weight), grade: p.grade != null ? String(p.grade).replace('.', ',') : '', is_final: p.is_final }))
    : [{ name: 'Toets 1', weight: '25', grade: '', is_final: false }, { name: 'Toets 2', weight: '25', grade: '', is_final: false }, { name: 'Tentamen', weight: '50', grade: '', is_final: true }])
  const [busy, setBusy] = useState(false)
  if (!course) return null

  const live = drafts.filter(d => !d.deleted)
  const parts: GradePart[] = live.map((d, i) => ({ id: d.id || `n${i}`, course_id: courseId, name: d.name, weight: num(d.weight) || 0, grade: num(d.grade), is_final: d.is_final, sort_order: i }))
  const t = num(target)
  const res = t != null ? neededFinal(parts, t) : null
  const totalW = parts.reduce((a, p) => a + p.weight, 0)
  const set = (i: number, patch: Partial<Draft>) => setDrafts(ds => ds.map((d, j) => j === i ? { ...d, ...patch } : d))

  const save = async () => {
    setBusy(true)
    await store.saveCourse({ id: course.id, name: course.name, target_grade: t })
    for (const [i, d] of drafts.entries()) {
      if (d.deleted) { if (d.id) await store.deleteGradePart(d.id); continue }
      if (!d.name.trim()) continue
      await store.saveGradePart({ ...(d.id ? { id: d.id } : {}), course_id: courseId, name: d.name.trim(), weight: num(d.weight) || 0, grade: num(d.grade), is_final: d.is_final, sort_order: i })
    }
    setBusy(false)
    onClose()
  }

  const needed = res?.needed
  const tone = needed == null ? 'var(--fx-text-2)' : !res?.reachable ? 'var(--fx-red)' : needed <= 1 ? 'var(--fx-green)' : 'var(--fx-orange)'

  return (
    <Sheet onClose={onClose} label="Cijfercalculator">
      <SheetHead left={<button type="button" className="fx-pillbtn" onClick={onClose}>Annuleer</button>} title="Cijfercalculator"
        right={<button type="button" className="fx-pillbtn is-primary" onClick={save} disabled={busy}>Bewaar</button>} />

      <div className="fx-grade-result" style={{ '--tone': tone } as React.CSSProperties}>
        <GraduationCap size={30} />
        {needed == null ? (
          <p>Geef het tentamen een weging en vul je doelcijfer in.</p>
        ) : !res?.reachable ? (
          <p><b>Niet meer haalbaar</b><br />Je zou een {fmtDec(needed)} nodig hebben. Probeer een lager doel.</p>
        ) : needed <= 1 ? (
          <p><b>Je doel is al binnen</b><br />Zelfs met een 1 op het tentamen haal je een {fmtDec(t!)}.</p>
        ) : (
          <p>Je hebt een<br /><b className="tnum" style={{ fontSize: 46 }}>{fmtDec(needed)}</b><br />nodig op het tentamen voor een {fmtDec(t!)}</p>
        )}
        {res?.current != null && <small className="tnum">Huidig gemiddelde: {fmtDec(res.current)}</small>}
      </div>

      <label className="fx-field"><span>Doelcijfer</span>
        <input className="fx-input tnum" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} style={{ fontSize: 22, fontWeight: 700 }} />
      </label>

      <div className="fx-field"><span>Onderdelen (weging in % · behaald cijfer)</span>
        {drafts.map((d, i) => !d.deleted && (
          <div key={i} className="fx-grade-row">
            <input className="fx-input" value={d.name} onChange={e => set(i, { name: e.target.value })} aria-label="Naam" />
            <input className="fx-input tnum" inputMode="decimal" value={d.weight} onChange={e => set(i, { weight: e.target.value })} aria-label="Weging in procent" />
            <input className="fx-input tnum" inputMode="decimal" value={d.grade} placeholder={d.is_final ? '?' : '–'} disabled={d.is_final} onChange={e => set(i, { grade: e.target.value })} aria-label="Cijfer" />
            <button type="button" className={`fx-chip${d.is_final ? ' is-active' : ''}`} style={{ height: 44, padding: '0 10px' }} onClick={() => set(i, { is_final: !d.is_final, grade: '' })} title="Tentamen" aria-pressed={d.is_final}>T</button>
            <button type="button" className="fx-iconbtn" onClick={() => set(i, { deleted: true })} aria-label="Onderdeel verwijderen"><Trash2 size={17} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="fx-chip" onClick={() => setDrafts(ds => [...ds, { name: `Onderdeel ${live.length + 1}`, weight: '10', grade: '', is_final: false }])}><Plus size={16} /> Onderdeel</button>
          <span className="fx-muted tnum" style={{ fontSize: 14, color: Math.round(totalW) === 100 ? undefined : 'var(--fx-orange)' }}>Totaal {fmtDec(totalW)}%</span>
        </div>
      </div>
      <p className="fx-muted" style={{ fontSize: 13 }}>Markeer het tentamen met <b>T</b>. Onderdelen zonder cijfer rekenen we met je huidige gemiddelde.</p>
    </Sheet>
  )
}
