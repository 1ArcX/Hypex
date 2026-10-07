import { useState } from 'react'
import ReactDOM from 'react-dom'
import RewardScreen from '../../components/pomodoro/RewardScreen'
import { useFocusStore } from '../store/focusStore'
import { fmtDur } from '../lib/format'
import { KIND_BY_ID, NO_COURSE } from '../lib/meta'
import { KindIcon, RateInput, Sheet } from '../components/ui'
import type { Session } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Na een focussessie: eerst "Hoe ging het?" (★ + notitie, zoals de app), daarna het beloningsscherm.
 * `popup` komt uit de timer-engine: { reward, meta, sessionPromise, stopwatch, nextMode, tag }.
 */
export function SessionDone({ popup, onStartNext, onClose }: { popup: any; onStartNext: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'rate' | 'reward'>('rate')
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState<string>(popup.meta?.note || '')
  const [saving, setSaving] = useState(false)
  const course = useFocusStore(s => s.courses.find(c => c.id === popup.meta?.courseId)) || NO_COURSE
  const updateSession = useFocusStore(s => s.updateSession)
  const kind = popup.meta?.kind

  const save = async () => {
    setSaving(true)
    const row = await (popup.sessionPromise as Promise<Session | null>)
    if (row && (rating || note !== (popup.meta?.note || ''))) await updateSession(row.id, { rating, note: note.trim() || null })
    setSaving(false)
    setStep('reward')
  }

  if (step === 'reward') {
    return ReactDOM.createPortal(
      <div style={{ '--accent': '#F58A2C' } as React.CSSProperties}>
        <RewardScreen reward={popup.reward} xp={popup.reward?.xp} tag={course.id === NO_COURSE.id ? popup.tag : course.name}
          nextMode={popup.nextMode}
          startLabel={popup.stopwatch ? 'Klaar' : undefined}
          skipLabel={popup.stopwatch ? 'Sluiten' : undefined}
          onStart={popup.stopwatch ? onClose : onStartNext} onSkip={onClose} />
      </div>,
      document.body,
    )
  }

  return (
    <Sheet onClose={() => setStep('reward')} label="Sessie beoordelen">
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ display: 'inline-flex' }}><KindIcon kind={kind} color={course.color} size={64} /></div>
        <h3 style={{ fontSize: 24, fontWeight: 800, margin: '12px 0 2px' }}>Sessie klaar</h3>
        <p className="fx-muted" style={{ margin: 0, fontSize: 16 }}>
          <b className="tnum" style={{ color: 'var(--fx-text)' }}>{fmtDur(popup.reward?.mins || 0)}</b> · {course.name}{kind ? ` · ${KIND_BY_ID[kind as keyof typeof KIND_BY_ID]?.label}` : ''}
        </p>
        <p style={{ margin: '22px 0 8px', fontSize: 17, fontWeight: 600 }}>Hoe gefocust en productief was je?</p>
        <RateInput value={rating} onChange={setRating} />
      </div>
      <div className="fx-field" style={{ marginTop: 18 }}><span>Notitie</span>
        <textarea className="fx-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Bijv. hoofdstuk 4 samengevat, flashcards herhaald" />
      </div>
      <button type="button" className="fx-btn is-primary is-block" onClick={save} disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
      <button type="button" className="fx-btn is-block" style={{ marginTop: 8, background: 'none' }} onClick={() => setStep('reward')}>Overslaan</button>
    </Sheet>
  )
}
