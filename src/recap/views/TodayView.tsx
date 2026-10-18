import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Flame, Repeat, Target, Timer, Wallet, PenLine, Sparkles } from 'lucide-react'
import { Card, CardHeader, KpiTile, FilterTabs } from '../components/ui'
import { appliesOn, isDoneToday } from '../../utils/recurrence'
import { addDays, fmtDur, todayISO } from '../../focus/lib/format'
import { recapKey, useRecapStore } from '../store/recapStore'
import { SCORES, goalProgress, recapStreak, bestStreak } from '../lib/recapStats'
import type { Activity } from '../hooks/useActivity'
import type { Goal, Recap, RecapInput } from '../types'
import { GoalChecklist, GoalInputs, GoalSummary, RecapRead, ScoreChips, ScoreInput, TextField, cap, longDate } from '../components/parts'

interface Task { id: string; recurrence?: string | null; completed?: boolean; last_completed_date?: string | null }

const blank = (day: string): RecapInput => ({
  kind: 'day', day, energy: null, focus: null, mood: null, went_well: '', improve: '', highlight: '', goals: [],
})
const toDraft = (r: Recap | undefined, day: string): RecapInput => (r
  ? { kind: 'day', day, energy: r.energy, focus: r.focus, mood: r.mood, went_well: r.went_well || '', improve: r.improve || '', highlight: r.highlight || '', goals: r.goals }
  : blank(day))

const DAY_LABELS = { went_well: 'Wat ging goed', improve: 'Wat kan beter', highlight: 'Hoogtepunt / dankbaar voor', goals: 'Doelen voor de volgende dag' }

export default function TodayView({ tasks, activity }: { tasks: Task[]; activity: Activity }) {
  const byKey = useRecapStore(s => s.byKey)
  const recaps = useRecapStore(s => s.recaps)
  const save = useRecapStore(s => s.save)
  const setGoals = useRecapStore(s => s.setGoals)

  const today = todayISO()
  const yesterday = addDays(today, -1)
  const yesterdayMissing = !byKey[recapKey('day', yesterday)]
  // 's Ochtends en gisteren vergeten → eerst gisteren invullen
  const [target, setTarget] = useState<string>(() => (yesterdayMissing && new Date().getHours() < 12 ? yesterday : today))
  const existing = byKey[recapKey('day', target)]
  const [editing, setEditing] = useState(!existing)
  const [draft, setDraft] = useState<RecapInput>(() => toDraft(existing, target))
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(toDraft(byKey[recapKey('day', target)], target)); setEditing(!byKey[recapKey('day', target)]) }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  // Doelen voor de gekozen dag staan op de recap van de dag ervoor
  const goalSource = byKey[recapKey('day', addDays(target, -1))]
  const goalsToday = goalSource?.goals.filter(g => g.text.trim()) || []
  const toggleGoal = (idx: number) => {
    if (!goalSource) return
    const real = goalSource.goals.map((g, i) => ({ g, i })).filter(x => x.g.text.trim())[idx]
    if (!real) return
    setGoals(goalSource, goalSource.goals.map((g, i) => (i === real.i ? { ...g, done: !g.done } : g)))
  }

  const routines = useMemo(() => {
    const due = tasks.filter(t => t.recurrence && appliesOn(t, target))
    return { due: due.length, done: due.filter(t => (target === today ? isDoneToday(t, today) : t.last_completed_date && t.last_completed_date >= target)).length }
  }, [tasks, target, today])
  const doneTitles = activity.completions.filter(c => c.day === target && !c.recurring).map(c => c.title)
  const gp = goalProgress(goalsToday)
  const streak = recapStreak(byKey, today)
  const best = bestStreak(recaps)

  const onSave = async () => {
    setSaving(true)
    const goals: Goal[] = draft.goals.filter(g => g.text.trim()).map(g => ({ text: g.text.trim(), done: g.done }))
    const row = await save({ ...draft, goals, went_well: draft.went_well?.trim() || null, improve: draft.improve?.trim() || null, highlight: draft.highlight?.trim() || null })
    setSaving(false)
    // Gisteren ingevuld → door naar vandaag
    if (row) { if (target !== today) setTarget(today); else setEditing(false) }
  }
  const patch = (p: Partial<RecapInput>) => setDraft(d => ({ ...d, ...p }))
  const isToday = target === today

  return (
    <div className="rc-cols">
      <div className="rc-col">
        {yesterdayMissing && (
          <FilterTabs variant="segmented" label="Welke dag" value={target} onChange={(v: string) => setTarget(v)}
            items={[{ value: today, label: 'Vandaag' }, { value: yesterday, label: 'Gisteren (nog open)' }]} style={{ alignSelf: 'flex-start' }} />
        )}

        <Card>
          <CardHeader icon={Target} title={isToday ? 'Doelen voor vandaag' : 'Doelen voor gisteren'} action={<GoalSummary goals={goalsToday} />} />
          {goalsToday.length
            ? <GoalChecklist goals={goalsToday} onToggle={toggleGoal} />
            : <p className="t-meta" style={{ margin: 0 }}>Geen doelen gezet. In je recap kies je de doelen voor de volgende dag.</p>}
        </Card>

        <div className="rc-tiles">
          <KpiTile icon={CheckSquare} value={activity.tasksByDay[target] || 0} label="Taken gedaan" tone="success" />
          <KpiTile icon={Timer} value={fmtDur(activity.focusByDay[target] || 0)} label="Focus" tone="accent" dimWhenZero={!activity.focusByDay[target]} />
          <KpiTile icon={Repeat} value={routines.due ? `${routines.done}/${routines.due}` : '–'} label="Routines" tone="routine" dimWhenZero={!routines.due} />
          <KpiTile icon={Target} value={gp.total ? `${gp.done}/${gp.total}` : '–'} label="Doelen" tone="info" dimWhenZero={!gp.total} />
          {activity.spendByDay && (
            <KpiTile icon={Wallet} value={`€${Math.round(activity.spendByDay[target] || 0)}`} label="Uitgegeven" tone="warning" dimWhenZero={!activity.spendByDay[target]} />
          )}
          <KpiTile icon={Flame} value={streak} label="Dagen op rij" sub={best > streak ? `Record ${best}` : undefined} tone="danger" />
        </div>

        {doneTitles.length > 0 && (
          <Card>
            <CardHeader icon={CheckSquare} title={isToday ? 'Vandaag afgerond' : 'Gisteren afgerond'} count={doneTitles.length} />
            <ul className="rc-done-list">
              {doneTitles.slice(0, 8).map((t, i) => <li key={i}>{t}</li>)}
              {doneTitles.length > 8 && <li style={{ color: 'var(--c-text-3)' }}>en nog {doneTitles.length - 8}</li>}
            </ul>
          </Card>
        )}
      </div>

      <div className="rc-col">
        <Card className="glow-bg" style={{ '--glow': 'var(--accent)' }}>
          <CardHeader icon={editing ? PenLine : Sparkles} title={`Recap · ${cap(longDate(target))}`}
            action={!editing && existing ? <button type="button" className="rc-linkbtn" onClick={() => setEditing(true)}>Bewerken</button> : undefined} />

          {!editing && existing ? (
            <>
              <ScoreChips recap={existing} />
              <div style={{ height: 12 }} />
              <RecapRead recap={existing} labels={DAY_LABELS} />
            </>
          ) : (
            <>
              {SCORES.map(s => (
                <ScoreInput key={s.key} label={s.label} color={s.color} value={draft[s.key]} onChange={v => patch({ [s.key]: v })} />
              ))}
              <div style={{ height: 16 }} />
              <TextField label="Wat ging goed?" value={draft.went_well || ''} onChange={v => patch({ went_well: v })} placeholder="Waar ben je tevreden over?" />
              <TextField label="Wat kan beter?" value={draft.improve || ''} onChange={v => patch({ improve: v })} placeholder="Wat doe je morgen anders?" />
              <TextField label="Hoogtepunt" hint="of waar je dankbaar voor bent" value={draft.highlight || ''} onChange={v => patch({ highlight: v })} />
              <div className="rc-field">
                <span className="rc-label">Top 3 doelen voor {isToday ? 'morgen' : 'vandaag'}</span>
                <GoalInputs goals={draft.goals} onChange={goals => patch({ goals })} placeholder={['Belangrijkste doel', 'Tweede doel', 'Derde doel']} />
              </div>
              <div className="rc-actions">
                {existing && <button type="button" className="btn-ghost" onClick={() => { setDraft(toDraft(existing, target)); setEditing(false) }}>Annuleren</button>}
                <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Opslaan…' : 'Recap opslaan'}</button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
