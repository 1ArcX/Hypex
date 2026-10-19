import { useEffect, type CSSProperties, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { Check, Quote, X } from 'lucide-react'
import { DAYS_LONG, MONTHS, parseDay } from '../../focus/lib/format'
import { SCORES, goalProgress, type ScoreKey } from '../lib/recapStats'
import type { Goal, Recap } from '../types'

export const longDate = (iso: string) => {
  const d = parseDay(iso)
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Score 1–5 als rij knoppen */
export function ScoreInput({ label, color, value, onChange }: { label: string; color: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="rc-score" style={{ '--rc-c': color } as CSSProperties}>
      <span className="rc-score-name">{label}</span>
      <div className="rc-score-btns" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" role="radio" aria-checked={value === i}
            className={`rc-score-btn${value != null && i < value ? ' is-on' : ''}${value === i ? ' is-sel' : ''}`}
            onClick={() => onChange(value === i ? null : i)}>{i}</button>
        ))}
      </div>
    </div>
  )
}

export function ScoreChips({ recap }: { recap: Pick<Recap, ScoreKey> }) {
  const set = SCORES.filter(s => recap[s.key] != null)
  if (!set.length) return null
  return (
    <div className="rc-chips">
      {set.map(s => (
        <span key={s.key} className="rc-chip" style={{ '--rc-c': s.color } as CSSProperties}>{s.label} {recap[s.key]}/5</span>
      ))}
    </div>
  )
}

/** Afvinkbare doelen */
export function GoalChecklist({ goals, onToggle }: { goals: Goal[]; onToggle?: (idx: number) => void }) {
  return (
    <ul className="rc-goals">
      {goals.map((g, i) => g.text.trim() && (
        <li key={i}>
          <button type="button" className={`rc-goal${g.done ? ' is-done' : ''}`} onClick={() => onToggle?.(i)} disabled={!onToggle} aria-pressed={g.done}>
            <span className="rc-check">{g.done && <Check size={12} strokeWidth={3} />}</span>
            <span className="rc-goal-text">{g.text}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function GoalSummary({ goals }: { goals: Goal[] }) {
  const { done, total } = goalProgress(goals)
  if (!total) return null
  return <span className="rc-chip" style={{ '--rc-c': done === total ? 'var(--c-success)' : 'var(--accent)' } as CSSProperties}>{done}/{total} gehaald</span>
}

/** Drie invulvelden voor doelen */
export function GoalInputs({ goals, onChange, placeholder }: { goals: Goal[]; onChange: (g: Goal[]) => void; placeholder: string[] }) {
  const list = [0, 1, 2].map(i => goals[i] || { text: '', done: false })
  return (
    <div>
      {list.map((g, i) => (
        <div key={i} className="rc-goal-row">
          <span className="rc-goal-num">{i + 1}</span>
          <input className="glass-input rc-input" value={g.text} maxLength={140} placeholder={placeholder[i]}
            onChange={e => onChange(list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
        </div>
      ))}
    </div>
  )
}

export function TextField({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="rc-field" style={{ display: 'block' }}>
      <span className="rc-label">{label}{hint && <span className="rc-hint"> · {hint}</span>}</span>
      <textarea className="glass-input rc-textarea" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

/** Gecentreerd venster in een portal (de pagina-transitie heeft een transform) */
export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return ReactDOM.createPortal(
    <div className="rc-modal" onClick={onClose}>
      <div className="rc-modal-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="rc-modal-head">
          <h3 className="t-section">{title}</h3>
          <button type="button" className="rc-x" onClick={onClose} aria-label="Sluiten"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Leesweergave van een (dag- of week)recap */
export function RecapRead({ recap, labels }: { recap: Recap; labels: { went_well: string; improve: string; highlight?: string; note_next?: string; goals: string } }) {
  const rows: [string, string | null][] = [
    [labels.went_well, recap.went_well],
    [labels.improve, recap.improve],
    ...(labels.highlight ? [[labels.highlight, recap.highlight] as [string, string | null]] : []),
    ...(labels.note_next ? [[labels.note_next, recap.note_next] as [string, string | null]] : []),
  ]
  const goals = recap.goals.filter(g => g.text.trim())
  return (
    <dl className="rc-read" style={{ margin: 0 }}>
      {rows.filter(([, v]) => v?.trim()).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
      {goals.length > 0 && (
        <div>
          <dt>{labels.goals}</dt>
          <dd><GoalChecklist goals={goals} /></dd>
        </div>
      )}
    </dl>
  )
}

/** Verandering t.o.v. vorige week: ↑ 12% / ↓ 5% */
export function Delta({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return null
  const up = value >= 0
  return <span className={up ? 'rc-up' : 'rc-down'} title="t.o.v. vorige week">{up ? '↑' : '↓'} {Math.abs(Math.round(value))}% vs vorige</span>
}

/** Bericht dat je jezelf de vorige dag/week hebt meegegeven */
export function NoteCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rc-note">
      <Quote size={18} className="rc-note-icon" aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <span className="rc-note-title">{title}</span>
        <p className="rc-note-text">{text}</p>
      </div>
    </div>
  )
}
