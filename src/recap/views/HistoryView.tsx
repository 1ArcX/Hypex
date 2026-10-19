import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Flame, LineChart as LineIcon, NotebookPen, Trophy, Sparkles } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, KpiTile, FilterTabs } from '../components/ui'
import { addDays, isoDate, MONTHS, parseDay, todayISO } from '../../focus/lib/format'
import { recapKey, useRecapStore } from '../store/recapStore'
import { SCORES, bestStreak, dayScore, fmtScore, mondayOf, recapStreak, weekNumber } from '../lib/recapStats'
import type { Recap } from '../types'
import { GoalSummary, Modal, RecapRead, ScoreChips, cap, longDate } from '../components/parts'

const DOW = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
const DAY_LABELS = { went_well: 'Wat ging goed', improve: 'Wat kan beter', highlight: 'Hoogtepunt', note_next: 'Bericht voor de volgende dag', goals: 'Doelen voor de volgende dag' }
const WEEK_LABELS = { went_well: 'Grootste winst', improve: 'Lessen', highlight: 'Verder nog', note_next: 'Bericht voor volgende week', goals: 'Doelen voor volgende week' }

export default function HistoryView() {
  const byKey = useRecapStore(s => s.byKey)
  const recaps = useRecapStore(s => s.recaps)
  const today = todayISO()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [range, setRange] = useState<'30' | '90'>('30')
  const [open, setOpen] = useState<string | null>(null)

  // Kalender: weken van maandag t/m zondag rond de maand
  const cells = useMemo(() => {
    const first = isoDate(new Date(ym.y, ym.m, 1))
    const last = isoDate(new Date(ym.y, ym.m + 1, 0))
    const out: string[] = []
    for (let d = mondayOf(first); d <= last || out.length % 7; d = addDays(d, 1)) out.push(d)
    return out
  }, [ym])

  const chart = useMemo(() => {
    const n = Number(range)
    return Array.from({ length: n }, (_, i) => {
      const d = addDays(today, i - n + 1)
      const r = byKey[recapKey('day', d)]
      const p = parseDay(d)
      return { label: `${p.getDate()}/${p.getMonth() + 1}`, energy: r?.energy ?? null, focus: r?.focus ?? null, mood: r?.mood ?? null }
    })
  }, [byKey, range, today])

  const days = recaps.filter(r => r.kind === 'day')
  const last30 = days.filter(r => r.day > addDays(today, -30))
  const avg30 = last30.map(dayScore).filter((x): x is number => x != null)
  const isFutureMonth = ym.y > now.getFullYear() || (ym.y === now.getFullYear() && ym.m >= now.getMonth())
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const openDay = open ? byKey[recapKey('day', open)] : undefined
  const openWeek = open ? byKey[recapKey('week', mondayOf(open))] : undefined

  return (
    <div className="rc-col">
      <div className="rc-tiles">
        <KpiTile icon={Flame} value={recapStreak(byKey, today)} label="Dagen op rij" tone="danger" />
        <KpiTile icon={Trophy} value={bestStreak(recaps)} label="Langste reeks" tone="warning" />
        <KpiTile icon={NotebookPen} value={days.length} label="Dagrecaps" tone="accent" />
        <KpiTile icon={Sparkles} value={avg30.length ? fmtScore(avg30.reduce((a, b) => a + b, 0) / avg30.length) : '–'} label="Gem. score (30d)" tone="persoonlijk" dimWhenZero={!avg30.length} />
      </div>

      <div className="rc-cols">
        <Card>
          <CardHeader icon={CalendarDays} title={`${cap(MONTHS[ym.m])} ${ym.y}`} action={
            <div className="rc-nav">
              <button type="button" onClick={() => shift(-1)} aria-label="Vorige maand"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => shift(1)} disabled={isFutureMonth} aria-label="Volgende maand"><ChevronRight size={16} /></button>
            </div>
          } />
          <div className="rc-cal">
            {DOW.map(d => <span key={d} className="rc-cal-dow">{d}</span>)}
            {cells.map(d => {
              const r = byKey[recapKey('day', d)]
              const s = dayScore(r)
              const hasWeek = parseDay(d).getDay() === 0 && !!byKey[recapKey('week', mondayOf(d))]
              const has = !!r || hasWeek
              const cls = ['rc-cal-day', has && 'has-recap', parseDay(d).getMonth() !== ym.m && 'is-other', d === today && 'is-today', d > today && 'is-future', hasWeek && 'is-week'].filter(Boolean).join(' ')
              return (
                <button key={d} type="button" className={cls} disabled={!has} onClick={() => setOpen(d)}
                  style={r ? { background: `color-mix(in srgb, var(--accent) ${s != null ? Math.round(14 + (s - 1) * 14) : 10}%, var(--c-surface-2))` } : undefined}
                  aria-label={`${longDate(d)}${r ? `, score ${fmtScore(s)}` : ''}${hasWeek ? ', weekrecap' : ''}`}>
                  {parseDay(d).getDate()}
                  {s != null && <small>{fmtScore(s)}</small>}
                </button>
              )
            })}
          </div>
          <p className="t-meta" style={{ margin: '10px 0 0' }}>Kleur = gemiddelde score van de dag · stip op zondag = weekrecap. Klik op een dag om hem terug te lezen.</p>
        </Card>

        <Card>
          <CardHeader icon={LineIcon} title="Scores" action={
            <FilterTabs variant="segmented" label="Periode" value={range} onChange={(v: '30' | '90') => setRange(v)}
              items={[{ value: '30', label: '30 dagen' }, { value: '90', label: '90 dagen' }]} />
          } />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--c-text-3)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--c-text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--c-surface-solid)', border: '1px solid var(--c-border-strong)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--c-text-2)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                {SCORES.map(s => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {open && (
        <Modal title={cap(longDate(open))} onClose={() => setOpen(null)}>
          {openDay && <DayBlock recap={openDay} />}
          {openWeek && parseDay(open).getDay() === 0 && (
            <div style={{ marginTop: openDay ? 20 : 0, paddingTop: openDay ? 16 : 0, borderTop: openDay ? '1px solid var(--c-border)' : 'none' }}>
              <h4 className="t-card" style={{ margin: '0 0 10px' }}>Weekrecap · week {weekNumber(openWeek.day)}</h4>
              <RecapRead recap={openWeek} labels={WEEK_LABELS} />
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function DayBlock({ recap }: { recap: Recap }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <ScoreChips recap={recap} />
        <GoalSummary goals={recap.goals} />
      </div>
      <RecapRead recap={recap} labels={DAY_LABELS} />
    </>
  )
}
