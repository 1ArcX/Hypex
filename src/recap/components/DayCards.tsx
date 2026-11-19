import { useState } from 'react'
import { ArrowRight, CalendarClock, CheckSquare, Clock, GraduationCap, Hourglass, Wallet } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { Card, CardHeader } from './ui'
import { addDays, fmtDur, fmtShortDate, parseDay, todayISO, DAYS_SHORT } from '../../focus/lib/format'
import { useExpenses } from '../../geld/hooks/useExpenses'
import { useBudgetConfig } from '../../geld/hooks/useBudgetConfig'
import { useYearExpenses } from '../../geld/hooks/useYearExpenses'
import { useBudgetStats } from '../../geld/hooks/useBudgetStats'
import { fmt } from '../../geld/lib/format'
import type { DayDetails } from '../hooks/useDayDetails'

/* eslint-disable @typescript-eslint/no-explicit-any */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const relDay = (date: string, from: string) => {
  const n = Math.round((parseDay(date).getTime() - parseDay(from).getTime()) / 86400000)
  return n === 0 ? 'vandaag' : n === 1 ? 'morgen' : n === 2 ? 'overmorgen' : `${DAYS_SHORT[parseDay(date).getDay()]} ${fmtShortDate(date)}`
}

/** Taak of eigen agenda-item één dag doorschuiven (gisteren → vandaag, vandaag → morgen). */
async function moveToNextDay(kind: 'task' | 'event', item: any, day: string) {
  const to = addDays(day, 1) < todayISO() ? todayISO() : addDays(day, 1)
  if (kind === 'task') {
    await supabase.from('tasks').update({ date: to, ...(item.end_date ? { end_date: null } : {}), updated_at: new Date().toISOString() }).eq('id', item.id)
    window.dispatchEvent(new Event('refreshTasks'))
  } else {
    const shift = Math.round((parseDay(to).getTime() - parseDay(day).getTime()) / 86400000) * 86400000
    await supabase.from('calendar_events').update({
      start_time: new Date(new Date(item.start_time).getTime() + shift).toISOString(),
      end_time: new Date(new Date(item.end_time).getTime() + shift).toISOString(),
    }).eq('id', item.id)
    window.dispatchEvent(new Event('refreshCalendarEvents'))
  }
  return to
}

/** "Gepland tegenover gedaan": afgerond (taken + routines) en wat is blijven liggen, met "naar morgen". */
export function PlannedCard({ details, done, day }: { details: DayDetails; done: { title: string; recurring: boolean; completed_at?: string }[]; day: string }) {
  const [moved, setMoved] = useState<Record<string, string>>({})
  const next = addDays(day, 1) < todayISO() ? 'vandaag' : 'morgen'
  const isToday = day === todayISO()
  // Eigen, niet-herhalende items die voorbij zijn: misschien niet gedaan (bv. sport) → ook door te schuiven
  // (alleen items die op deze dag beginnen: "Slapen" van gisteravond hoort bij gisteren)
  const dayStart = parseDay(day).toDateString()
  const pastOwn = details.events.filter(e => e.own && !e.recurring && !e.raw.all_day && e.start.toDateString() === dayStart && e.end.getTime() < Date.now())
  const move = async (kind: 'task' | 'event', item: any, key: string) => {
    const to = await moveToNextDay(kind, item, day)
    setMoved(m => ({ ...m, [key]: to }))
    details.reload()
  }
  const sorted = [...done].sort((a, b) => String(a.completed_at || '').localeCompare(String(b.completed_at || '')))
  return (
    <Card>
      <CardHeader icon={CheckSquare} title="Gepland tegenover gedaan" />
      <p className="rc-sub" style={{ margin: '-6px 0 10px' }}>{done.length} afgerond · {details.leftOpen.length} blijven liggen</p>
      {sorted.length > 0 && (
        <ul className="rc-done-list" style={{ marginTop: 0 }}>
          {sorted.slice(0, 10).map((c, i) => (
            <li key={i}>
              <span style={{ flex: 1, minWidth: 0 }}>{c.title}{c.recurring && <span className="rc-hint"> · routine</span>}</span>
              {c.completed_at && <span className="rc-hint tnum">{hhmm(new Date(c.completed_at))}</span>}
            </li>
          ))}
          {sorted.length > 10 && <li style={{ color: 'var(--c-text-3)' }}>en nog {sorted.length - 10}</li>}
        </ul>
      )}
      {(details.leftOpen.length > 0 || pastOwn.length > 0) && (
        <>
          <span className="rc-label" style={{ marginTop: 12 }}>Blijven liggen</span>
          <ul className="rc-open-list">
            {details.leftOpen.map(t => (
              <li key={`t-${t.id}`}>
                <span className="rc-open-title">{t.title}{t.date < day && <span className="rc-hint"> · te laat</span>}</span>
                {moved[`t-${t.id}`] ? <span className="rc-hint">→ {relDay(moved[`t-${t.id}`], todayISO())}</span>
                  : <button type="button" className="rc-movebtn" onClick={() => move('task', t, `t-${t.id}`)}>Naar {next} <ArrowRight size={12} /></button>}
              </li>
            ))}
            {pastOwn.map(e => (
              <li key={`e-${e.id}`}>
                <span className="rc-open-title">{e.title} <span className="rc-hint tnum">· {hhmm(e.start)} · niet gedaan?</span></span>
                {moved[`e-${e.id}`] ? <span className="rc-hint">→ {relDay(moved[`e-${e.id}`], todayISO())}</span>
                  : <button type="button" className="rc-movebtn" onClick={() => move('event', e.raw, `e-${e.id}`)}>Naar {next} <ArrowRight size={12} /></button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {!sorted.length && !details.leftOpen.length && !pastOwn.length && (
        <p className="t-meta" style={{ margin: 0 }}>{isToday ? 'Nog niets afgerond en niets gepland vandaag.' : 'Niets afgerond en niets blijven liggen.'}</p>
      )}
    </Card>
  )
}

/** "De dag in uren": tijd per agendatype + wat er van 16 wakkere uren vrij bleef. */
export function HoursCard({ details }: { details: DayDetails }) {
  const total = details.hours.reduce((a, h) => a + h.mins, 0) + details.freeMins
  return (
    <Card>
      <CardHeader icon={Clock} title="De dag in uren" />
      {details.loading ? <p className="t-meta" style={{ margin: 0 }}>Laden…</p> : (
        <>
          <div className="rc-hourbar" aria-hidden="true">
            {details.hours.map(h => <span key={h.cat} style={{ flex: h.mins, background: h.color }} />)}
            <span style={{ flex: details.freeMins, background: 'var(--c-surface-3)' }} />
          </div>
          <ul className="rc-hourlist">
            {details.hours.map(h => <li key={h.cat}><i style={{ background: h.color }} />{h.label}<b className="tnum">{fmtDur(h.mins)}</b></li>)}
            <li><i style={{ background: 'var(--c-surface-3)' }} />Vrij <span className="rc-hint">(van 16 wakkere uren)</span><b className="tnum">{fmtDur(details.freeMins)}</b></li>
          </ul>
          {!details.hours.length && <p className="rc-sub">Niets met een tijd in de agenda.</p>}
          {total === 0 && null}
        </>
      )}
    </Card>
  )
}

/** Studeren: focustijd per vak + aftelling naar de eerstvolgende toets (Focus). */
export function StudyCard({ details }: { details: DayDetails }) {
  const total = details.focusByCourse.reduce((a, c) => a + c.mins, 0)
  return (
    <Card>
      <CardHeader icon={GraduationCap} title="Studeren" action={total ? <span className="rc-hint tnum">{fmtDur(total)} totaal</span> : undefined} />
      {details.focusByCourse.length ? (
        <ul className="rc-hourlist">
          {details.focusByCourse.map(c => <li key={c.name}><i style={{ background: c.color }} />{c.name}<b className="tnum">{fmtDur(c.mins)}</b></li>)}
        </ul>
      ) : <p className="t-meta" style={{ margin: 0 }}>Geen studiesessies gelogd.</p>}
      {details.nextExam && (
        <p className="rc-exam"><Hourglass size={14} aria-hidden="true" />
          <span><b>{details.nextExam.course}</b> {details.nextExam.title.toLowerCase().startsWith('tentamen') ? '' : details.nextExam.title.split(/[(]/)[0].trim() + ' · '}
            {details.nextExam.days === 0 ? 'vandaag' : details.nextExam.days === 1 ? 'morgen' : `over ${details.nextExam.days} dagen`}
            {details.nextExam.title.toLowerCase().startsWith('tentamen') ? ' tentamen' : ''}</span>
        </p>
      )}
    </Card>
  )
}

/** Deadlines in de 3 dagen na deze dag (taken + toetsen), boven de doelen voor morgen. */
export function DeadlineList({ details, day }: { details: DayDetails; day: string }) {
  if (!details.deadlines.length) return <p className="rc-sub" style={{ margin: '0 0 8px' }}>Geen deadlines in de komende 3 dagen.</p>
  return (
    <ul className="rc-deadlines">
      {details.deadlines.map((d, i) => (
        <li key={i}><CalendarClock size={13} aria-hidden="true" />
          <span className="rc-open-title">{d.course ? <b>{d.course} </b> : null}{d.title}</span>
          <span className="rc-hint">{relDay(d.date, day)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Geld (admin): vandaag uitgegeven tegenover het dagbudget, wat er deze week nog over is, geen-uitgaven-dagen. */
export function MoneyCard({ userId, day }: { userId: string; day: string }) {
  const { expenses, prevExpenses, loading } = useExpenses(userId)
  const { config, loading: cl } = useBudgetConfig(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const s: any = useBudgetStats({ expenses, prevExpenses, yearExpenses, config })
  if (loading || cl || !config) return null
  const today = todayISO()
  const spentOn = (d: string) => (s.budgetExpenses as any[]).filter(e => e.date === d).reduce((a, e) => a + Number(e.amount), 0)
  const spent = day === today ? s.todayTotal : spentOn(day)
  // Dagbudget aan het begin van de dag (wat er over was ÷ resterende dagen)
  const dayBudget = day === today && s.daysLeft > 0 ? Math.max(0, (s.adjustedRemaining + s.todayTotal) / s.daysLeft) : null
  // Geen-uitgaven-dagen deze maand (t/m gisteren, vandaag telt mee als er nog niets is uitgegeven) + huidige reeks
  const monthStart = today.slice(0, 8) + '01'
  let noSpend = 0, run = 0, counting = true
  for (let d = today; d >= monthStart; d = addDays(d, -1)) {
    const zero = spentOn(d) <= 0
    if (zero) noSpend++
    if (counting) { if (zero) run++; else if (d !== today) counting = false }
  }
  const w = s.week
  return (
    <Card>
      <CardHeader icon={Wallet} title="Geld" />
      <div className="rc-money">
        <div><span className="rc-label">{day === today ? 'Vandaag uitgegeven' : 'Uitgegeven'}</span>
          <b className="tnum" style={{ color: dayBudget != null && spent > dayBudget ? 'var(--c-danger)' : undefined }}>{fmt(spent)}</b>
          {dayBudget != null && <span className="rc-hint">van {fmt(dayBudget)} dagbudget</span>}</div>
        {day === today && w && <div><span className="rc-label">Deze week nog over</span>
          <b className="tnum" style={{ color: w.weekRemaining < 0 ? 'var(--c-danger)' : undefined }}>{fmt(w.weekRemaining)}</b>
          <span className="rc-hint">van {fmt(w.weekAllowance)}</span></div>}
        <div><span className="rc-label">Geen-uitgaven-dagen</span>
          <b className="tnum">{noSpend}</b><span className="rc-hint">deze maand{run > 1 ? ` · ${run} op rij` : ''}</span></div>
      </div>
    </Card>
  )
}
