import { useEffect, useState } from 'react'
import { CalendarCheck, CheckSquare, ChevronLeft, ChevronRight, PenLine, Smile, Sparkles, Star, Target, Timer, Zap } from 'lucide-react'
import { Card, CardHeader, KpiTile } from '../components/ui'
import { addDays, DAYS_SHORT, fmtDur, MONTHS_SHORT, parseDay, todayISO } from '../../focus/lib/format'
import { recapKey, useRecapStore } from '../store/recapStore'
import { dayScore, fmtScore, goalProgress, isSunday, mondayOf, pctDelta, weekDays, weekNumber, weekStats } from '../lib/recapStats'
import type { Activity } from '../hooks/useActivity'
import type { Goal, Recap, RecapInput } from '../types'
import { Delta, GoalChecklist, GoalInputs, GoalSummary, NoteCard, RecapRead, TextField } from '../components/parts'

const blank = (day: string): RecapInput => ({
  kind: 'week', day, energy: null, focus: null, mood: null, went_well: '', improve: '', highlight: '', note_next: '', goals: [],
})
const toDraft = (r: Recap | undefined, day: string): RecapInput => (r
  ? { ...blank(day), went_well: r.went_well || '', improve: r.improve || '', highlight: r.highlight || '', note_next: r.note_next || '', goals: r.goals }
  : blank(day))

const WEEK_LABELS = { went_well: 'Grootste winst', improve: 'Lessen / wat doe je anders', highlight: 'Overig', note_next: 'Bericht voor volgende week', goals: 'Doelen voor volgende week' }

const rangeLabel = (monday: string) => {
  const a = parseDay(monday), b = parseDay(addDays(monday, 6))
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`
}

/** Welke week openen: op zondag deze week; anders vorige week zolang die nog niet is ingevuld */
export function defaultWeek(byKey: Record<string, Recap>, today = todayISO()) {
  const thisMonday = mondayOf(today)
  if (isSunday(today)) return thisMonday
  const prev = addDays(thisMonday, -7)
  return byKey[recapKey('week', prev)] ? thisMonday : prev
}

export default function WeekView({ activity }: { activity: Activity }) {
  const byKey = useRecapStore(s => s.byKey)
  const save = useRecapStore(s => s.save)
  const noteMissing = useRecapStore(s => s.noteMissing)
  const setGoals = useRecapStore(s => s.setGoals)

  const today = todayISO()
  const thisMonday = mondayOf(today)
  const [monday, setMonday] = useState(() => defaultWeek(byKey, today))
  const existing = byKey[recapKey('week', monday)]
  const [editing, setEditing] = useState(!existing)
  const [draft, setDraft] = useState<RecapInput>(() => toDraft(existing, monday))
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(toDraft(byKey[recapKey('week', monday)], monday)); setEditing(!byKey[recapKey('week', monday)]) }, [monday]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = weekStats(byKey, monday, activity.focusByDay, activity.tasksByDay)
  const prev = weekStats(byKey, addDays(monday, -7), activity.focusByDay, activity.tasksByDay)
  const goalSource = byKey[recapKey('week', addDays(monday, -7))]
  const weekGoals = goalSource?.goals.filter(g => g.text.trim()) || []
  const toggleGoal = (idx: number) => {
    if (!goalSource) return
    const real = goalSource.goals.map((g, i) => ({ g, i })).filter(x => x.g.text.trim())[idx]
    if (real) setGoals(goalSource, goalSource.goals.map((g, i) => (i === real.i ? { ...g, done: !g.done } : g)))
  }

  const isCurrent = monday === thisMonday
  const weekOver = isCurrent ? isSunday(today) : monday < thisMonday
  const best = stats.bestDay ? parseDay(stats.bestDay) : null
  const patch = (p: Partial<RecapInput>) => setDraft(d => ({ ...d, ...p }))

  const onSave = async () => {
    setSaving(true)
    const goals: Goal[] = draft.goals.filter(g => g.text.trim()).map(g => ({ text: g.text.trim(), done: g.done }))
    const row = await save({ ...draft, goals, went_well: draft.went_well?.trim() || null, improve: draft.improve?.trim() || null, highlight: draft.highlight?.trim() || null, note_next: draft.note_next?.trim() || null })
    setSaving(false)
    if (row) setEditing(false)
  }

  return (
    <div className="rc-col">
      <div className="rc-head">
        <div style={{ flex: 1 }}>
          <h2 className="t-section" style={{ margin: 0 }}>Week {weekNumber(monday)}</h2>
          <p className="rc-sub">{rangeLabel(monday)}{isCurrent ? ' · deze week' : ''}</p>
        </div>
        <div className="rc-nav">
          <button type="button" onClick={() => setMonday(addDays(monday, -7))} aria-label="Vorige week"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setMonday(addDays(monday, 7))} disabled={monday >= thisMonday} aria-label="Volgende week"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="rc-cols">
        <div className="rc-col">
          {goalSource?.note_next?.trim() && <NoteCard title="Van jezelf, vorige week" text={goalSource.note_next} />}

          <Card>
            <CardHeader icon={Target} title="Weekdoelen" action={<GoalSummary goals={weekGoals} />} />
            {weekGoals.length
              ? <GoalChecklist goals={weekGoals} onToggle={toggleGoal} />
              : <p className="t-meta" style={{ margin: 0 }}>Geen weekdoelen gezet. Die kies je in de weekrecap van de week ervoor.</p>}
          </Card>

          <div className="rc-tiles">
            <KpiTile icon={Zap} value={fmtScore(stats.energy)} label="Gem. energie" sub={<Delta value={pctDelta(stats.energy, prev.energy)} />} tone="warning" dimWhenZero={false} />
            <KpiTile icon={Timer} value={fmtScore(stats.focus)} label="Gem. focus" sub={<Delta value={pctDelta(stats.focus, prev.focus)} />} tone="accent" dimWhenZero={false} />
            <KpiTile icon={Smile} value={fmtScore(stats.mood)} label="Gem. stemming" sub={<Delta value={pctDelta(stats.mood, prev.mood)} />} tone="persoonlijk" dimWhenZero={false} />
            <KpiTile icon={Target} value={stats.goalsTotal ? `${stats.goalsDone}/${stats.goalsTotal}` : '–'} label="Doelen gehaald" tone="info" dimWhenZero={!stats.goalsTotal} />
            <KpiTile icon={Timer} value={fmtDur(stats.focusMins)} label="Focustijd" sub={<Delta value={pctDelta(stats.focusMins, prev.focusMins)} />} tone="accent" dimWhenZero={!stats.focusMins} />
            <KpiTile icon={CheckSquare} value={stats.tasksDone} label="Taken gedaan" sub={<Delta value={pctDelta(stats.tasksDone, prev.tasksDone)} />} tone="success" />
            <KpiTile icon={CalendarCheck} value={`${stats.filled}/7`} label="Recaps ingevuld" tone="routine" dimWhenZero={!stats.filled} />
            {best && <KpiTile icon={Star} value={DAYS_SHORT[best.getDay()]} label="Beste dag" sub={`${best.getDate()} ${MONTHS_SHORT[best.getMonth()]}`} tone="warning" />}
          </div>

          <Card>
            <CardHeader icon={Sparkles} title="Per dag" />
            <div className="rc-weekstrip">
              {weekDays(monday).map(d => {
                const r = byKey[recapKey('day', d)]
                const s = dayScore(r)
                const g = goalProgress(byKey[recapKey('day', addDays(d, -1))]?.goals)
                return (
                  <div key={d} className="rc-wday" title={r ? `Score ${fmtScore(s)}` : 'Geen recap'}>
                    <span>{DAYS_SHORT[parseDay(d).getDay()]}</span>
                    <b style={s != null ? { background: `color-mix(in srgb, var(--accent) ${Math.round(12 + (s - 1) * 14)}%, var(--c-surface-2))` } : d > today ? { opacity: 0.4 } : undefined}>
                      {s != null ? fmtScore(s) : '·'}
                    </b>
                    <span className="tnum">{g.total ? `${g.done}/${g.total}` : ' '}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="rc-col">
          <Card className="glow-bg" style={{ '--glow': 'var(--accent)' }}>
            <CardHeader icon={editing ? PenLine : Sparkles} title="Weekrecap"
              action={!editing && existing ? <button type="button" className="rc-linkbtn" onClick={() => setEditing(true)}>Bewerken</button> : undefined} />
            {!editing && existing ? (
              <RecapRead recap={existing} labels={WEEK_LABELS} />
            ) : (
              <>
                {!weekOver && <p className="rc-banner" style={{ margin: '0 0 14px' }}>De weekrecap vul je op zondag in. Je kunt al beginnen, opslaan mag altijd.</p>}
                <TextField label="Grootste winst van de week" value={draft.went_well || ''} onChange={v => patch({ went_well: v })} placeholder="Waar ben je trots op?" />
                <TextField label="Lessen" hint="wat doe je volgende week anders" value={draft.improve || ''} onChange={v => patch({ improve: v })} />
                <TextField label="Verder nog" hint="optioneel" value={draft.highlight || ''} onChange={v => patch({ highlight: v })} />
                <div className="rc-field">
                  <span className="rc-label">Top 3 doelen voor volgende week</span>
                  <GoalInputs goals={draft.goals} onChange={goals => patch({ goals })} placeholder={['Belangrijkste weekdoel', 'Tweede weekdoel', 'Derde weekdoel']} />
                </div>
                <TextField label="Bericht voor volgende week" hint="motivatie voor jezelf, staat er bovenaan"
                  value={draft.note_next || ''} onChange={v => patch({ note_next: v })} placeholder="Bijv. Nieuwe week, nieuwe kansen. Pak die toets aan!" />
                {noteMissing && <span className="rc-field-warn">Wordt nog niet opgeslagen: draai add_recap_note.sql in Supabase.</span>}
                <div className="rc-actions">
                  {existing && <button type="button" className="btn-ghost" onClick={() => { setDraft(toDraft(existing, monday)); setEditing(false) }}>Annuleren</button>}
                  <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Opslaan…' : 'Weekrecap opslaan'}</button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
