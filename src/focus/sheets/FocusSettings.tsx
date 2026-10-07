import { Minus, Plus } from 'lucide-react'
import { useFocusStore } from '../store/focusStore'
import { useFocusProgress, setDailyGoal } from '../../hooks/useFocusProgress'
import { fmtDur } from '../lib/format'
import { Sheet, SheetHead } from '../components/ui'
import type { ThemePref } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function FocusSettings({ engine, onClose }: { engine: any; onClose: () => void }) {
  const theme = useFocusStore(s => s.theme)
  const setTheme = useFocusStore(s => s.setTheme)
  const { goal } = useFocusProgress()
  const { state, dispatch, toggleNotif, setTimerKind } = engine
  const running = state.running

  const Stepper = ({ value, onChange, min, max, step = 1, fmt = (v: number) => `${v} min` }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; fmt?: (v: number) => string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button type="button" className="fx-round" style={{ width: 36, height: 36 }} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="Minder"><Minus size={16} /></button>
      <b className="tnum" style={{ minWidth: 64, textAlign: 'center' }}>{fmt(value)}</b>
      <button type="button" className="fx-round" style={{ width: 36, height: 36 }} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="Meer"><Plus size={16} /></button>
    </span>
  )
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderTop: '1px solid var(--fx-line)' }}>
      <span style={{ fontSize: 16 }}>{label}</span>{children}
    </div>
  )

  return (
    <Sheet onClose={onClose} label="Instellingen">
      <SheetHead title="Instellingen" right={<button type="button" className="fx-pillbtn is-primary" onClick={onClose}>Klaar</button>} />

      <div className="fx-field"><span>Weergave</span>
        <div className="fx-seg">
          {([['dark', 'Dash'], ['light', 'Licht'], ['auto', 'Systeem']] as [ThemePref, string][]).map(([id, l]) => (
            <button key={id} type="button" className={theme === id ? 'is-active' : ''} onClick={() => setTheme(id)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="fx-field"><span>Standaard timer</span>
        <div className="fx-seg">
          {(['stopwatch', 'pomodoro'] as const).map(k => (
            <button key={k} type="button" disabled={running} className={state.timerKind === k ? 'is-active' : ''} onClick={() => setTimerKind(k)}>{k === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <Row label="Dagdoel"><Stepper value={goal} onChange={setDailyGoal} min={15} max={720} step={15} fmt={fmtDur} /></Row>
        <Row label="Pomodoro focus"><Stepper value={state.workMins} onChange={v => dispatch({ type: 'SET_WORK_MINS', v })} min={5} max={180} step={5} /></Row>
        <Row label="Korte pauze"><Stepper value={state.breakMins} onChange={v => dispatch({ type: 'SET_BREAK_MINS', v })} min={1} max={60} /></Row>
        <Row label="Lange pauze"><Stepper value={state.longBreakMins} onChange={v => dispatch({ type: 'SET_LBRK_MINS', v })} min={5} max={90} step={5} /></Row>
        <Row label="Sessies per cyclus"><Stepper value={state.sessionsPerLong} onChange={v => dispatch({ type: 'SET_SPL', v })} min={1} max={12} fmt={v => String(v)} /></Row>
        <Row label="Eindsignaal">
          <button type="button" className={`fx-chip${state.soundEnabled ? ' is-active' : ''}`} onClick={() => dispatch({ type: 'TOGGLE_SOUND' })}>{state.soundEnabled ? 'Aan' : 'Uit'}</button>
        </Row>
        <Row label="Meldingen (timer en herinneringen)">
          <button type="button" className={`fx-chip${state.notifEnabled ? ' is-active' : ''}`} onClick={toggleNotif}>{state.notifEnabled ? 'Aan' : 'Uit'}</button>
        </Row>
      </div>
    </Sheet>
  )
}
